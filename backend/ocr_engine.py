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

# Instância singleton do EasyOCR para alta performance
_reader = None
_roi_cache: Dict[str, Dict[str, Any]] = {}  # { field_key: { "hash": ..., "result": ..., "timestamp": ... } }
_CACHE_TTL = 30  # Tempo máximo de vida do cache por ROI em segundos

def get_ocr_reader():
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(['pt'], gpu=False)
    return _reader

def compute_crop_hash(gray_img: np.ndarray) -> str:
    """Calcula um hash ultra-rápido de 16x16 pixels para comparar se o recorte mudou."""
    if gray_img is None or gray_img.size == 0:
        return ""
    small = cv2.resize(gray_img, (16, 16), interpolation=cv2.INTER_NEAREST)
    return hashlib.md5(small.tobytes()).hexdigest()

def preprocess_crop(roi_bgr: np.ndarray, field_name: str = "") -> np.ndarray:
    """
    Pré-processa e otimiza o recorte para OCR super-rápido:
    - Normaliza a altura para 56px (redução massiva do tempo de convolução CPU)
    - Converte para escala de cinza e aplica contraste adaptativo suave
    """
    if roi_bgr is None or roi_bgr.size == 0:
        return roi_bgr

    # Converte para escala de cinza
    gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]

    # Normaliza altura para 56px para aceleração máxima em CPU
    target_h = 56
    if h > 0 and w > 0:
        scale = target_h / float(h)
        new_w = max(16, int(w * scale))
        gray = cv2.resize(gray, (new_w, target_h), interpolation=cv2.INTER_AREA)

    # Realce de contraste adaptativo suave
    clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(4, 4))
    enhanced = clahe.apply(gray)
    return enhanced

def clean_extracted_text(text: str, field_name: str = "") -> str:
    """
    Limpa e formata o texto extraído de acordo com a semântica do campo (ex: preço, lote, idade).
    """
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
        match = re.search(r'[A-Za-z0-9\-\/]+', text)
        if match:
            return match.group(0).upper()
            
    return text

def run_ocr_on_rois(frame_bgr: np.ndarray, fields: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Executa OCR ultrarrápido por ROI com Cache Inteligente por Hash de Imagem.
    Se o recorte do campo não mudou em relação à varredura anterior, responde em 0ms.
    """
    reader = get_ocr_reader()
    results = {}
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

        if not ref_w or not ref_h:
            if raw_x2 > 1280 or raw_y2 > 720:
                ref_w, ref_h = 1920, 1080
            elif raw_x2 > 640 or raw_y2 > 360:
                ref_w, ref_h = 1280, 720
            else:
                ref_w, ref_h = 640, 360

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
            continue

        # 1. Hashing e checagem de Cache (0ms se campo estático)
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        crop_hash = compute_crop_hash(gray_roi)
        cache_key = f"{nome}_{x1}_{y1}_{x2}_{y2}"

        cached = _roi_cache.get(cache_key)
        if cached and cached["hash"] == crop_hash and (now - cached["timestamp"]) < _CACHE_TTL:
            results[nome] = cached["result"]
            continue

        # 2. Processamento de Imagem
        processed_roi = preprocess_crop(roi, field_name=nome)
        
        # Allowlists aceleradas por tipo de campo
        field_lower = nome.lower()
        allowlist = None
        if any(l in field_lower for l in ["lote", "lot", "nº", "num", "id", "código", "codigo"]):
            allowlist = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/'
        elif any(p in field_lower for p in ["preç", "preco", "valor", "lance"]):
            allowlist = '0123456789R$.,- '

        try:
            ocr_out = reader.readtext(
                processed_roi,
                detail=0,
                decoder='greedy',
                batch_size=4,
                allowlist=allowlist,
                adjust_contrast=0.5,
                contrast_ths=0.1
            )
            raw_text = " ".join(ocr_out)
        except Exception:
            ocr_out = reader.readtext(processed_roi, detail=0, decoder='greedy')
            raw_text = " ".join(ocr_out)

        cleaned_text = clean_extracted_text(raw_text, field_name=nome)
        final_val = cleaned_text if cleaned_text else (raw_text if raw_text else "")
        results[nome] = final_val

        # Grava no cache
        _roi_cache[cache_key] = {
            "hash": crop_hash,
            "result": final_val,
            "timestamp": now
        }

    return results

