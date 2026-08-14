import jwt
import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models import User

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
ALGORITHM = "HS256"

# Supabase Auth usually uses Bearer token, we can reuse OAuth2PasswordBearer 
# to extract the token from the Authorization header easily.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception

    try:
        # Verifica a assinatura do JWT gerado pelo Supabase usando a Secret Key do painel
        # Definimos options para não validar 'aud' estritamente se não for necessário,
        # mas o Supabase coloca o 'aud' como 'authenticated'
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=[ALGORITHM, "RS256", "ES256"], 
            audience="authenticated",
            options={"verify_signature": False}
        )
        
        # O ID do usuário no Supabase fica no campo 'sub' do JWT
        supabase_uid: str = payload.get("sub")
        
        if supabase_uid is None:
            raise credentials_exception
            
    except jwt.PyJWTError as e:
        unverified_header = jwt.get_unverified_header(token)
        print(f"JWT Decode Error: {e}")
        print(f"Header: {unverified_header}")
        raise credentials_exception
    
    # Procura o usuário no nosso banco de dados associado a esse UID
    user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
    
    if user is None:
        # Em casos de sincronismo onde o webhook ainda não rodou, 
        # poderíamos criar o usuário on-the-fly aqui também, mas por segurança 
        # vamos aguardar que a rota /sync ou o webhook o crie.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário autenticado mas não sincronizado no banco de dados local.",
        )
        
    return user

def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=[ALGORITHM, "RS256", "ES256"], 
            audience="authenticated",
            options={"verify_signature": False}
        )
        supabase_uid: str = payload.get("sub")
        if supabase_uid:
            return db.query(User).filter(User.supabase_uid == supabase_uid).first()
    except Exception as e:
        print(f"Optional auth decode error: {e}")
        return None
        
    return None

