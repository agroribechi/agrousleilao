import cv2
import yt_dlp
import base64
import re
import subprocess
import tempfile
import os
import urllib.request
import numpy as np
import time
from typing import Tuple, Optional


def parse_youtube_timestamp(url: str) -> Tuple[int, int]:
    """Extrai minutos e segundos de parâmetros de timestamp da URL do YouTube (&t=19m39s, ?t=1179, start=1179, etc)."""
    match = re.search(r'[?&](?:t|start)=([0-9hms]+)', url)
    if not match:
        return 0, 0
    t_str = match.group(1)
    if t_str.isdigit():
        total = int(t_str)
        return total // 60, total % 60
    
    h = re.search(r'(\d+)h', t_str)
    m = re.search(r'(\d+)m', t_str)
    s = re.search(r'(\d+)s', t_str)
    hours = int(h.group(1)) if h else 0
    minutes = int(m.group(1)) if m else 0
    seconds = int(s.group(1)) if s else 0
    total = hours * 3600 + minutes * 60 + seconds
    return total // 60, total % 60


# ========================================================
# CACHE DE STREAM URL — evita chamar yt-dlp a cada varredura
# ========================================================
_stream_url_cache = {}  # { video_url: { "stream_url": ..., "timestamp": ..., "video_id": ... } }
_CACHE_TTL_SEC = 600  # Cache válido por 10 minutos


def _extract_video_id(url: str) -> str:
    """Extrai o ID do vídeo da URL do YouTube."""
    match = re.search(r'(?:v=|/live/|/embed/|youtu\.be/|/v/|/shorts/)([^#\&\?]{11})', url)
    if match:
        return match.group(1)
    if len(url.strip()) == 11:
        return url.strip()
    return ""


def _resolve_stream_url(url: str) -> Optional[str]:
    """Resolve a URL do stream via yt-dlp. Resultado é cacheado."""
    video_id = _extract_video_id(url)
    cache_key = video_id or url

    # Verifica cache
    cached = _stream_url_cache.get(cache_key)
    if cached and (time.time() - cached["timestamp"]) < _CACHE_TTL_SEC:
        print(f"[stream_service] Usando stream URL em cache para {cache_key}")
        return cached["stream_url"]

    # Resolve via yt-dlp
    stream_url = None
    try:
        ydl_opts = {
            'format': 'bestvideo[vcodec!=none]/best[ext=mp4]/best',
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'socket_timeout': 15,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'mweb', 'web']
                }
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            if 'formats' in info:
                for fmt in reversed(info.get('formats', [])):
                    u = fmt.get('url', '')
                    vcodec = fmt.get('vcodec', 'none')
                    if u and vcodec and vcodec != 'none':
                        stream_url = u
                        break
            if not stream_url:
                stream_url = info.get('url')

    except Exception as e:
        print(f"[stream_service] yt-dlp erro: {e}")

    # Salva no cache
    if stream_url:
        _stream_url_cache[cache_key] = {
            "stream_url": stream_url,
            "timestamp": time.time(),
            "video_id": video_id
        }
        print(f"[stream_service] Stream URL resolvida e cacheada para {cache_key}")

    return stream_url


def _capture_frame_ffmpeg(stream_url: str, target_sec: int) -> Optional[np.ndarray]:
    """Captura um frame via ffmpeg subprocess com flags de ultra-baixa latência."""
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.jpg')
        os.close(tmp_fd)

        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-probesize', '32000',
            '-analyzeduration', '0',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-ss', str(target_sec),
            '-i', stream_url,
            '-frames:v', '1',
            '-q:v', '3',
            tmp_path
        ]

        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW

        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            timeout=10,
            **kwargs
        )

        frame = None
        if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 2_000:
            frame = cv2.imread(tmp_path)

        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        return frame

    except subprocess.TimeoutExpired:
        print("[stream_service] ffmpeg timeout ao capturar frame")
    except FileNotFoundError:
        print("[stream_service] ffmpeg não encontrado no PATH")
    except Exception as e:
        print(f"[stream_service] ffmpeg subprocess erro: {e}")
    
    return None


