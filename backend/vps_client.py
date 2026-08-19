"""
VPS Client — módulo do Admin Local para enviar dados para a VPS Relay.
Usado pelo admin-backend após cada ciclo de captura + OCR/Gemini.
"""
import os
import httpx
from typing import Dict, Any, Optional, List

VPS_URL = os.getenv("VPS_URL", "").rstrip("/")
ADMIN_SECRET_TOKEN = os.getenv("ADMIN_SECRET_TOKEN", "")

def _get_headers() -> Dict[str, str]:
    return {
        "X-Admin-Token": ADMIN_SECRET_TOKEN,
        "Content-Type": "application/json"
    }

def _is_configured() -> bool:
    return bool(VPS_URL and ADMIN_SECRET_TOKEN)


async def push_frame_data(
    template_name: str,
    ocr_data: Dict[str, Any],
    lot_number: str = "",
    price: str = "",
    description: str = "",
    category: str = "Geral",
    age: str = "",
    frame_image: str = "",
    auction_id: Optional[int] = None,
    video_url: Optional[str] = None,
    filter_categories: List[str] = [],
    alert_triggered: bool = False,
    matched_category: str = ""
) -> Dict[str, Any]:
    """
    Envia os dados de OCR/Gemini processados localmente para a VPS Relay.
    A VPS recebe e aplica a lógica de negócio (gravação de log, detecção de lote).
    """
    if not _is_configured():
        return {"success": False, "error": "VPS_URL ou ADMIN_SECRET_TOKEN não configurados no .env do admin."}

    payload = {
        "template_name": template_name,
        "ocr_data": ocr_data,
        "lot_number": lot_number,
        "price": price,
        "description": description,
        "category": category,
        "age": age,
        "frame_image": frame_image,
        "auction_id": auction_id,
        "video_url": video_url,
        "filter_categories": filter_categories,
        "alert_triggered": alert_triggered,
        "matched_category": matched_category
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{VPS_URL}/api/push/frame",
                json=payload,
                headers=_get_headers()
            )
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                return {"success": False, "error": f"VPS retornou {response.status_code}: {response.text[:200]}"}
    except httpx.TimeoutException:
        return {"success": False, "error": "Timeout ao conectar com a VPS."}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def push_auction(auction_data: Dict[str, Any]) -> Dict[str, Any]:
    """Cria ou atualiza um leilão na VPS."""
    if not _is_configured():
        return {"success": False, "error": "VPS_URL ou ADMIN_SECRET_TOKEN não configurados."}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{VPS_URL}/api/push/auction",
                json=auction_data,
                headers=_get_headers()
            )
            return {"success": response.status_code == 200, "data": response.json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def push_client_access(auction_id: int, user_emails: List[str]) -> Dict[str, Any]:
    """Define acesso de clientes a um leilão na VPS."""
    if not _is_configured():
        return {"success": False, "error": "VPS_URL não configurado."}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{VPS_URL}/api/push/access",
                json={"auction_id": auction_id, "user_emails": user_emails},
                headers=_get_headers()
            )
            return {"success": response.status_code == 200, "data": response.json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_vps_logs(channel_name: Optional[str] = None, auction_id: Optional[int] = None) -> Dict[str, Any]:
    """Busca logs da VPS para exibir no painel admin."""
    if not _is_configured():
        return {"success": False, "error": "VPS_URL não configurado."}
    params = {}
    if channel_name:
        params["channel_name"] = channel_name
    if auction_id:
        params["auction_id"] = auction_id
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Usa o token também para leitura — endpoint protegido
            response = await client.get(
                f"{VPS_URL}/api/logs",
                params=params,
                headers=_get_headers()
            )
            return {"success": True, "data": response.json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_vps_status() -> Dict[str, Any]:
    """Verifica se a VPS está acessível (síncrono, para health check)."""
    if not _is_configured():
        return {"connected": False, "error": "VPS_URL não configurado."}
    try:
        import httpx
        response = httpx.get(f"{VPS_URL}/health", timeout=5.0)
        if response.status_code == 200:
            return {"connected": True, "data": response.json()}
        return {"connected": False, "error": f"Status {response.status_code}"}
    except Exception as e:
        return {"connected": False, "error": str(e)}
