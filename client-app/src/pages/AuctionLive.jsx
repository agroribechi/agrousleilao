import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchLiveData } from '../lib/api.js'

const POLL_INTERVAL = 4000  // polling a cada 4 segundos

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AuctionLive() {
  const { auctionId } = useParams()
  const [data, setData] = useState(null)
  const [prevLot, setPrevLot] = useState(null)
  const [lotFlash, setLotFlash] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertCategories, setAlertCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('alert_cats') || '[]') } catch { return [] }
  })
  const [showAlertConfig, setShowAlertConfig] = useState(false)
  const [newCat, setNewCat] = useState('')
  const intervalRef = useRef(null)

  const loadData = useCallback(async () => {
    try {
      const d = await fetchLiveData(Number(auctionId))
      setData(prev => {
        if (prev && prev.current_lot !== d.current_lot && d.current_lot) {
          setLotFlash(true)
          setTimeout(() => setLotFlash(false), 600)
        }
        return d
      })
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  useEffect(() => {
    loadData()
    intervalRef.current = setInterval(loadData, POLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [loadData])

  function saveAlerts(cats) {
    setAlertCategories(cats)
    localStorage.setItem('alert_cats', JSON.stringify(cats))
  }

  function addCategory() {
    if (!newCat.trim()) return
    saveAlerts([...new Set([...alertCategories, newCat.trim()])])
    setNewCat('')
  }

  const currentCategory = data?.current_category || ''
  const isAlerted = alertCategories.some(c =>
    c.toLowerCase() && (
      currentCategory.toLowerCase().includes(c.toLowerCase()) ||
      (data?.current_description || '').toLowerCase().includes(c.toLowerCase())
    )
  )

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
        <p style={{ color: '#64748b', marginTop: 16 }}>Conectando ao leilão...</p>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="live-badge"><span className="live-dot" />Ao Vivo</div>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#94a3b8' }}>
            {data?.auction_title || `Leilão #${auctionId}`}
          </h2>
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
          onClick={() => setShowAlertConfig(!showAlertConfig)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          Alertas
        </button>
      </div>

      {/* Alert config panel */}
      {showAlertConfig && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,158,11,0.3)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 10 }}>
            🔔 Alertar quando aparecer:
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="field input"
              placeholder="ex: Nelore, Bezerros..."
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              style={{
                flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none'
              }}
            />
            <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={addCategory}>
              +
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {alertCategories.map(c => (
              <span key={c} onClick={() => saveAlerts(alertCategories.filter(x => x !== c))}
                style={{
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                  color: '#fcd34d', borderRadius: 99, padding: '3px 10px', fontSize: 13,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}>
                {c} ✕
              </span>
            ))}
            {alertCategories.length === 0 && (
              <p style={{ color: '#64748b', fontSize: 12 }}>Nenhum alerta configurado</p>
            )}
          </div>
        </div>
      )}

      {/* Alert banner */}
      {isAlerted && (
        <div className="alert-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#fcd34d' }}>⚡ Categoria de interesse!</p>
            <p style={{ fontSize: 13, color: '#fbbf24' }}>{currentCategory}</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>
          Sem sinal — tentando reconectar...
        </div>
      )}

      {/* Main lot display */}
      <div className="card-glass" style={{ marginBottom: 16, textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', marginBottom: 8 }}>Lote Atual</p>
        <div className={`lot-number ${lotFlash ? 'lot-enter' : ''}`}>
          {data?.current_lot || '—'}
        </div>
        <div style={{ height: 1, background: 'rgba(34,197,94,0.15)', margin: '14px 0' }} />
        <div className="price-display">
          {data?.current_price || 'R$ —'}
        </div>
        {currentCategory && (
          <div style={{ marginTop: 12 }}>
            <span className="category-badge">{currentCategory}</span>
          </div>
        )}
        {data?.current_description && (
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
            {data.current_description}
          </p>
        )}
        {data?.current_age && (
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            ⚖️ {data.current_age}
          </p>
        )}
        <p style={{ color: '#334155', fontSize: 11, marginTop: 14 }}>
          Atualizado às {formatTime(data?.last_updated)} · a cada {POLL_INTERVAL/1000}s
        </p>
      </div>

      {/* Frame thumbnail */}
      {data?.frame_image && (
        <div className="card" style={{ marginBottom: 16, padding: 8 }}>
          <img
            src={data.frame_image}
            alt="Frame atual do leilão"
            style={{ width: '100%', borderRadius: 8, display: 'block' }}
          />
        </div>
      )}

      {/* CTA: enviar print */}
      <Link to={`/capture/${auctionId}`} className="btn btn-camera" style={{
        textDecoration: 'none', marginBottom: 20, display: 'flex',
        background: 'linear-gradient(135deg, #1e40af, #1d4ed8)'
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Enviar print do seu celular
      </Link>

      {/* History */}
      {data?.history && data.history.length > 0 && (
        <div>
          <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 10 }}>
            Histórico de lotes
          </p>
          {data.history.map((log, i) => (
            <div key={log.id || i} className="history-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span className={`status-dot ${log.status === 'Em Andamento' ? 'andamento' : 'arrematado'}`} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>Lote {log.lot_number}</p>
                  <p style={{ color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.description}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontWeight: 600, color: '#f59e0b', fontSize: 14 }}>{log.price}</p>
                <p style={{ color: '#64748b', fontSize: 11 }}>{formatTime(log.captured_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
