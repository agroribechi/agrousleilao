import cv2
import numpy as np
import easyocr
import re
import hashlib
import time
from typing import Dict, List, Any

# Tenta configurar otimizações PyTorch em CPU
try:
    import torch
    torch.set_num_threads(4)
    torch.set_grad_enabled(False)
except Exception:
    pass

# Instância singleton do EasyOCR
_reader = None
_roi_cache: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL = 15  # Segundos

def get_ocr_reader():
    global _reader
    if _reader is None:
        print("[OCR ENGINE] Inicializando EasyOCR pt/en...")
        _reader = easyocr.Reader(['pt', 'en'], gpu=False, verbose=False)
    return _reader

def compute_crop_hash(gray_img: np.ndarray) -> str:
    if gray_img is None or gray_img.size == 0:
        return ""
    small = cv2.resize(gray_img, (16, 16), interpolation=cv2.INTER_NEAREST)
    return hashlib.md5(small.tobytes()).hexdigest()

def enhance_roi_for_ocr(roi_bgr: np.ndarray) -> List[np.ndarray]:
    """
    Gera variações otimizadas do recorte para garantir leitura em qualquer fundo
    (fundo amarelo, azul, branco, preto de transmissão de TV).
    """
    if roi_bgr is None or roi_bgr.size == 0:
        return []

    h, w = roi_bgr.shape[:2]
    variants = []

    # 1. Upscale se o recorte for pequeno (fontes de TV precisam de altura >= 80px)
    scale = 1.0
    if h < 80:
        scale = max(2.0, 80.0 / float(h))
    elif h > 400:
        scale = 300.0 / float(h)

    if scale != 1.0:
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized_bgr = cv2.resize(roi_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    else:
        resized_bgr = roi_bgr.copy()

    # Variante 1: BGR com contraste aprimorado
    variants.append(resized_bgr)

    # Variante 2: Escala de cinza com CLAHE (realce adaptativo de contraste)
    gray = cv2.cvtColor(resized_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(6, 6))
    enhanced_gray = clahe.apply(gray)
    variants.append(enhanced_gray)

    # Variante 3: Inversão se o texto for claro sobre fundo escuro
    mean_val = np.mean(gray)
    if mean_val < 120:
        inverted = cv2.bitwise_not(enhanced_gray)
        variants.append(inverted)

    return variants

def clean_extracted_text(text: str, field_name: str = "") -> str:
    if not text:
        return ""
    
    text = text.strip()
    field_lower = field_name.lower()

    if any(p in field_lower for p in ["preç", "preco", "valor", "lance", "arremate"]):
        # Preserva formato de preço/moeda R$ 1.250,00 ou números de lance
        match = re.search(r'(?:R\$\s*)?[\d\.,]+', text)
        if match:
            val = match.group(0).strip()
            if not val.startswith("R$") and ("." in val or "," in val or len(val) >= 3):
                return f"R$ {val}"
            return val
    elif any(l in field_lower for l in ["lote", "lot", "nº", "num", "item", "código", "codigo"]):
        # Preserva lotes como "12", "12-A", "05B", "104/1"
        cleaned = re.sub(r'^(lote|lot|nº|num|#)\s*', '', text, flags=re.IGNORECASE).strip()
        match = re.search(r'[A-Za-z0-9\-\/]+', cleaned if cleaned else text)
        if match:
            return match.group(0).upper()
            
    return text

def run_ocr_on_rois(
    frame_bgr: np.ndarray, 
    fields: List[Dict[str, Any]], 
    bypass_cache: bool = False,
    return_crops: bool = False
) -> Any:
    """
    Executa OCR de alta precisão por ROI em coordenadas calibradas.
    """
    reader = get_ocr_reader()
    results = {}
    crops = {}
    h_frame, w_frame = frame_bgr.shape[:2]
    now = time.time()

    for field in fields:
        nome = field.get("nome", "Campo")
        raw_x1 = int(field.get("x1", 0))
        raw_y1 = int(field.get("y1", 0))
        raw_x2 = int(field.get("x2", 0))
        raw_y2 = int(field.get("y2", 0))

        ref_w = field.get("ref_w")
        ref_h = field.get("ref_h")

        # Se não tiver ref_w ou for inválido, usa o tamanho do frame atual
        if not ref_w or not ref_h or ref_w <= 0 or ref_h <= 0:
            ref_w, ref_h = w_frame, h_frame

        scale_x = w_frame / float(ref_w)
        scale_y = h_frame / float(ref_h)

        fx1 = int(raw_x1 * scale_x)
        fy1 = int(raw_y1 * scale_y)
        fx2 = int(raw_x2 * scale_x)
        fy2 = int(raw_y2 * scale_y)

        x1 = max(0, min(fx1, w_frame - 1))
        y1 = max(0, min(fy1, h_frame - 1))
        x2 = max(x1 + 1, min(fx2, w_frame))
        y2 = max(y1 + 1, min(fy2, h_frame))

        roi = frame_bgr[y1:y2, x1:x2]
        if roi.size == 0:
            results[nome] = ""
            if return_crops:
                crops[nome] = ""
            continue

        if return_crops:
            try:
                import base64
                _, buffer = cv2.imencode('.jpg', roi)
                b64_str = base64.b64encode(buffer).decode('utf-8')
                crops[nome] = f"data:image/jpeg;base64,{b64_str}"
            except Exception:
                crops[nome] = ""

        # Checagem de Cache
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        crop_hash = compute_crop_hash(gray_roi)
        cache_key = f"{nome}_{x1}_{y1}_{x2}_{y2}"

        if not bypass_cache:
            cached = _roi_cache.get(cache_key)
            if cached and cached["hash"] == crop_hash and (now - cached["timestamp"]) < _CACHE_TTL:
                results[nome] = cached["result"]
                continue

        # Múltiplas variantes de processamento para máxima robustez
        variants = enhance_roi_for_ocr(roi)
        best_text = ""

        field_lower = nome.lower()
        allowlist = None
        if any(l in field_lower for l in ["lote", "lot", "nº", "num", "id", "código", "codigo"]):
            allowlist = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/'
        elif any(p in field_lower for p in ["preç", "preco", "valor", "lance"]):
            allowlist = '0123456789R$.,- '

        for variant in variants:
            try:
                if allowlist:
                    ocr_out = reader.readtext(
                        variant,
                        detail=0,
                        allowlist=allowlist,
                        paragraph=False
                    )
                else:
                    ocr_out = reader.readtext(
                        variant,
                        detail=0,
                        paragraph=False
                    )
                
                detected = " ".join(ocr_out).strip()
                if detected:
                    best_text = detected
                    break
            except Exception as e:
                pass

        cleaned_text = clean_extracted_text(best_text, field_name=nome)
        final_val = cleaned_text if cleaned_text else (best_text if best_text else "")
        results[nome] = final_val

        # Grava no cache
        _roi_cache[cache_key] = {
            "hash": crop_hash,
            "result": final_val,
            "timestamp": now
        }

    if return_crops:
        return results, crops
    return results
