# 🐂 Leilão IA PRO v2.0

Plataforma de **visão computacional e inteligência artificial** para leilões ao vivo. Captura streams do YouTube em tempo real, aplica OCR nos campos calibrados e registra automaticamente lotes, lances e arrematações.

## ✨ Funcionalidades

- 🎥 **Captura de streams ao vivo** do YouTube via yt-dlp + ffmpeg
- 🔍 **OCR em tempo real** com EasyOCR + cache inteligente por hash de imagem
- 🎯 **Calibrador visual** — desenhe retângulos sobre o frame para definir campos OCR
- 📊 **Dashboard de leilões** com gestão de lotes e histórico
- 👥 **Sistema de usuários** com autenticação Supabase e controle de acesso
- 📋 **Templates reutilizáveis** para diferentes layouts de leiloeiros
- 📱 **Interface responsiva** e moderna com React

## 🏗️ Arquitetura

```
frontend/          → React 18 + Vite (SPA)
backend/           → FastAPI + SQLAlchemy
  ├── main.py      → API REST (~35 rotas)
  ├── ocr_engine.py → Motor OCR com EasyOCR + cache
  ├── stream_service.py → Captura de frames YouTube
  ├── auth.py      → Autenticação JWT via Supabase
  └── models.py    → Modelos do banco (Users, Auctions, Templates, Logs)
Supabase           → PostgreSQL (banco) + Auth (autenticação)
```

## 🚀 Setup Local

### Pré-requisitos

- Python 3.10+
- Node.js 18+
- ffmpeg instalado e no PATH
- Conta no [Supabase](https://supabase.com) (plano gratuito funciona)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
cp .env.example .env          # Preencha com suas credenciais Supabase
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # Preencha com suas credenciais Supabase
npm run dev
```

### 3. Acesse

Abra [http://localhost:5173](http://localhost:5173) no navegador.

> **Atalho Windows:** Execute `iniciar_sistema.bat` na raiz para iniciar ambos os servidores automaticamente.

## 🐳 Deploy com Docker

O projeto inclui Dockerfiles prontos para deploy em VPS com EasyPanel, Railway ou qualquer plataforma Docker.

```bash
# Backend
cd backend
docker build -t leilao-backend .
docker run -p 8000:8000 --env-file .env leilao-backend

# Frontend
cd frontend
docker build \
  --build-arg VITE_API_BASE=https://api.seudominio.com \
  --build-arg VITE_SUPABASE_URL=https://seu-projeto.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=sua_anon_key \
  -t leilao-frontend .
docker run -p 80:80 leilao-frontend
```

## 📁 Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL do Supabase |
| `SUPABASE_JWT_SECRET` | JWT Secret para validar tokens de autenticação |

### Frontend (`frontend/.env`)

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `VITE_API_BASE` | URL do backend (default: `http://localhost:8000`) |

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, Vite, Lucide Icons |
| Backend | FastAPI, Uvicorn, SQLAlchemy |
| OCR | EasyOCR, OpenCV, PyTorch (CPU) |
| Streams | yt-dlp, ffmpeg |
| Banco | PostgreSQL (Supabase) |
| Auth | Supabase Auth + JWT |

## 📄 Licença

Uso privado. Todos os direitos reservados.
