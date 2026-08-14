from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

auction_users = Table('auction_users', Base.metadata,
    Column('auction_id', Integer, ForeignKey('auctions.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Supabase Auth User ID (UUID string format)
    supabase_uid = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True) # Pode ser null se usar Auth do Supabase
    phone = Column(String, nullable=True)
    document = Column(String, nullable=True) # CPF ou CNPJ
    role = Column(String, default="user")  # 'admin', 'user'
    created_at = Column(DateTime, default=datetime.utcnow)

    templates = relationship("Template", back_populates="owner")
    addresses = relationship("Address", back_populates="user")
    bids = relationship("Bid", back_populates="user")
    accessible_auctions = relationship("Auction", secondary=auction_users, back_populates="allowed_users")

class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    zip_code = Column(String, nullable=False)
    street = Column(String, nullable=False)
    number = Column(String, nullable=False)
    complement = Column(String, nullable=True)
    neighborhood = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    
    user = relationship("User", back_populates="addresses")

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    video_url = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    fields = Column(JSON, nullable=False)  # List of dicts com coords
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="templates")

class Auction(Base):
    __tablename__ = "auctions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=False)
    status = Column(String, default="Agendado") # 'Agendado', 'Ao Vivo', 'Encerrado'
    created_at = Column(DateTime, default=datetime.utcnow)

    # Identificação & Mídia
    logo_url = Column(Text, nullable=True)
    banner_url = Column(Text, nullable=True)
    auctioneer_name = Column(String, nullable=True)
    
    # Endereço
    address_street = Column(String, nullable=True)
    address_city = Column(String, nullable=True)
    address_state = Column(String, nullable=True)
    address_zip = Column(String, nullable=True)
    
    # Contatos
    phone_primary = Column(String, nullable=True)
    phone_whatsapp = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    social_instagram = Column(String, nullable=True)
    
    # Pagamento & Divulgação Promovida
    payment_status = Column(String, default="Gratuito") # 'Gratuito', 'Pendente', 'Pago - Destaque', 'Expirado'
    plan_tier = Column(String, default="Gratuito") # 'Gratuito', 'Destaque Ouro', 'Patrocinado Premium'
    promotion_expires_at = Column(DateTime, nullable=True)
    
    # Vínculo com Gabarito ROI do Calibrador
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    template = relationship("Template")

    items = relationship("AuctionItem", back_populates="auction")
    allowed_users = relationship("User", secondary=auction_users, back_populates="accessible_auctions")


class AuctionItem(Base):
    __tablename__ = "auction_items"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    lot_number = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    starting_bid = Column(Float, nullable=False, default=0.0)
    current_bid = Column(Float, nullable=True)
    status = Column(String, default="Aberto") # 'Aberto', 'Vendido', 'Não Vendido'

    auction = relationship("Auction", back_populates="items")
    bids = relationship("Bid", back_populates="item")

class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("auction_items.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("AuctionItem", back_populates="bids")
    user = relationship("User", back_populates="bids")

# Mantemos a tabela antiga para compatibilidade com o OCR/logs
class AuctionLog(Base):
    __tablename__ = "auction_logs"

    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, index=True, nullable=False)
    video_url = Column(String, nullable=True)
    lot_number = Column(String, nullable=True)
    category = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    age = Column(String, nullable=True)
    price = Column(String, nullable=True)
    status = Column(String, default="Arrematado")
    notes = Column(Text, nullable=True)
    frame_image = Column(Text, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

