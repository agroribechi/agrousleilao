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


import shutil

_last_diagnostic_error = ""

def _get_ffmpeg_binary() -> str:
    """Retorna o caminho do executável do ffmpeg (do sistema ou do imageio_ffmpeg)."""
    sys_ffmpeg = shutil.which('ffmpeg')
    if sys_ffmpeg:
        return sys_ffmpeg
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def _resolve_stream_info(url: str) -> Optional[dict]:
    """Resolve a URL do stream e headers via yt-dlp. Resultado é cacheado."""
    global _last_diagnostic_error
    video_id = _extract_video_id(url)
    cache_key = video_id or url

    # Verifica cache
    cached = _stream_url_cache.get(cache_key)
    if cached and (time.time() - cached["timestamp"]) < _CACHE_TTL_SEC:
        return cached

    # Resolve via yt-dlp
    stream_url = None
    http_headers = {}
    try:
        ydl_opts = {
            'format': '18/22/best[vcodec!=none]/best',
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'socket_timeout': 15,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android_vr', 'android', 'android_creator']
                }
            }
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            stream_url = info.get('url')
            http_headers = info.get('http_headers', {})
            if not stream_url and 'formats' in info:
                for fmt in reversed(info.get('formats', [])):
                    u = fmt.get('url', '')
                    vcodec = fmt.get('vcodec', 'none')
                    if u and vcodec and vcodec != 'none':
                        stream_url = u
                        http_headers = fmt.get('http_headers', http_headers)
                        break

    except Exception as e:
        _last_diagnostic_error = f"yt-dlp: {e}"
        print(f"[stream_service] yt-dlp erro: {e}")

    # Salva no cache
    if stream_url:
        result = {
            "stream_url": stream_url,
            "http_headers": http_headers,
            "timestamp": time.time(),
            "video_id": video_id
        }
        _stream_url_cache[cache_key] = result
        print(f"[stream_service] Stream URL resolvida e cacheada para {cache_key}")
        return result

    return None


def _capture_frame_ffmpeg(stream_url: str, target_sec: int, http_headers: dict = None) -> Optional[np.ndarray]:
    """Captura um frame via ffmpeg subprocess no tempo especificado usando headers adequados."""
    global _last_diagnostic_error
    try:
        ffmpeg_exe = _get_ffmpeg_binary()
        
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.jpg')
        os.close(tmp_fd)

        ffmpeg_cmd = [ffmpeg_exe, '-y']
        
        headers_dict = http_headers or {}
        user_agent = headers_dict.get('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        # Adiciona headers customizados para evitar 403 Forbidden
        for k, v in headers_dict.items():
            if k.lower() != 'user-agent':
                ffmpeg_cmd.extend(['-headers', f'{k}: {v}\r\n'])
        
        ffmpeg_cmd.extend([
            '-user_agent', user_agent,
            '-ss', str(target_sec),
            '-i', stream_url,
            '-frames:v', '1',
            '-q:v', '2',
            tmp_path
        ])

        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW

        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            timeout=20,
            **kwargs
        )

        frame = None
        if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 2_000:
            frame = cv2.imread(tmp_path)
        else:
            stderr_msg = result.stderr.decode('utf-8', errors='ignore')
            _last_diagnostic_error = f"ffmpeg (code {result.returncode}): {stderr_msg[:200]}"
            print(f"[stream_service] ffmpeg falhou. Stderr: {stderr_msg}")

        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        return frame
    except Exception as e:
        _last_diagnostic_error = f"ffmpeg fatal: {e}"
        print(f"[stream_service] ffmpeg erro fatal: {e}")
    return None


def _capture_frame_cv2(stream_url: str, target_sec: int) -> Optional[np.ndarray]:
    """Fallback: captura frame via OpenCV com timeouts reduzidos."""
    try:
        cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
        if cap.isOpened():
            if target_sec > 0:
                cap.set(cv2.CAP_PROP_POS_MSEC, target_sec * 1000)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 15_000)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 15_000)
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
    global _last_diagnostic_error
    _last_diagnostic_error = ""
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
        stream_info = _resolve_stream_info(url)

        if stream_info:
            t_start = time.time()
            stream_url = stream_info.get("stream_url")
            http_headers = stream_info.get("http_headers", {})
            
            # 1a. Tenta ffmpeg (mais rápido e preciso com headers)
            frame = _capture_frame_ffmpeg(stream_url, target_sec, http_headers)

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
                    stream_info = _resolve_stream_info(url)
                    if stream_info:
                        frame = _capture_frame_ffmpeg(
                            stream_info.get("stream_url"),
                            target_sec,
                            stream_info.get("http_headers", {})
                        )
                        if frame is None:
                            frame = _capture_frame_cv2(stream_info.get("stream_url"), target_sec)

    if frame is None:
        err_msg = f"Falha na extração de vídeo do servidor: {_last_diagnostic_error}" if _last_diagnostic_error else "Não foi possível carregar o vídeo no tempo solicitado. Verifique a URL."
        return (None, None, err_msg)

    # Converte para JPEG base64 otimizado para o Frontend
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    return frame, f"data:image/jpeg;base64,{frame_base64}", "Sucesso"

