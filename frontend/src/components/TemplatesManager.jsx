import React from 'react';
import { Tv, Trash2, Tag, Layers, Edit3, ExternalLink } from 'lucide-react';

export default function TemplatesManager({ templates, API_BASE, onRefresh, onEditTemplate }) {

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir este template de canal?')) return;
    try {
      const token = localStorage.getItem('leilao_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Erro ao excluir template.');
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Gabaritos de Leiloeiras & Canais</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Modelos de caixas ROI salvos para extração de dados automática.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          <Layers size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>Nenhum gabarito cadastrado</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Vá em "Calibrador ROI" para capturar um frame e salvar novas leiloeiras.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {templates.map((t) => (
            <div key={t.id || t.name} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '10px',
                      background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                    }}>
                      {t.logo_url ? (
                        <img src={t.logo_url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
                      ) : (
                        <Tv size={20} color="#818cf8" />
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t.name}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : 'Pre-existente'}
                      </span>
                      {t.video_url && (
                        <a 
                          href={t.video_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: '0.7rem', color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem', textDecoration: 'none' }}
                        >
                          <ExternalLink size={12} /> YouTube
                        </a>
                      )}
                    </div>
                  </div>

                  {t.id && (
                    <button 
                      onClick={() => handleDelete(t.id)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                      title="Excluir Template"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                    Campos Configurados ({t.fields ? t.fields.length : 0}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {t.fields && t.fields.map((f, i) => (
                      <span key={i} style={{
                        background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-subtle)',
                        padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1',
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        <Tag size={12} color="#818cf8" />
                        {f.nome}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1rem' }}>
                <button 
                  onClick={() => onEditTemplate && onEditTemplate(t)}
                  className="btn-gradient" 
                  style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem' }}
                >
                  <Edit3 size={16} /> Carregar no Calibrador
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