def _capture_frame_cv2(stream_url: str, target_sec: int) -> Optional[np.ndarray]:
    """Fallback: captura frame via OpenCV com timeouts reduzidos."""
    try:
        cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
        if cap.isOpened():
            if target_sec > 0:
                cap.set(cv2.CAP_PROP_POS_MSEC, target_sec * 1000)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 4_000)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3_000)
            success, cap_frame = cap.read()
            cap.release()
            if success and cap_frame is not None and cap_frame.shape[0] > 50:
                return cap_frame
    except Exception as e:
        print(f"[stream_service] cv2.CAP_FFMPEG erro: {e}")
    return None


def fetch_youtube_frame(url: str, min_v: int = 0, seg_v: int = 0, is_live: bool = False) -> Tuple[Optional[np.ndarray], Optional[str], str]:
    """
    Busca um frame específico de uma transmissão/vídeo do YouTube no tempo determinado.
    Usa cache de stream URL e compressão JPEG otimizada.
    """
    frame = None

    # Se minutos e segundos vierem zerados, tenta extrair da própria URL se houver ?t=... ou &t=...
    if min_v == 0 and seg_v == 0:
        p_min, p_seg = parse_youtube_timestamp(url)
        if p_min > 0 or p_seg > 0:
            min_v, seg_v = p_min, p_seg

    target_sec = (min_v * 60) + seg_v
    video_id = _extract_video_id(url)

    # --- Estratégia 1: Stream URL (com cache) + ffmpeg/cv2 ---
    if url:
        stream_url = _resolve_stream_url(url)

        if stream_url:
            t_start = time.time()
            
            # 1a. Tenta ffmpeg (mais rápido e preciso)
            frame = _capture_frame_ffmpeg(stream_url, target_sec)

            # 1b. Fallback para cv2 se ffmpeg falhar
            if frame is None:
                frame = _capture_frame_cv2(stream_url, target_sec)

            elapsed = time.time() - t_start
            if frame is not None:
                print(f"[stream_service] Frame capturado em {elapsed:.1f}s no tempo {target_sec}s")
            else:
                # Stream URL pode ter expirado, invalida cache
                cache_key = video_id or url
                if cache_key in _stream_url_cache:
                    del _stream_url_cache[cache_key]
                    print(f"[stream_service] Cache invalidado para {cache_key}, tentando resolver novamente...")
                    
                    # Tenta uma vez mais com URL fresca
                    stream_url = _resolve_stream_url(url)
                    if stream_url:
                        frame = _capture_frame_ffmpeg(stream_url, target_sec)
                        if frame is None:
                            frame = _capture_frame_cv2(stream_url, target_sec)

    # --- Estratégia 2 (Fallback Resiliente): Thumbnail público em HD ---
    if frame is None and video_id:
        print(f"[stream_service] Tentando fallback de thumbnail pública para video_id={video_id}")
        thumb_sizes = [
            f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
            f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
            f"https://img.youtube.com/vi/{video_id}/sddefault.jpg",
            f"https://img.youtube.com/vi/{video_id}/0.jpg",
        ]
        for thumb_url in thumb_sizes:
            try:
                req = urllib.request.urlopen(thumb_url, timeout=5)
                img_bytes = req.read()
                if len(img_bytes) > 10_000:
                    img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
                    if img is not None and img.shape[0] >= 200 and img.shape[1] >= 200:
                        frame = img
                        print(f"[stream_service] Thumbnail carregada com sucesso de {thumb_url}")
                        break
            except Exception as e:
                print(f"[stream_service] Falha ao baixar thumbnail {thumb_url}: {e}")

    if frame is None:
        return (
            None, None,
            "Não foi possível capturar frame do vídeo no momento especificado. "
            "Verifique o link ou utilize o envio de print/captura de tela."
        )

    # Converte para JPEG base64 otimizado para o Frontend
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    return frame, f"data:image/jpeg;base64,{frame_base64}", "Sucesso"

