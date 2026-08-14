import sys
import os
from datetime import datetime, timedelta

# Garante que o diretório atual está no path para os imports funcionarem
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User, Auction, AuctionItem

def run_test():
    print("Iniciando Teste de Fumaça no Supabase...")
    db = SessionLocal()
    
    try:
        # 1. Testando Inserção de Usuário
        email_teste = f"teste_{datetime.now().strftime('%Y%m%d%H%M%S')}@leilao.com"
        print(f"-> Criando usuário: {email_teste}")
        
        novo_usuario = User(
            email=email_teste,
            full_name="Usuário de Teste Supabase",
            phone="11999999999",
            document="12345678909",
            role="user"
        )
        db.add(novo_usuario)
        db.flush() # Para pegar o ID gerado sem fazer commit definitivo ainda
        
        print(f"-> Usuário criado com Sucesso! ID: {novo_usuario.id}")
        
        # 2. Testando Inserção de Leilão e Lote
        print("-> Criando Leilão de Teste...")
        novo_leilao = Auction(
            title="Leilão de Teste Automatizado",
            description="Criado via script de validação.",
            start_date=datetime.utcnow() + timedelta(days=1),
            status="Agendado"
        )
        db.add(novo_leilao)
        db.flush()
        
        print(f"-> Leilão criado com Sucesso! ID: {novo_leilao.id}")
        
        novo_lote = AuctionItem(
            auction_id=novo_leilao.id,
            lot_number="001",
            title="Lote de Teste 01",
            description="Um lote gerado automaticamente",
            starting_bid=100.0,
            status="Aberto"
        )
        db.add(novo_lote)
        
        # 3. Comitando (salvando de vez no Supabase)
        db.commit()
        print("\n[OK] TESTE CONCLUIDO COM SUCESSO! Dados foram gravados no Supabase.")
        
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] NO TESTE: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
