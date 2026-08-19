import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sendClientFrame } from '../lib/api.js'

export default function CaptureFrame() {
  const { auctionId } = useParams()
  const [preview, setPreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    setResult(null)
    setError('')

    const reader = new FileReader()
    reader.onloadend = () => setImageBase64(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!imageBase64) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await sendClientFrame(imageBase64, Number(auctionId))
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setPreview(null)
    setImageBase64(null)
    setResult(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to={`/live/${auctionId}`} style={{
          width: 36, height: 36,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', textDecoration: 'none', flexShrink: 0
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Enviar Print</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Tire uma foto do leilão no seu celular</p>
        </div>
      </div>

      {/* Instruções */}
      {!preview && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(59,130,246,0.2)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, background: 'rgba(59,130,246,0.15)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: '#93c5fd', marginBottom: 4 }}>Como funciona</p>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
                1. Abra o YouTube no seu celular<br/>
                2. Tire um print ou foto da tela com o lote visível<br/>
                3. Selecione a imagem abaixo<br/>
                4. Nossa IA extrai os dados automaticamente
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Input de câmera/galeria */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="camera-input"
      />

      {!preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label htmlFor="camera-input" className="btn btn-camera" style={{ cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Abrir câmera / galeria
          </label>

          {/* Alternativa: tirar screenshot e selecionar da galeria */}
          <div style={{
            textAlign: 'center', color: '#334155', fontSize: 12, padding: '8px 0'
          }}>
            Ou selecione um print salvo da galeria
          </div>
        </div>
      ) : (
        <>
          {/* Preview */}
          <div className="card" style={{ padding: 8, marginBottom: 16 }}>
            <img
              src={preview}
              alt="Preview do print"
              style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: '55vw', objectFit: 'contain' }}
            />
          </div>

          {/* Resultado */}
          {result && (
            <div className="card-glass" style={{ marginBottom: 16 }}>
              {result.is_auction_screen ? (
                <>
                  <p style={{ color: '#22c55e', fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Dados extraídos com sucesso!
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Lote', result.lot_number],
                      ['Preço', result.price],
                      ['Categoria', result.category],
                      ['Quantidade', result.quantity],
                      ['Peso', result.weight],
                      ['Localização', result.location],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px'
                      }}>
                        <p style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>{label}</p>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {result.description && (
                    <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Descrição</p>
                      <p style={{ fontWeight: 500, fontSize: 14 }}>{result.description}</p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
                  <p style={{ color: '#f59e0b', fontWeight: 600, fontSize: 15 }}>
                    Tela de leilão não detectada
                  </p>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
                    Certifique-se que o lote está visível na imagem
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 14, marginBottom: 12
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!result && (
              <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Analisando com IA...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    Analisar com Gemini IA
                  </>
                )}
              </button>
            )}
            <button className="btn btn-secondary" onClick={reset}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
              </svg>
              {result ? 'Enviar outro print' : 'Escolher outra imagem'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
