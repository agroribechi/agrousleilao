import urllib.request
import urllib.error
import json
import time
import socket

print("Enviando requisicao de teste para /api/auth/sync...")
start = time.time()
try:
    payload = {
        "email": "desafyo@gmail.com",
        "full_name": "Test User",
        "supabase_uid": "12345678-1234-1234-1234-123456789012"
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request("http://localhost:8000/api/auth/sync", data=data, headers={'Content-Type': 'application/json'})
    
    with urllib.request.urlopen(req, timeout=5) as response:
        print(f"Status Code: {response.getcode()}")
        print(f"Response: {response.read().decode('utf-8')}")
except urllib.error.URLError as e:
    if isinstance(e.reason, socket.timeout):
        print("ERRO: A requisição deu TIMEOUT (travou)!")
    else:
        print(f"ERRO DE CONEXAO: {e}")
except Exception as e:
    print(f"ERRO: {e}")
print(f"Tempo decorrido: {time.time() - start:.2f}s")
