import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Carrega as variáveis do arquivo .env
load_dotenv()

# Pega a DATABASE_URL do .env (fallback para sqlite local se não achar ou falhar conexão)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leilao.db")

def get_engine():
    url = SQLALCHEMY_DATABASE_URL
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    
    try:
        eng = create_engine(
            url, 
            pool_pre_ping=True, 
            pool_recycle=300,
            pool_size=10,
            max_overflow=20
        )
        # Teste de conexão imediato
        with eng.connect() as conn:
            pass
        print("[DATABASE] Conectado com sucesso ao PostgreSQL remoto!")
        return eng
    except Exception as e:
        print(f"[DATABASE AVISO] Falha ao conectar ao banco remoto: {e}")
        print("[DATABASE] Alternando automaticamente para banco SQLite local (leilao.db)...")
        return create_engine("sqlite:///./leilao.db", connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

