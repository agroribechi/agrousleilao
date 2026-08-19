import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAuctions, getUser } from '../lib/api.js'

function statusClass(status) {
  if (status === 'Ao Vivo') return 'live'
  if (status === 'Agendado') return 'scheduled'
  return 'closed'
}

function statusLabel(status) {
  if (status === 'Ao Vivo') return '🔴 Ao Vivo'
  if (status === 'Agendado') return '🗓 Agendado'
  return '✓ Encerrado'
}

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function AuctionsList() {
  const user = getUser()
  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAuctions()
      .then(setAuctions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const live = auctions.filter(a => a.status === 'Ao Vivo')
  const others = auctions.filter(a => a.status !== 'Ao Vivo')

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Meus Leilões</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Olá, {user?.full_name || user?.email}</p>
        </div>
        <div style={{
          width: 42, height: 42,
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className="spinner" />
          <p style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>Carregando leilões...</p>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          color: '#fca5a5',
          fontSize: 14,
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {/* Ao Vivo */}
      {live.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="live-badge"><span className="live-dot" />Ao Vivo Agora</div>
          </div>
          {live.map(auction => (
            <Link key={auction.id} to={`/live/${auction.id}`} className="auction-card" style={{
              borderColor: 'rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{auction.title}</p>
                  {auction.auctioneer_name && (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>{auction.auctioneer_name}</p>
                  )}
                  <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{formatDate(auction.start_date)}</p>
                </div>
                <span className={`auction-status ${statusClass(auction.status)}`}>
                  {statusLabel(auction.status)}
                </span>
              </div>
              <div style={{
                marginTop: 12,
                background: 'rgba(239,68,68,0.12)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                color: '#fca5a5',
                fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Toque para acompanhar ao vivo
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Outros */}
      {!loading && others.length > 0 && (
        <div>
          <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 10 }}>
            Outros leilões
          </p>
          {others.map(auction => (
            <Link key={auction.id} to={`/live/${auction.id}`} className="auction-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{auction.title}</p>
                  {auction.auctioneer_name && (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>{auction.auctioneer_name}</p>
                  )}
                  <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{formatDate(auction.start_date)}</p>
                </div>
                <span className={`auction-status ${statusClass(auction.status)}`}>
                  {statusLabel(auction.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && auctions.length === 0 && !error && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐄</div>
          <p style={{ color: '#64748b', fontSize: 15 }}>Nenhum leilão disponível no momento.</p>
        </div>
      )}
    </div>
  )
}
