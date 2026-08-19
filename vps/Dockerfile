FROM python:3.11-slim

WORKDIR /app

# Apenas dependências leves — sem PyTorch, sem OpenCV, sem yt-dlp
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
