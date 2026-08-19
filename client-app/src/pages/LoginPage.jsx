import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithSupabase } from '../lib/api.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginWithSupabase(email, password)
      navigate('/auctions')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at top, #0f2027 0%, #0b1120 60%)'
    }}>
      {/* Logo / Brand */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          width: 64, height: 64,
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 32px rgba(34,197,94,0.35)'
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9' }}>
          Leilão IA
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Painel do cliente — acompanhe ao vivo
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380 }}>
        <div className="card-glass">
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              color: '#fca5a5',
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Entrando...
              </>
            ) : 'Entrar'}
          </button>
        </div>
      </form>

      <p style={{ color: '#334155', fontSize: 12, marginTop: 32, textAlign: 'center' }}>
        Acesso exclusivo para clientes cadastrados
      </p>
    </div>
  )
}
