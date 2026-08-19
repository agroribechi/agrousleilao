// Configuração centralizada da API VPS
const VPS_URL = import.meta.env.VITE_VPS_URL || 'http://localhost:8000'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export function getToken() {
  return localStorage.getItem('sb_access_token')
}

export function setToken(token) {
  localStorage.setItem('sb_access_token', token)
}

export function clearToken() {
  localStorage.removeItem('sb_access_token')
  localStorage.removeItem('sb_user')
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('sb_user') || 'null')
  } catch {
    return null
  }
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function loginWithSupabase(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY
    },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Falha no login')

  setToken(data.access_token)

  // Sincroniza usuário no banco da VPS
  const syncRes = await fetch(`${VPS_URL}/api/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || '',
      supabase_uid: data.user.id
    })
  })
  const syncData = await syncRes.json()
  localStorage.setItem('sb_user', JSON.stringify(syncData.user))
  return syncData.user
}

export async function signupWithSupabase(email, password, fullName) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password, data: { full_name: fullName } })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Falha no cadastro')
  return data
}

// ─── Leilões ──────────────────────────────────────────────────────────────────

export async function fetchAuctions() {
  const res = await fetch(`${VPS_URL}/api/auctions`, {
    headers: { ...authHeaders() }
  })
  if (!res.ok) throw new Error('Erro ao carregar leilões')
  return res.json()
}

export async function fetchAuctionPublic(auctionId) {
  const res = await fetch(`${VPS_URL}/api/auctions/${auctionId}/public`)
  if (!res.ok) throw new Error('Leilão não encontrado')
  return res.json()
}

// ─── Dados ao vivo ────────────────────────────────────────────────────────────

export async function fetchLiveData(auctionId) {
  const res = await fetch(`${VPS_URL}/api/live/${auctionId}`, {
    headers: { ...authHeaders() }
  })
  if (!res.ok) throw new Error('Erro ao buscar dados ao vivo')
  return res.json()
}

// ─── Captura do celular → Gemini Vision ──────────────────────────────────────

export async function sendClientFrame(imageBase64, auctionId) {
  const res = await fetch(`${VPS_URL}/api/client/frame`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({
      image_base64: imageBase64,
      auction_id: auctionId
    })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Erro ao processar imagem')
  }
  return res.json()
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export async function fetchLogs(auctionId) {
  const res = await fetch(`${VPS_URL}/api/logs?auction_id=${auctionId}`, {
    headers: { ...authHeaders() }
  })
  if (!res.ok) throw new Error('Erro ao buscar histórico')
  return res.json()
}
