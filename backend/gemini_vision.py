import os
import re
import json
import httpx
from typing import Dict, Any, Optional

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

AUCTION_SYSTEM_PROMPT = '''Você é um especialista em visão computacional para transmissões de leilões de gado e agronegócio brasileiro (Canal do Boi, Canal Rural, Terra Viva, Remate Web, AgroBrasil, etc.).
Sua tarefa é analisar o frame do vídeo da transmissão e extrair os dados estruturados do lote e do lance atual com máxima fidelidade.

DIRETRIZES DE EXTRAÇÃO:
1. Se a tela for uma propaganda, vinheta de abertura, intervalo ou entrevista sem dados de lote em leilão, retorne "is_auction_screen": false.
2. Se a tela contiver dados de um lote de animais em leilão, retorne "is_auction_screen": true.
3. Extraia:
   - "lot_number": O número ou código do lote exibido na tela (ex: "14", "102-A", "05").
   - "price": O valor do lance/preço atual ou de arremate exibido na tela (ex: "R$ 2.450,00" ou "2.450,00").
   - "description": A descrição dos animais (ex: "30 Machos Nelore Mocho", "Garrotes Cruzamento Industrial").
   - "category": A categoria pecuária principal (escolha entre: "Bezerros", "Novilhas", "Nelore", "Matrizes", "Boi Gordo", "Garrotes", "Cruzado", "Geral").
   - "quantity": A quantidade de cabeças/animais do lote (ex: "30", "15").
   - "weight": O peso médio ou total se visível (ex: "280kg", "9.5 @").
   - "seller": Nome do vendedor/fazenda/criatório se visível.
   - "location": Cidade/Estado de origem dos animais se visível.

Retorne SEMPRE um JSON estrito no seguinte formato:
{
  "is_auction_screen": true,
  "lot_number": "14",
  "price": "R$ 2.450,00",
  "description": "30 Machos Nelore",
  "category": "Nelore",
  "quantity": "30",
  "weight": "280 kg",
  "seller": "Fazenda Boa Vista",
  "location": "MS",
  "confidence": 0.95
}
'''

async def analyze_auction_frame(image_base64: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    key = api_key or GEMINI_API_KEY or os.getenv('GEMINI_API_KEY', '')
    if not key:
        return {
            'success': False,
            'error': 'GEMINI_API_KEY não configurada. Defina a chave no painel ou no arquivo .env.'
        }

    clean_b64 = image_base64
    mime_type = 'image/jpeg'
    if ',' in image_base64:
        header, clean_b64 = image_base64.split(',', 1)
        if 'png' in header:
            mime_type = 'image/png'
        elif 'webp' in header:
            mime_type = 'image/webp'

    payload = {
        'contents': [
            {
                'parts': [
                    {'text': 'Analise esta imagem de transmissão de leilão e extraia todos os dados do lote e lance em JSON.'},
                    {
                        'inline_data': {
                            'mime_type': mime_type,
                            'data': clean_b64
                        }
                    }
                ]
            }
        ],
        'system_instruction': {
            'parts': [
                {'text': AUCTION_SYSTEM_PROMPT}
            ]
        },
        'generationConfig': {
            'response_mime_type': 'application/json',
            'temperature': 0.1,
            'maxOutputTokens': 500
        }
    }

    url = f"{GEMINI_API_URL}?key={key}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json'}
            )

        if response.status_code != 200:
            err_text = response.text
            return {
                'success': False,
                'error': f'Erro Gemini API ({response.status_code}): {err_text[:200]}'
            }

        data = response.json()
        candidates = data.get('candidates', [])
        if not candidates:
            return {
                'success': False,
                'error': 'Nenhuma resposta retornada pelo Gemini Vision.'
            }

        parts = candidates[0].get('content', {}).get('parts', [])
        if not parts:
            return {
                'success': False,
                'error': 'Conteúdo vazio retornado pelo Gemini Vision.'
            }

        raw_json_str = parts[0].get('text', '{}')
        cleaned_json = re.sub(r'^```json\s*', '', raw_json_str.strip())
        cleaned_json = re.sub(r'\s*```$', '', cleaned_json.strip())

        parsed_data = json.loads(cleaned_json)
        return {
            'success': True,
            'data': parsed_data
        }

    except json.JSONDecodeError as je:
        return {
            'success': False,
            'error': f'Erro ao decodificar JSON do Gemini: {str(je)}',
            'raw': raw_json_str
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Exceção ao comunicar com Gemini Vision: {str(e)}'
        }