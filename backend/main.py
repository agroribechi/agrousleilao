from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import base64
import cv2
import numpy as np

from database import engine, Base, get_db, SessionLocal
import models
from auth import (
    get_current_user,
    get_optional_current_user
)
from sqlalchemy.orm.attributes import flag_modified
from stream_service import fetch_youtube_frame
from ocr_engine import run_ocr_on_rois
import gemini_vision
import vps_client

# Migração de colunas e criação de tabelas no banco de dados
def auto_migrate_schema():
    from sqlalchemy import text
    for stmt in [
        "ALTER TABLE templates ADD COLUMN video_url VARCHAR;",
        "ALTER TABLE templates ADD COLUMN logo_url VARCHAR;",
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
        "ALTER TABLE auction_logs ADD COLUMN frame_image TEXT;"
    ]:
        try:
            with engine.connect() as conn:
                conn.execute(text(stmt))
                conn.commit()
        except Exception:
            pass # Coluna já existe

auto_migrate_schema()
models.Base.metadata.create_all(bind=engine)

def import_legacy_templates():
    import json, os
    legacy_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "leiloes_config_v12.json")
    if os.path.exists(legacy_file):
        try:
            with open(legacy_file, "r") as f:
                data = json.load(f)
            db = SessionLocal()
            try:
                for name, fields in data.items():
                    existing = db.query(models.Template).filter(models.Template.name == name).first()
                    if not existing:
                        new_t = models.Template(name=name, fields=fields)
                        db.add(new_t)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print("Erro ao migrar templates legados:", e)

import_legacy_templates()

app = FastAPI(
    title="Leilão IA - Backend Platform",
    version="2.0.0",
    description="API para calibração, OCR e gestão de leilões"
)

# Habilita CORS para conexão com o Frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS (Pydantic) ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class FrameRequest(BaseModel):
    url: str
    minutes: int = 0
    seconds: int = 0

class OCRTestRequest(BaseModel):
    url: Optional[str] = None
    minutes: int = 0
    seconds: int = 0
    image_base64: Optional[str] = None
    fields: List[Dict[str, Any]]

class VisionFrameRequest(BaseModel):
    image_base64: str
    api_key: Optional[str] = None
    auction_id: Optional[int] = None
    channel_name: Optional[str] = "Geral"
    is_live: Optional[bool] = True
    filter_categories: Optional[List[str]] = []

class TemplateCreate(BaseModel):
    name: str
    video_url: Optional[str] = None
    logo_url: Optional[str] = None
    fields: List[Dict[str, Any]]

class AuctionLogCreate(BaseModel):
    channel_name: str
    video_url: Optional[str] = None
    lot_number: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    age: Optional[str] = None
    price: Optional[str] = None
    status: Optional[str] = "Em Andamento"
    notes: Optional[str] = None
    frame_image: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None

class AuctionCreate(BaseModel):
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
    promotion_expires_at: Optional[datetime] = None
    template_id: Optional[int] = None

class AuctionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    status: Optional[str] = None
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
    payment_status: Optional[str] = None
    plan_tier: Optional[str] = None
    promotion_expires_at: Optional[datetime] = None
    template_id: Optional[int] = None

class AuctionResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    start_date: datetime
    status: str
    created_at: datetime
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
    promotion_expires_at: Optional[datetime] = None
    template_id: Optional[int] = None

    class Config:
        from_attributes = True

class AuctionItemCreate(BaseModel):
    lot_number: str
    title: str
    description: Optional[str] = None
    starting_bid: float = 0.0

class AuctionItemResponse(BaseModel):
    id: int
    auction_id: int
    lot_number: str
    title: str
    description: Optional[str] = None
    starting_bid: float
    current_bid: Optional[float] = None
    status: str
    class Config:
        from_attributes = True
        
class AuctionDetailResponse(AuctionResponse):
    items: List[AuctionItemResponse] = []
    allowed_user_ids: List[int] = []

class AuctionAccessRequest(BaseModel):
    user_ids: List[int]

class UserAccessRequest(BaseModel):
    auction_ids: List[int]

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    document: Optional[str] = None
    role: Optional[str] = None




# --- ROTAS DE AUTENTICAÇÃO SUPABASE ---

class SyncUserRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    supabase_uid: str

@app.post("/api/auth/sync")
def sync_user(user_data: SyncUserRequest, db: Session = Depends(get_db)):
    # Essa rota é chamada pelo Frontend logo após um cadastro com sucesso no Supabase Auth.
    # Serve para garantir que o usuário existe na nossa tabela do Postgres.
    existing_user = db.query(models.User).filter(
        (models.User.supabase_uid == user_data.supabase_uid) | 
        (models.User.email == user_data.email)
    ).first()

    # Se não existe nenhum admin no sistema, promove o usuário atual a admin
    admin_count = db.query(models.User).filter(models.User.role == "admin").count()

    if existing_user:
        # Se já existe, atualizamos o UID se necessário e promovemos a admin se for o único/primeiro usuário
        if not existing_user.supabase_uid:
            existing_user.supabase_uid = user_data.supabase_uid
        if admin_count == 0:
            existing_user.role = "admin"
        db.commit()
        db.refresh(existing_user)
        return {"status": "already_synced", "user": {"id": existing_user.id, "email": existing_user.email, "role": existing_user.role, "full_name": existing_user.full_name}}

    initial_role = "admin" if admin_count == 0 else "user"
    new_user = models.User(
        supabase_uid=user_data.supabase_uid,
        email=user_data.email,
        full_name=user_data.full_name,
        role=initial_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"status": "synced", "user": {"id": new_user.id, "email": new_user.email, "role": new_user.role, "full_name": new_user.full_name}}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "supabase_uid": current_user.supabase_uid,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role
    }


# --- ROTAS DE LEILÕES E LOTES ---

def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return current_user

@app.post("/api/auctions", response_model=AuctionResponse)
def create_auction(
    data: AuctionCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    new_auction = models.Auction(**data.model_dump())
    if current_user.role != "admin":
        new_auction.allowed_users.append(current_user)
    db.add(new_auction)
    db.commit()
    db.refresh(new_auction)
    return new_auction

@app.get("/api/auctions", response_model=List[AuctionResponse])
def list_auctions(
    db: Session = Depends(get_db), 
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    if current_user and current_user.role == "admin":
        return db.query(models.Auction).all()
    elif current_user and current_user.accessible_auctions:
        return current_user.accessible_auctions
    else:
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
    
    if current_user.role != "admin" and auction not in current_user.accessible_auctions:
        raise HTTPException(status_code=403, detail="Acesso negado a este leilão")
        
    return {
        "id": auction.id,
        "title": auction.title,
        "description": auction.description,
        "start_date": auction.start_date,
        "status": auction.status,
        "created_at": auction.created_at,
        "logo_url": auction.logo_url,
        "banner_url": auction.banner_url,
        "auctioneer_name": auction.auctioneer_name,
        "address_street": auction.address_street,
        "address_city": auction.address_city,
        "address_state": auction.address_state,
        "address_zip": auction.address_zip,
        "phone_primary": auction.phone_primary,
        "phone_whatsapp": auction.phone_whatsapp,
        "website_url": auction.website_url,
        "social_instagram": auction.social_instagram,
        "payment_status": auction.payment_status,
        "plan_tier": auction.plan_tier,
        "promotion_expires_at": auction.promotion_expires_at,
        "template_id": auction.template_id,
        "items": auction.items,
        "allowed_user_ids": [u.id for u in auction.allowed_users]
    }

@app.get("/api/auctions/{auction_id}/public")
def get_public_auction(
    auction_id: int, 
    db: Session = Depends(get_db)
):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")
        
    template_data = None
    if auction.template_id:
        t = db.query(models.Template).filter(models.Template.id == auction.template_id).first()
        if t:
            template_data = { "id": t.id, "name": t.name, "video_url": t.video_url, "logo_url": t.logo_url }

    return {
        "id": auction.id,
        "title": auction.title,
        "description": auction.description,
        "start_date": auction.start_date,
        "status": auction.status,
        "created_at": auction.created_at,
        "logo_url": auction.logo_url,
        "banner_url": auction.banner_url,
        "auctioneer_name": auction.auctioneer_name,
        "address_street": auction.address_street,
        "address_city": auction.address_city,
        "address_state": auction.address_state,
        "address_zip": auction.address_zip,
        "phone_primary": auction.phone_primary,
        "phone_whatsapp": auction.phone_whatsapp,
        "website_url": auction.website_url,
        "social_instagram": auction.social_instagram,
        "payment_status": auction.payment_status,
        "plan_tier": auction.plan_tier,
        "promotion_expires_at": auction.promotion_expires_at,
        "template_id": auction.template_id,
        "template": template_data,
        "items": auction.items
    }

@app.put("/api/auctions/{auction_id}")
def update_auction(
    auction_id: int,
    data: AuctionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")

    update_dict = data.model_dump(exclude_unset=True)
    for key, val in update_dict.items():
        setattr(auction, key, val)

    db.commit()
    db.refresh(auction)
    return auction

@app.delete("/api/auctions/{auction_id}")
def delete_auction(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")
    
    # Remove lotes associados
    db.query(models.AuctionItem).filter(models.AuctionItem.auction_id == auction_id).delete()
    # Limpa permissões de acesso
    auction.allowed_users = []
    db.commit()
    # Exclui o leilão
    db.delete(auction)
    db.commit()
    return {"status": "success", "message": f"Leilão '{auction.title}' excluído com sucesso."}

@app.post("/api/auctions/{auction_id}/items", response_model=AuctionItemResponse)
def add_auction_item(
    auction_id: int, 
    data: AuctionItemCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_admin)
):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")
    
    new_item = models.AuctionItem(**data.model_dump(), auction_id=auction_id)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.post("/api/auctions/{auction_id}/access")
def manage_auction_access(
    auction_id: int, 
    data: AuctionAccessRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_admin)
):
    auction = db.query(models.Auction).filter(models.Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado")
    
    users = db.query(models.User).filter(models.User.id.in_(data.user_ids)).all()
    auction.allowed_users = users
    db.commit()
    return {"status": "success", "message": "Acessos atualizados com sucesso"}
    
@app.get("/api/users")
def list_users(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_admin)
):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id, 
            "email": u.email, 
            "full_name": u.full_name, 
            "phone": u.phone,
            "document": u.document,
            "role": u.role,
            "created_at": u.created_at,
            "accessible_auction_ids": [a.id for a in u.accessible_auctions]
        } for u in users
    ]

