"""
VPS Relay — FastAPI Leve
========================
Este servidor NÃO roda OCR, NÃO usa yt-dlp, NÃO usa PyTorch.
Suas responsabilidades:
  1. Receber dados já processados do Admin Local (via token seguro)
  2. Receber prints/fotos dos clientes mobile e processar com Gemini Vision (só HTTP)
  3. Servir dados em tempo real para os clientes
  4. Gerenciar autenticação de clientes (Supabase)
  5. Persistir logs de leilão no banco de dados
"""
import os
import re
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime
import csv, io

from database import engine, Base, get_db, SessionLocal
import models
import gemini_vision
from auth import get_current_user, get_optional_current_user

# ── Migração de colunas automática ────────────────────────────────────────────
def auto_migrate_schema():
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE auctions ADD COLUMN logo_url TEXT;",
        "ALTER TABLE auctions ADD COLUMN banner_url TEXT;",
        "ALTER TABLE auctions ADD COLUMN auctioneer_name VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN address_street VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN address_city VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN address_state VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN address_zip VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN phone_primary VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN phone_whatsapp VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN website_url VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN social_instagram VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN payment_status VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN plan_tier VARCHAR;",
        "ALTER TABLE auctions ADD COLUMN promotion_expires_at TIMESTAMP;",
        "ALTER TABLE auctions ADD COLUMN template_id INTEGER;",
        "ALTER TABLE auction_logs ADD COLUMN category VARCHAR;",
        "ALTER TABLE auction_logs ADD COLUMN status VARCHAR;",
        "ALTER TABLE auction_logs ADD COLUMN notes TEXT;",
        "ALTER TABLE auction_logs ADD COLUMN frame_image TEXT;",
        "ALTER TABLE auction_logs ADD COLUMN captured_at TIMESTAMP;",
        "ALTER TABLE auction_logs ADD COLUMN auction_id INTEGER;",
    ]
    for stmt in stmts:
        try:
            with engine.connect() as conn:
                conn.execute(text(stmt))
                conn.commit()
        except Exception:
            pass  # Coluna já existe

auto_migrate_schema()
models.Base.metadata.create_all(bind=engine)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Leilão IA — VPS Relay",
    version="3.0.0",
    description="Relay leve: recebe dados do Admin Local, serve clientes mobile"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth de Admin Local (token compartilhado) ─────────────────────────────────
ADMIN_SECRET_TOKEN = os.getenv("ADMIN_SECRET_TOKEN", "")

def verify_admin_token(x_admin_token: str = Header(alias="X-Admin-Token")):
    """Valida o token do Admin Local. Usado para proteger as rotas /api/push/*"""
    if not ADMIN_SECRET_TOKEN:
        raise HTTPException(status_code=500, detail="ADMIN_SECRET_TOKEN não configurado na VPS.")
    if x_admin_token != ADMIN_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Token de admin inválido.")
    return True


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS (Pydantic)
# ══════════════════════════════════════════════════════════════════════════════

class SyncUserRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    supabase_uid: str

class PushFrameRequest(BaseModel):
    """Dados processados enviados pelo Admin Local após captura + Gemini/OCR."""
    auction_id: Optional[int] = None
    template_name: str
    video_url: Optional[str] = None
    ocr_data: Dict[str, Any] = {}
    lot_number: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    age: Optional[str] = None
    frame_image: Optional[str] = None   # JPEG base64 (thumbnail)
    filter_categories: List[str] = []
    alert_triggered: bool = False
    matched_category: Optional[str] = None

class PushAuctionRequest(BaseModel):
    """Criação ou atualização de leilão enviada pelo Admin Local."""
    id: Optional[int] = None  # Se preenchido, atualiza; se não, cria
    title: str
    description: Optional[str] = None
    start_date: datetime
    status: str = "Agendado"
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    auctioneer_name: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    phone_primary: Optional[str] = None
    phone_whatsapp: Optional[str] = None
    website_url: Optional[str] = None
    social_instagram: Optional[str] = None
    payment_status: Optional[str] = "Gratuito"
    plan_tier: Optional[str] = "Gratuito"
    template_id: Optional[int] = None

class PushAccessRequest(BaseModel):
    """Atualiza quais usuários têm acesso a um leilão."""
    auction_id: int
    user_emails: List[str]  # Usa email para identificar usuários

class ClientFrameRequest(BaseModel):
    """Print enviado pelo celular do cliente para análise Gemini."""
    image_base64: str
    auction_id: Optional[int] = None
    api_key: Optional[str] = None

