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
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM, "RS256", "ES256"],
            audience="authenticated",
            options={"verify_signature": False}
        )
        supabase_uid: str = payload.get("sub")
        if supabase_uid is None:
            raise credentials_exception
    except jwt.PyJWTError as e:
        print(f"[VPS Auth] JWT Error: {e}")
        raise credentials_exception

    user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não sincronizado no banco.",
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
        print(f"[VPS Auth] Optional decode error: {e}")
    return None
