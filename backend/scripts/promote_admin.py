from database import SessionLocal
from models import User

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "desafyo@gmail.com").first()
    if user:
        user.role = "admin"
        db.commit()
        print(f"Sucesso: O usuario {user.email} agora e {user.role}!")
    else:
        print("Erro: Usuario nao encontrado.")
except Exception as e:
    print(f"Erro: {e}")
finally:
    db.close()
