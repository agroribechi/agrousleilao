from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# Tabela de relacionamento many-to-many entre leilões e usuários
auction_users = Table('auction_users', Base.metadata,
    Column('auction_id', Integer, ForeignKey('auctions.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    supabase_uid = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    document = Column(String, nullable=True)
    role = Column(String, default="user")  # 'admin', 'user', 'client'
    created_at = Column(DateTime, default=datetime.utcnow)

    accessible_auctions = relationship("Auction", secondary=auction_users, back_populates="allowed_users")

class Auction(Base):
    __tablename__ = "auctions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=False)
    status = Column(String, default="Agendado")  # 'Agendado', 'Ao Vivo', 'Encerrado'
    created_at = Column(DateTime, default=datetime.utcnow)

    logo_url = Column(Text, nullable=True)
    banner_url = Column(Text, nullable=True)
    auctioneer_name = Column(String, nullable=True)

    address_street = Column(String, nullable=True)
    address_city = Column(String, nullable=True)
    address_state = Column(String, nullable=True)
    address_zip = Column(String, nullable=True)

    phone_primary = Column(String, nullable=True)
    phone_whatsapp = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    social_instagram = Column(String, nullable=True)

    payment_status = Column(String, default="Gratuito")
    plan_tier = Column(String, default="Gratuito")
    promotion_expires_at = Column(DateTime, nullable=True)

    template_id = Column(Integer, nullable=True)

    items = relationship("AuctionItem", back_populates="auction")
    allowed_users = relationship("User", secondary=auction_users, back_populates="accessible_auctions")
    logs = relationship("AuctionLog", back_populates="auction", foreign_keys="AuctionLog.auction_id")


class AuctionItem(Base):
    __tablename__ = "auction_items"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    lot_number = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    starting_bid = Column(Float, nullable=False, default=0.0)
    current_bid = Column(Float, nullable=True)
    status = Column(String, default="Aberto")

    auction = relationship("Auction", back_populates="items")


class AuctionLog(Base):
    """
    Log de lotes capturados pelo Admin Local via OCR/Gemini.
    Cada entrada representa um lote detectado durante a transmissão.
    """
    __tablename__ = "auction_logs"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=True)
    channel_name = Column(String, index=True, nullable=False)
    video_url = Column(String, nullable=True)
    lot_number = Column(String, nullable=True)
    category = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    age = Column(String, nullable=True)
    price = Column(String, nullable=True)
    status = Column(String, default="Em Andamento")
    notes = Column(Text, nullable=True)
    frame_image = Column(Text, nullable=True)  # base64 thumbnail
    extracted_data = Column(JSON, nullable=True)
    captured_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", back_populates="logs", foreign_keys=[auction_id])


class ClientFrameCapture(Base):
    """
    Print enviado pelo celular do cliente para análise via Gemini Vision.
    """
    __tablename__ = "client_frame_captures"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=True)
    frame_image = Column(Text, nullable=True)  # base64
    gemini_result = Column(JSON, nullable=True)  # resultado do Gemini Vision
    created_at = Column(DateTime, default=datetime.utcnow)
