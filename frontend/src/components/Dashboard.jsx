import React from 'react';
import { Activity, Tv, ShieldCheck, Database, ArrowUpRight, Zap, CheckCircle2 } from 'lucide-react';

export default function Dashboard({ templates, onNavigateToCalibrator }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* SEÇÃO HERO DE ESTATÍSTICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Tv size={26} color="#818cf8" />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Canais Mapeados</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.2rem' }}>{templates.length}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={26} color="#34d399" />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Motor de Leitura OCR</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', marginTop: '0.3rem' }}>
              EasyOCR + CLAHE
            </h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px',
            background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={26} color="#f472b6" />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status da IA</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f472b6', marginTop: '0.3rem' }}>
              Pronto / Ativo
            </h3>
          </div>
        </div>

      </div>

      {/* SEÇÃO PRINCIPAL DE INÍCIO RÁPIDO E CANAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span className="badge-glow" style={{ marginBottom: '1rem', display: 'inline-block' }}>Sistema de Calibração IA v2.0</span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.3 }}>
              Mapeie e Extraia Dados de Transmissões de Leilão com Alta Precisão
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '600px' }}>
              Utilize nossa ferramenta visual interativa para selecionar campos como Número do Lote, Descrição dos Animais e Preço direto no frame do vídeo do YouTube.
            </p>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button onClick={onNavigateToCalibrator} className="btn-gradient">
              <Zap size={18} /> Iniciar Nova Calibração ROI
            </button>
          </div>
        </div>

        {/* LISTA RÁPIDA DE TEMPLATES */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Canais Cadastrados</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{templates.length} total</span>
          </h3>

          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 0', fontSize: '0.875rem' }}>
              Nenhum canal salvo ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {templates.slice(0, 5).map((t) => (
                <div key={t.id || t.name} style={{
                  background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-subtle)',
                  padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', display: 'block' }}>{t.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.fields ? t.fields.length : 0} campos configurados
                    </span>
                  </div>
                  <CheckCircle2 size={18} color="#34d399" />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