class AuctionLogUpdate(BaseModel):
    status: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    lot_number: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# AUTENTICAÇÃO (Supabase)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/sync")
def sync_user(user_data: SyncUserRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        (models.User.supabase_uid == user_data.supabase_uid) |
        (models.User.email == user_data.email)
    ).first()

    admin_count = db.query(models.User).filter(models.User.role == "admin").count()

    if existing:
        if not existing.supabase_uid:
            existing.supabase_uid = user_data.supabase_uid
        if admin_count == 0:
            existing.role = "admin"
        db.commit()
        db.refresh(existing)
        return {"status": "already_synced", "user": {
            "id": existing.id, "email": existing.email,
            "role": existing.role, "full_name": existing.full_name
        }}

    initial_role = "admin" if admin_count == 0 else "client"
    new_user = models.User(
        supabase_uid=user_data.supabase_uid,
        email=user_data.email,
        full_name=user_data.full_name,
        role=initial_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"status": "synced", "user": {
        "id": new_user.id, "email": new_user.email,
        "role": new_user.role, "full_name": new_user.full_name
    }}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "supabase_uid": current_user.supabase_uid,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN PUSH — rotas protegidas pelo X-Admin-Token
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/push/frame")
def push_frame_data(
    req: PushFrameRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """
    Recebe dados de OCR/Gemini já processados pelo Admin Local.
    Aplica a lógica de negócio: detecta troca de lote, grava log, dispara alertas.
    """
    lot_num = (req.lot_number or "").strip()
    price = (req.price or "").strip()
    desc = (req.description or "").strip()
    age = (req.age or "").strip()
    category = (req.category or "Geral").strip()

    last_log = db.query(models.AuctionLog).filter(
        models.AuctionLog.channel_name == req.template_name
    ).order_by(models.AuctionLog.captured_at.desc()).first()

    lot_changed = False
    current_log = None
    now = datetime.utcnow()

    if lot_num and lot_num not in ("Lote Em Leitura", "Aguardando Lote", "---"):
        if not last_log or last_log.lot_number != lot_num:
            # Marca lote anterior como arrematado
            if last_log and last_log.status == "Em Andamento":
                last_log.status = "Arrematado"
                db.commit()
            lot_changed = True
            current_log = models.AuctionLog(
                auction_id=req.auction_id,
                channel_name=req.template_name,
                video_url=req.video_url,
                lot_number=lot_num,
                category=category,
                description=desc or "Lote em andamento",
                age=age,
                price=price or "R$ ---",
                status="Em Andamento",
                frame_image=req.frame_image,
                extracted_data=req.ocr_data,
                captured_at=now
            )
            db.add(current_log)
            db.commit()
            db.refresh(current_log)
        else:
            # Mesmo lote — atualiza campos em tempo real
            if price: last_log.price = price
            if desc: last_log.description = desc
            if age: last_log.age = age
            if category: last_log.category = category
            if req.frame_image: last_log.frame_image = req.frame_image
            last_log.extracted_data = req.ocr_data
            db.commit()
            db.refresh(last_log)
            current_log = last_log
    elif last_log:
        if price: last_log.price = price
        if desc: last_log.description = desc
        if age: last_log.age = age
        if req.frame_image: last_log.frame_image = req.frame_image
        last_log.extracted_data = req.ocr_data
        db.commit()
        db.refresh(last_log)
        current_log = last_log
    else:
        current_log = models.AuctionLog(
            auction_id=req.auction_id,
            channel_name=req.template_name,
            video_url=req.video_url,
            lot_number="Aguardando Lote",
            category=category,
            description=desc or "Lendo transmissão...",
            age=age,
            price=price or "R$ ---",
            status="Em Andamento",
            frame_image=req.frame_image,
            extracted_data=req.ocr_data,
            captured_at=now
        )
        db.add(current_log)
        db.commit()
        db.refresh(current_log)

    history = db.query(models.AuctionLog).filter(
        models.AuctionLog.channel_name == req.template_name
    ).order_by(models.AuctionLog.captured_at.desc()).limit(50).all()

    return {
        "status": "success",
        "lot_changed": lot_changed,
        "alert_triggered": req.alert_triggered,
        "matched_category": req.matched_category,
        "current_log": current_log,
        "history": history
    }


@app.post("/api/push/auction")
def push_auction(
    req: PushAuctionRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Cria ou atualiza um leilão na VPS a partir do Admin Local."""
    if req.id:
        auction = db.query(models.Auction).filter(models.Auction.id == req.id).first()
        if not auction:
            raise HTTPException(status_code=404, detail="Leilão não encontrado na VPS.")
        update_data = req.model_dump(exclude={"id"}, exclude_unset=True)
        for key, val in update_data.items():
            setattr(auction, key, val)
        db.commit()
        db.refresh(auction)
        return {"status": "updated", "auction_id": auction.id}
    else:
        data = req.model_dump(exclude={"id"}, exclude_unset=True)
        auction = models.Auction(**data)
        db.add(auction)
        db.commit()
        db.refresh(auction)
        return {"status": "created", "auction_id": auction.id}


@app.post("/api/push/access")
def push_access(
    req: PushAccessRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Define quais usuários (por email) têm acesso a um leilão."""
    auction = db.query(models.Auction).filter(models.Auction.id == req.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    users = db.query(models.User).filter(models.User.email.in_(req.user_emails)).all()
    auction.allowed_users = users
    db.commit()
    return {"status": "success", "granted_count": len(users)}


# ══════════════════════════════════════════════════════════════════════════════
# DADOS AO VIVO — para o frontend do cliente
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/live/{auction_id}")
def get_live_data(auction_id: int, db: Session = Depends(get_db)):
    """
    Retorna o estado ao vivo do leilão: último lote, preço, histórico recente.
    Clientes fazem polling desta rota a cada 3-5 segundos.
    """
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")

    latest_log = db.query(models.AuctionLog).filter(
        models.AuctionLog.auction_id == auction_id
    ).order_by(models.AuctionLog.captured_at.desc()).first()

    history = db.query(models.AuctionLog).filter(
        models.AuctionLog.auction_id == auction_id
    ).order_by(models.AuctionLog.captured_at.desc()).limit(20).all()

    return {
        "auction_id": auction_id,
        "auction_title": auction.title,
        "auction_status": auction.status,
        "current_lot": latest_log.lot_number if latest_log else None,
        "current_price": latest_log.price if latest_log else None,
        "current_category": latest_log.category if latest_log else None,
        "current_description": latest_log.description if latest_log else None,
        "current_age": latest_log.age if latest_log else None,
        "frame_image": latest_log.frame_image if latest_log else None,
        "last_updated": latest_log.captured_at.isoformat() if latest_log else None,
        "history": [
            {
                "id": log.id,
                "lot_number": log.lot_number,
                "price": log.price,
                "category": log.category,
                "description": log.description,
                "status": log.status,
                "captured_at": log.captured_at.isoformat() if log.captured_at else None
            } for log in history
        ]
    }

@app.get("/api/live/channel/{channel_name}")
def get_live_by_channel(channel_name: str, db: Session = Depends(get_db)):
    """Retorna estado ao vivo por nome do canal/template (compatibilidade com Admin Local)."""
    latest_log = db.query(models.AuctionLog).filter(
        models.AuctionLog.channel_name == channel_name
    ).order_by(models.AuctionLog.captured_at.desc()).first()

    history = db.query(models.AuctionLog).filter(
        models.AuctionLog.channel_name == channel_name
    ).order_by(models.AuctionLog.captured_at.desc()).limit(20).all()

    return {
        "channel_name": channel_name,
        "current_lot": latest_log.lot_number if latest_log else None,
        "current_price": latest_log.price if latest_log else None,
        "current_category": latest_log.category if latest_log else None,
        "current_description": latest_log.description if latest_log else None,
        "frame_image": latest_log.frame_image if latest_log else None,
        "last_updated": latest_log.captured_at.isoformat() if latest_log else None,
        "history": history
    }


# ══════════════════════════════════════════════════════════════════════════════
# CAPTURA DO CLIENTE MOBILE — print do celular → Gemini Vision
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/client/frame")
async def process_client_frame(
    req: ClientFrameRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    """
    Recebe um print/foto do celular do cliente e processa via Gemini Vision.
    A VPS faz apenas uma chamada HTTP ao Google — SEM PyTorch, SEM OpenCV local.
    O resultado é retornado ao cliente e opcionalmente salvo como log.
    """
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Imagem base64 não fornecida.")

    res = await gemini_vision.analyze_auction_frame(req.image_base64, req.api_key)

    if not res.get("success"):
        return {
            "status": "error",
            "detail": res.get("error", "Falha ao processar imagem com Gemini Vision."),
            "data": None
        }

    data = res.get("data", {})

    # Salva a captura do cliente para auditoria
    capture = models.ClientFrameCapture(
        user_id=current_user.id if current_user else None,
        auction_id=req.auction_id,
        gemini_result=data
    )
    db.add(capture)
    db.commit()

    return {
        "status": "success",
        "is_auction_screen": data.get("is_auction_screen", False),
        "lot_number": data.get("lot_number", ""),
        "price": data.get("price", ""),
        "description": data.get("description", ""),
        "category": data.get("category", "Geral"),
        "quantity": data.get("quantity", ""),
        "weight": data.get("weight", ""),
        "seller": data.get("seller", ""),
        "location": data.get("location", ""),
        "confidence": data.get("confidence", 0.0)
    }


# ══════════════════════════════════════════════════════════════════════════════
# LEILÕES — leitura para clientes
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/auctions")
def list_auctions(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    if current_user and current_user.role in ("admin",):
        return db.query(models.Auction).all()
    elif current_user and current_user.accessible_auctions:
        return current_user.accessible_auctions
    # Retorna leilões públicos (sem restrição de acesso configurada)
    return db.query(models.Auction).all()

@app.get("/api/auctions/{auction_id}")
def get_auction(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")
    if (current_user.role not in ("admin",) and
            auction.allowed_users and
            current_user not in auction.allowed_users):
        raise HTTPException(status_code=403, detail="Acesso negado a este leilão")
    return auction

@app.get("/api/auctions/{auction_id}/public")
def get_public_auction(auction_id: int, db: Session = Depends(get_db)):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")
    return {
        "id": auction.id, "title": auction.title, "description": auction.description,
        "start_date": auction.start_date, "status": auction.status,
        "logo_url": auction.logo_url, "banner_url": auction.banner_url,
        "auctioneer_name": auction.auctioneer_name,
        "address_city": auction.address_city, "address_state": auction.address_state,
        "phone_primary": auction.phone_primary, "phone_whatsapp": auction.phone_whatsapp,
        "website_url": auction.website_url, "social_instagram": auction.social_instagram,
    }


# ══════════════════════════════════════════════════════════════════════════════
# LOGS — histórico e exportação
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/logs")
def get_logs(
    channel_name: Optional[str] = None,
    auction_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AuctionLog)
    if auction_id:
        query = query.filter(models.AuctionLog.auction_id == auction_id)
    if channel_name:
        query = query.filter(models.AuctionLog.channel_name == channel_name)
    return query.order_by(models.AuctionLog.captured_at.desc()).limit(100).all()

@app.put("/api/logs/{log_id}")
def update_log(log_id: int, data: AuctionLogUpdate, db: Session = Depends(get_db)):
    log = db.query(models.AuctionLog).filter(models.AuctionLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log não encontrado.")
    if data.status is not None: log.status = data.status
    if data.price is not None: log.price = data.price
    if data.description is not None: log.description = data.description
    if data.lot_number is not None: log.lot_number = data.lot_number
    if data.category is not None: log.category = data.category
    if data.notes is not None: log.notes = data.notes
    db.commit()
    db.refresh(log)
    return log

@app.delete("/api/logs/clear/all")
def clear_logs(
    channel_name: Optional[str] = None,
    auction_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    query = db.query(models.AuctionLog)
    if auction_id:
        query = query.filter(models.AuctionLog.auction_id == auction_id)
    if channel_name:
        query = query.filter(models.AuctionLog.channel_name == channel_name)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "deleted_count": deleted}

@app.get("/api/logs/export")
def export_logs_csv(
    channel_name: Optional[str] = None,
    auction_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AuctionLog)
    if auction_id:
        query = query.filter(models.AuctionLog.auction_id == auction_id)
    if channel_name:
        query = query.filter(models.AuctionLog.channel_name == channel_name)
    logs = query.order_by(models.AuctionLog.captured_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Canal/Leiloeira", "Lote", "Categoria", "Descrição",
                     "Idade/Peso", "Preço Final", "Status", "Comentários", "Data/Horário"])
    for log in logs:
        writer.writerow([
            log.id, log.channel_name, log.lot_number or "", log.category or "",
            log.description or "", log.age or "", log.price or "",
            log.status or "Arrematado", log.notes or "",
            log.captured_at.strftime("%d/%m/%Y %H:%M:%S") if log.captured_at else ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=relatorio_{channel_name or auction_id or 'geral'}.csv"}
    )


# ══════════════════════════════════════════════════════════════════════════════
# USUÁRIOS (para o Admin gerenciar via push)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/users")
def list_users(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role, "created_at": u.created_at,
            "accessible_auction_ids": [a.id for a in u.accessible_auctions]
        } for u in users
    ]


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0.0", "mode": "vps-relay"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
