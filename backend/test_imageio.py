import yt_dlp
import imageio
import time

def test_imageio(url, target_sec):
    ydl_opts = {
        'format': 'best',
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'player_client': ['android_vr']}}
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        stream_url = info.get('url')
        
    print(f"Obtido stream URL: {stream_url[:50]}...")
    
    t0 = time.time()
    try:
        # Use imageio to read the frame at target_sec
        reader = imageio.get_reader(stream_url, format='FFMPEG')
        fps = reader.get_meta_data()['fps']
        frame_idx = int(target_sec * fps)
        
        frame = reader.get_data(frame_idx)
        print(f"Frame extraido com sucesso em {time.time() - t0:.2f}s! Shape: {frame.shape}")
        return True
    except Exception as e:
        print(f"Erro: {e}")
        return False

test_imageio("https://www.youtube.com/watch?v=alL-pknZxxM", 15 * 60) # 15 minutes
