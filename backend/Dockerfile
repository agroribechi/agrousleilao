FROM python:3.11-slim

# Instala ffmpeg e dependências nativas do OpenCV/EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências Python primeiro (aproveita cache de camada Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pré-carrega modelo EasyOCR no build (evita download de ~100MB na primeira request)
RUN python -c "import easyocr; easyocr.Reader(['pt'], gpu=False)"

# Copia o código do backend
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