@app.get("/api/users/{user_id}/access")
def get_user_access(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "accessible_auction_ids": [a.id for a in user.accessible_auctions]
    }

@app.post("/api/users/{user_id}/access")
def update_user_access(
    user_id: int,
    data: UserAccessRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    auctions = db.query(models.Auction).filter(models.Auction.id.in_(data.auction_ids)).all()
    user.accessible_auctions = auctions
    db.commit()
    return {
        "status": "success", 
        "message": f"Acessos atualizados com sucesso para {user.full_name or user.email}",
        "accessible_auction_ids": [a.id for a in user.accessible_auctions]
    }

@app.put("/api/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    update_dict = data.model_dump(exclude_unset=True)
    for key, val in update_dict.items():
        setattr(user, key, val)

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "document": user.document,
        "role": user.role
    }


# --- ROTAS DE STREAM E VÍDEO ---

@app.post("/api/stream/frame")
def get_frame(req: FrameRequest):
    frame_bgr, base64_img, msg = fetch_youtube_frame(req.url, req.minutes, req.seconds)
    if frame_bgr is None:
        raise HTTPException(status_code=400, detail=msg)

    h, w = frame_bgr.shape[:2]
    return {
        "status": "success",
        "image": base64_img,
        "width": w,
        "height": h
    }


# --- ROTAS DE OCR ---

@app.post("/api/ocr/read")
def read_ocr(req: OCRTestRequest):
    frame_bgr = None

    if req.image_base64:
        try:
            # Remove cabeçalho se houver
            raw_b64 = req.image_base64.split(",")[-1]
            img_bytes = base64.b64decode(raw_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    elif req.url:
        frame_bgr, _, msg = fetch_youtube_frame(req.url, req.minutes, req.seconds)
        if frame_bgr is None:
            raise HTTPException(status_code=400, detail=msg)

    if frame_bgr is None:
        raise HTTPException(status_code=400, detail="Nenhuma imagem ou URL fornecida.")

    ocr_results, debug_crops = run_ocr_on_rois(frame_bgr, req.fields, bypass_cache=True, return_crops=True)
    return {
        "status": "success",
        "results": ocr_results,
        "debug_crops": debug_crops
    }


# --- ROTA DE VISÃO INTELIGENTE GEMINI 2.0 FLASH (ZERO CALIBRAÇÃO) ---

@app.post("/api/vision/read-frame")
async def vision_read_frame(req: VisionFrameRequest, db: Session = Depends(get_db)):
    """
    Recebe um frame do leilão e processa via Gemini 2.0 Flash Vision
    sem necessidade de calibração prévia de coordenadas ou caixas.
    """
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Imagem em base64 não fornecida.")

    res = await gemini_vision.analyze_auction_frame(req.image_base64, req.api_key)
    if not res.get("success"):
        return {
            "status": "error",
            "detail": res.get("error", "Erro ao processar visão do Gemini"),
            "data": None
        }

    data = res.get("data", {})
    is_auction = data.get("is_auction_screen", False)
    lot_number = str(data.get("lot_number", "")).strip() if data.get("lot_number") is not None else ""
    price = str(data.get("price", "")).strip() if data.get("price") is not None else ""
    category = str(data.get("category", "Geral")).strip() if data.get("category") is not None else "Geral"
    desc = str(data.get("description", "")).strip() if data.get("description") is not None else ""

    alert_triggered = False
    if req.filter_categories and category:
        for cat in req.filter_categories:
            if cat.lower() in category.lower() or cat.lower() in desc.lower():
                alert_triggered = True
                break

    # Constrói log se for tela de leilão válida ou se houver dados parciais
    current_log = {
        "lot_number": lot_number or "---",
        "price": price or "---",
        "category": category or "Geral",
        "description": desc or "Lote em transmissão",
        "status": "Em Andamento",
        "created_at": datetime.utcnow().isoformat()
    }

    if is_auction and (lot_number or price):
        try:
            log_entry = models.AuctionLog(
                auction_id=req.auction_id,
                channel_name=req.channel_name or "Geral",
                lot_number=lot_number or "---",
                price=price or "---",
                category=category or "Geral",
                description=desc,
                captured_at=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            current_log["id"] = log_entry.id
        except Exception as e:
            print(f"[Vision Log] Erro ao gravar log: {e}")

    return {
        "status": "success",
        "is_auction_screen": is_auction,
        "lot_number": lot_number,
        "price": price,
        "category": category,
        "description": desc,
        "quantity": data.get("quantity", ""),
        "weight": data.get("weight", ""),
        "seller": data.get("seller", ""),
        "location": data.get("location", ""),
        "confidence": data.get("confidence", 0.95),
        "alert_triggered": alert_triggered,
        "current_log": current_log
    }


# --- ROTAS DE TEMPLATES (CANAISE/LEILOEIRAS) ---

@app.get("/api/templates")
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(models.Template).all()
    return templates

@app.post("/api/templates")
def save_template(
    t_data: TemplateCreate, 
    db: Session = Depends(get_db), 
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else None
    existing = db.query(models.Template).filter(models.Template.name == t_data.name).first()
    if existing:
        existing.fields = t_data.fields
        flag_modified(existing, "fields")
        if t_data.video_url is not None:
            existing.video_url = t_data.video_url
        if t_data.logo_url is not None:
            existing.logo_url = t_data.logo_url
        if user_id:
            existing.user_id = user_id
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_template = models.Template(
            name=t_data.name,
            video_url=t_data.video_url,
            logo_url=t_data.logo_url,
            fields=t_data.fields,
            user_id=user_id
        )
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        return new_template

@app.delete("/api/templates/{template_id}")
def delete_template(
    template_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    db.delete(template)
    db.commit()
    return {"status": "success", "message": "Template excluído com sucesso."}


# --- ROTAS DE PROCESSO AO VIVO E ALERTAS ---

from fastapi.responses import Response
import csv, io

class LiveProcessRequest(BaseModel):
    url: Optional[str] = None
    template_name: str
    minutes: int = 0
    seconds: int = 0
    is_live: bool = True
    filter_categories: List[str] = []
    image_base64: Optional[str] = None

class AuctionLogUpdate(BaseModel):
    status: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    lot_number: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    frame_image: Optional[str] = None


@app.post("/api/live/process")
def process_live_frame(req: LiveProcessRequest, db: Session = Depends(get_db)):
    import time, re
    t_start = time.time()

    template = db.query(models.Template).filter(models.Template.name == req.template_name).first()
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{req.template_name}' não encontrado.")

    frame_bgr = None
    if req.image_base64:
        try:
            raw_b64 = req.image_base64.split(",")[-1]
            img_bytes = base64.b64decode(raw_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            pass

    msg = "Imagem não fornecida."
    if frame_bgr is None and req.url:
        frame_bgr, _, msg = fetch_youtube_frame(req.url, req.minutes, req.seconds, is_live=req.is_live)

    if frame_bgr is None:
        raise HTTPException(status_code=400, detail=f"Não foi possível capturar a imagem do vídeo: {msg}")

    ocr_results = run_ocr_on_rois(frame_bgr, template.fields)

    lot_num = ""
    desc = ""
    age = ""
    price = ""

    for k, v in ocr_results.items():
        k_lower = k.lower()
        if any(l in k_lower for l in ["lote", "lot", "nº", "num", "item"]):
            cleaned_lot = re.sub(r'^(lote|lot|nº|num|#)\s*', '', v.strip(), flags=re.IGNORECASE)
            lot_num = cleaned_lot if cleaned_lot else v.strip()
        elif "desc" in k_lower or "animal" in k_lower or "raça" in k_lower or "raca" in k_lower or "cat" in k_lower:
            desc = v.strip()
        elif "idade" in k_lower or "peso" in k_lower:
            age = v.strip()
        elif "preç" in k_lower or "preco" in k_lower or "valor" in k_lower or "lance" in k_lower:
            price = v.strip()

    field_vals = list(ocr_results.values())
    non_empty_vals = [v.strip() for v in field_vals if v.strip()]
    if not lot_num and non_empty_vals:
        lot_num = non_empty_vals[0]

    # Checa match de categoria para disparar alerta
    full_text = " ".join([f"{k}: {v}" for k, v in ocr_results.items()]).lower()
    alert_triggered = False
    matched_category = ""

    for cat in req.filter_categories:
        if cat.strip() and cat.strip().lower() in full_text:
            alert_triggered = True
            matched_category = cat.strip()
            break

    # Busca último log cadastrado do canal
    last_log = db.query(models.AuctionLog).filter(
        models.AuctionLog.channel_name == req.template_name
    ).order_by(models.AuctionLog.created_at.desc()).first()

    lot_changed = False
    current_log = None

    if lot_num and lot_num != "Lote Em Leitura":
        if not last_log or last_log.lot_number != lot_num:
            if last_log and last_log.status == "Em Andamento":
                last_log.status = "Arrematado"
                db.commit()

            lot_changed = True
            current_log = models.AuctionLog(
                channel_name=req.template_name,
                video_url=req.url or template.video_url,
                lot_number=lot_num,
                category=matched_category if matched_category else "Geral",
                description=desc or "Lote em andamento",
                age=age,
                price=price or "R$ ---",
                status="Em Andamento",
                extracted_data=ocr_results
            )
            db.add(current_log)
            db.commit()
            db.refresh(current_log)
        else:
            # Lote é o mesmo: atualiza os campos com a leitura do frame atual em tempo real
            if price: last_log.price = price
            if desc: last_log.description = desc
            if age: last_log.age = age
            if matched_category: last_log.category = matched_category
            last_log.extracted_data = ocr_results
            db.commit()
            db.refresh(last_log)
            current_log = last_log
    elif last_log:
        # Se o campo lote não foi lido com clareza neste frame, atualiza o preço/descrição se lidos
        if price: last_log.price = price
        if desc: last_log.description = desc
        if age: last_log.age = age
        if matched_category: last_log.category = matched_category
        last_log.extracted_data = ocr_results
        db.commit()
        db.refresh(last_log)
        current_log = last_log
    else:
        # Se é o primeiro log de todos e ainda não leu lote
        current_log = models.AuctionLog(
            channel_name=req.template_name,
            video_url=req.url or template.video_url,
            lot_number="Aguardando Lote",
            category=matched_category if matched_category else "Geral",
            description=desc or "Lendo transmissão...",
            age=age,
            price=price or "R$ ---",
            status="Em Andamento",
            extracted_data=ocr_results
        )
        db.add(current_log)
        db.commit()
        db.refresh(current_log)

    history = db.query(models.AuctionLog).filter(
        models.AuctionLog.channel_name == req.template_name
    ).order_by(models.AuctionLog.created_at.desc()).limit(50).all()

    # Converte frame para JPEG Base64 leve para envio ao Frontend
    frame_image_b64 = ""
    try:
        _, buffer = cv2.imencode('.jpg', frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 75])
        frame_image_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
    except Exception:
        pass

    elapsed_ms = int((time.time() - t_start) * 1000)

    return {
        "status": "success",
        "frame_image": frame_image_b64,
        "ocr_data": ocr_results,
        "lot_changed": lot_changed,
        "alert_triggered": alert_triggered,
        "matched_category": matched_category,
        "current_log": current_log,
        "history": history,
        "processing_time_ms": elapsed_ms
    }


# --- ROTAS DE LOGS DE LEILÃO E EXPORTAÇÃO ---

@app.get("/api/logs")
def get_auction_logs(channel_name: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.AuctionLog)
    if channel_name:
        query = query.filter(models.AuctionLog.channel_name == channel_name)
    logs = query.order_by(models.AuctionLog.created_at.desc()).limit(50).all()
    return logs

@app.post("/api/logs")
def create_auction_log(data: AuctionLogCreate, db: Session = Depends(get_db)):
    new_log = models.AuctionLog(
        channel_name=data.channel_name,
        video_url=data.video_url,
        lot_number=data.lot_number or "1",
        category=data.category or "Geral",
        description=data.description or "Registro Manual / Print",
        age=data.age or "---",
        price=data.price or "R$ ---",
        status=data.status or "Em Andamento",
        notes=data.notes,
        frame_image=data.frame_image,
        extracted_data=data.extracted_data
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@app.get("/api/logs/export")
def export_auction_logs_csv(channel_name: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.AuctionLog)
    if channel_name:
        query = query.filter(models.AuctionLog.channel_name == channel_name)
    logs = query.order_by(models.AuctionLog.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Canal/Leiloeira", "Lote", "Categoria", "Descrição", "Idade/Peso", "Preço Final", "Status", "Comentários", "Data/Horário"])

    for log in logs:
        writer.writerow([
            log.id,
            log.channel_name,
            log.lot_number or "",
            log.category or "",
            log.description or "",
            log.age or "",
            log.price or "",
            log.status or "Arrematado",
            log.notes or "",
            log.created_at.strftime("%d/%m/%Y %H:%M:%S") if log.created_at else ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=relatorio_leilao_{channel_name or 'geral'}.csv"}
    )

@app.put("/api/logs/{log_id}")
def update_auction_log(log_id: int, data: AuctionLogUpdate, db: Session = Depends(get_db)):
    log = db.query(models.AuctionLog).filter(models.AuctionLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    if data.status is not None: log.status = data.status
    if data.price is not None: log.price = data.price
    if data.description is not None: log.description = data.description
    if data.lot_number is not None: log.lot_number = data.lot_number
    if data.category is not None: log.category = data.category
    if data.notes is not None: log.notes = data.notes
    if data.frame_image is not None: log.frame_image = data.frame_image
    db.commit()
    db.refresh(log)
    return log


@app.delete("/api/logs/clear/all")
def clear_all_auction_logs(channel_name: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.AuctionLog)
    if channel_name:
        query = query.filter(models.AuctionLog.channel_name == channel_name)
    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}

@app.delete("/api/logs/{log_id}")
def delete_auction_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(models.AuctionLog).filter(models.AuctionLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    db.delete(log)
    db.commit()
    return {"status": "success"}

# ══════════════════════════════════════════════════════════════════════════════
# ROTA DE TESTE DE OCR / CALIBRAÇÃO DE CAMPOS
# ══════════════════════════════════════════════════════════════════════════════

class OcrReadRequest(BaseModel):
    image_base64: str
    fields: List[Dict[str, Any]]
    return_crops: bool = True

@app.post("/api/ocr/read")
def read_ocr_fields(req: OcrReadRequest):
    """
    Executa OCR sobre as regiões calibradas (ROIs) enviadas pelo frontend.
    Usado no Calibrador e no teste em tempo real.
    """
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Imagem não fornecida.")
    if not req.fields:
        raise HTTPException(status_code=400, detail="Nenhum campo fornecido para leitura.")

    try:
        raw_b64 = req.image_base64.split(",")[-1]
        img_bytes = base64.b64decode(raw_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame_bgr is None:
            raise ValueError("Falha ao decodificar imagem.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar imagem base64: {e}")

    results, crops = run_ocr_on_rois(
        frame_bgr,
        req.fields,
        bypass_cache=True,
        return_crops=True
    )

    return {
        "status": "success",
        "results": results,
        "debug_crops": crops
    }

# ══════════════════════════════════════════════════════════════════════════════
# ROTAS DO ADMIN LOCAL — Captura + Gemini Vision + Push para VPS
# ══════════════════════════════════════════════════════════════════════════════

class LocalProcessRequest(BaseModel):
    """Requisição do painel admin para capturar um frame e enviar dados para a VPS."""
    url: Optional[str] = None
    template_name: str
    minutes: int = 0
    seconds: int = 0
    is_live: bool = True
    filter_categories: List[str] = []
    image_base64: Optional[str] = None   # Frame já capturado pelo frontend
    auction_id: Optional[int] = None
    api_key: Optional[str] = None
    use_gemini: bool = True              # True = Gemini Vision; False = EasyOCR (legado)

class PushAuctionToVpsRequest(BaseModel):
    auction_id: int  # ID do leilão local para sincronizar com VPS

class PushAccessToVpsRequest(BaseModel):
    auction_id: int
    user_emails: List[str]


@app.post("/api/local/process")
async def local_process(
    req: LocalProcessRequest,
    db: Session = Depends(get_db)
):
    """
    ─── ROTA PRINCIPAL DO ADMIN LOCAL ───
    1. Captura frame (ffmpeg/yt-dlp — roda na máquina local, não na VPS)
    2. Processa via Gemini Vision (HTTP) ou EasyOCR (fallback)
    3. Envia dados processados para a VPS via vps_client
    4. Retorna resultado para o painel admin
    """
    import time, re
    t_start = time.time()

    # ── 1. Obter o frame ──────────────────────────────────────────────────────
    frame_bgr = None
    frame_b64 = ""

    if req.image_base64:
        try:
            raw_b64 = req.image_base64.split(",")[-1]
            img_bytes = base64.b64decode(raw_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            frame_b64 = req.image_base64
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {e}")
    elif req.url:
        frame_bgr, frame_b64, msg = fetch_youtube_frame(
            req.url, req.minutes, req.seconds, is_live=req.is_live
        )
        if frame_bgr is None:
            raise HTTPException(status_code=400, detail=f"Não foi possível capturar frame: {msg}")
    else:
        raise HTTPException(status_code=400, detail="Forneça image_base64 ou url.")

    # ── 2. Processar via Gemini Vision (padrão) ou EasyOCR (legado) ──────────
    lot_number = ""
    price = ""
    description = ""
    category = "Geral"
    age = ""
    ocr_data = {}
    alert_triggered = False
    matched_category = ""

    if req.use_gemini:
        res = await gemini_vision.analyze_auction_frame(frame_b64, req.api_key)
        if res.get("success"):
            data = res.get("data", {})
            lot_number = str(data.get("lot_number", "")).strip()
            price = str(data.get("price", "")).strip()
            description = str(data.get("description", "")).strip()
            category = str(data.get("category", "Geral")).strip()
            age = str(data.get("weight", "")).strip()
            ocr_data = data
        else:
            # Fallback para EasyOCR se Gemini falhar
            template = db.query(models.Template).filter(
                models.Template.name == req.template_name
            ).first()
            if template:
                ocr_data = run_ocr_on_rois(frame_bgr, template.fields)
                for k, v in ocr_data.items():
                    k_lower = k.lower()
                    if any(l in k_lower for l in ["lote", "lot", "nº", "num"]):
                        lot_number = re.sub(r'^(lote|lot|nº|num|#)\s*', '', v.strip(), flags=re.IGNORECASE)
                    elif "desc" in k_lower or "animal" in k_lower:
                        description = v.strip()
                    elif "idade" in k_lower or "peso" in k_lower:
                        age = v.strip()
                    elif any(p in k_lower for p in ["preç", "preco", "valor", "lance"]):
                        price = v.strip()
    else:
        # Modo EasyOCR direto
        template = db.query(models.Template).filter(
            models.Template.name == req.template_name
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail=f"Template '{req.template_name}' não encontrado.")
        ocr_data = run_ocr_on_rois(frame_bgr, template.fields)
        for k, v in ocr_data.items():
            k_lower = k.lower()
            if any(l in k_lower for l in ["lote", "lot", "nº", "num"]):
                lot_number = re.sub(r'^(lote|lot|nº|num|#)\s*', '', v.strip(), flags=re.IGNORECASE)
            elif "desc" in k_lower or "animal" in k_lower:
                description = v.strip()
            elif "idade" in k_lower or "peso" in k_lower:
                age = v.strip()
            elif any(p in k_lower for p in ["preç", "preco", "valor", "lance"]):
                price = v.strip()

    # ── Verificar alerta de categoria ─────────────────────────────────────────
    full_text = f"{lot_number} {description} {category}".lower()
    for cat in req.filter_categories:
        if cat.strip() and cat.strip().lower() in full_text:
            alert_triggered = True
            matched_category = cat.strip()
            break

    # ── 3. Enviar para a VPS ──────────────────────────────────────────────────
    # Thumbnail comprimido para economizar banda
    thumb_b64 = ""
    try:
        _, buffer = cv2.imencode('.jpg', frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 60])
        thumb_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
    except Exception:
        pass

    vps_result = await vps_client.push_frame_data(
        template_name=req.template_name,
        ocr_data=ocr_data,
        lot_number=lot_number,
        price=price,
        description=description,
        category=category,
        age=age,
        frame_image=thumb_b64,
        auction_id=req.auction_id,
        video_url=req.url,
        filter_categories=req.filter_categories,
        alert_triggered=alert_triggered,
        matched_category=matched_category
    )

    elapsed_ms = int((time.time() - t_start) * 1000)

    return {
        "status": "success",
        "frame_image": thumb_b64,
        "ocr_data": ocr_data,
        "lot_number": lot_number,
        "price": price,
        "description": description,
        "category": category,
        "age": age,
        "alert_triggered": alert_triggered,
        "matched_category": matched_category,
        "vps_push": vps_result,
        "processing_time_ms": elapsed_ms
    }


@app.post("/api/local/push-auction")
async def push_auction_to_vps(
    req: PushAuctionToVpsRequest,
    db: Session = Depends(get_db)
):
    """Sincroniza um leilão do banco local para a VPS."""
    auction = db.query(models.Auction).filter(models.Auction.id == req.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado no banco local.")

    auction_data = {
        "title": auction.title,
        "description": auction.description,
        "start_date": auction.start_date.isoformat(),
        "status": auction.status,
        "logo_url": auction.logo_url,
        "banner_url": auction.banner_url,
        "auctioneer_name": auction.auctioneer_name,
        "address_street": auction.address_street,
        "address_city": auction.address_city,
        "address_state": auction.address_state,
        "address_zip": auction.address_zip,
        "phone_primary": auction.phone_primary,
        "phone_whatsapp": auction.phone_whatsapp,
        "website_url": auction.website_url,
        "social_instagram": auction.social_instagram,
        "payment_status": auction.payment_status,
        "plan_tier": auction.plan_tier,
    }
    result = await vps_client.push_auction(auction_data)
    return result


@app.post("/api/local/push-access")
async def push_access_to_vps(req: PushAccessToVpsRequest):
    """Define acesso de clientes (por email) a um leilão na VPS."""
    result = await vps_client.push_client_access(req.auction_id, req.user_emails)
    return result


@app.get("/api/vps/status")
def check_vps_status():
    """Verifica se a VPS está acessível e retorna status da conexão."""
    status = vps_client.get_vps_status()
    return status


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
