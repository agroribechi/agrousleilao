import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leilao_vps.db")

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
        with eng.connect() as conn:
            pass
        print("[VPS DATABASE] Conectado ao PostgreSQL!")
        return eng
    except Exception as e:
        print(f"[VPS DATABASE] Falha no Postgres: {e} — usando SQLite local")
        return create_engine("sqlite:///./leilao_vps.db", connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
