import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, MapPin, Phone, MessageCircle, Globe, Instagram, 
  Calendar, CheckCircle, Award, Sparkles, Radio, Camera, Box, 
  Clock, ShieldCheck, DollarSign, ExternalLink, Building2
} from 'lucide-react';

export default function AuctionDetailPage({ auctionId, API_BASE, onBack, onNavigateToCalibrator, onNavigateToLive }) {
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (auctionId) fetchAuctionDetail();
  }, [auctionId]);

  const fetchAuctionDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auctions/${auctionId}/public`);
      if (res.ok) {
        const data = await res.json();
        setAuction(data);
      } else {
        throw new Error('Não foi possível carregar os detalhes deste leilão.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Carregando página personalizada do leilão...
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <h3 style={{ color: '#f87171', marginBottom: '1rem' }}>Erro ao Carregar Leilão</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error || 'Leilão não encontrado.'}</p>
        <button onClick={onBack} className="btn-secondary">
          <ArrowLeft size={16} /> Voltar para Leilões
        </button>
      </div>
    );
  }

  const cleanWhatsapp = auction.phone_whatsapp ? auction.phone_whatsapp.replace(/\D/g, '') : '';
  const isPaidPromotion = auction.payment_status === 'Pago - Destaque' || auction.plan_tier === 'Destaque Ouro' || auction.plan_tier === 'Patrocinado Premium';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* NAVEGAÇÃO DE VOLTA */}
      <div>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} /> Voltar para Lista de Leilões
        </button>
      </div>

      {/* HERO BANNER PERSONALIZADO */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-subtle)' }}>
        {/* Banner de Fundo */}
        <div style={{
          height: '240px',
          width: '100%',
          background: auction.banner_url 
            ? `url(${auction.banner_url}) center/cover no-repeat` 
            : 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.3) 100%)'
          }} />

          {/* BADGES SUPERIORES */}
          <div style={{ position: 'absolute', top: '1rem', right: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge-glow" style={{
              background: auction.status === 'Ao Vivo' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)',
              color: auction.status === 'Ao Vivo' ? '#f87171' : '#38bdf8',
              borderColor: auction.status === 'Ao Vivo' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.5)'
            }}>
              {auction.status === 'Ao Vivo' ? '🔴 Transmissão Ao Vivo' : `📅 Status: ${auction.status}`}
            </span>

            {isPaidPromotion && (
              <span className="badge-glow" style={{
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.3) 0%, rgba(202, 138, 4, 0.2) 100%)',
                color: '#facc15',
                borderColor: 'rgba(250, 204, 21, 0.6)',
                fontWeight: 700
              }}>
                <Award size={14} style={{ marginRight: '4px' }} /> {auction.plan_tier || 'Patrocinado'}
              </span>
            )}
          </div>
        </div>

        {/* CONTEÚDO DO CABEÇALHO COM LOGOTIPO */}
        <div style={{ padding: '0 2rem 2rem', marginTop: '-60px', position: 'relative', zIndex: 2, display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          
          {/* AVATAR DO LOGOTIPO */}
          <div style={{
            width: '120px', height: '120px', borderRadius: '20px',
            background: 'var(--panel-bg)',
            border: '3px solid rgba(99, 102, 241, 0.5)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            {auction.logo_url ? (
              <img src={auction.logo_url} alt={`Logotipo ${auction.title}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }} />
            ) : (
              <Building2 size={48} color="#818cf8" />
            )}
          </div>

          {/* DETALHES DO TÍTULO E LEILOEIRA */}
          <div style={{ flex: 1, minWidth: '260px' }}>
            <span style={{ fontSize: '0.85rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {auction.auctioneer_name || 'Leilão Oficial'}
            </span>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.2rem 0 0.5rem', lineHeight: 1.2 }}>
              {auction.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', margin: 0 }}>
              {auction.description || 'Nenhuma descrição adicional informada.'}
            </p>
          </div>

          {/* BOTÕES DE AÇÃO RÁPIDA */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {auction.status === 'Ao Vivo' && (
              <button onClick={() => onNavigateToLive && onNavigateToLive(auction)} className="btn-gradient" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #a855f7 100%)', padding: '0.65rem 1.25rem' }}>
                <Radio size={18} /> Entrar na Sala Ao Vivo
              </button>
            )}

            <button onClick={() => onNavigateToCalibrator && onNavigateToCalibrator(auction)} className="btn-secondary" style={{ padding: '0.65rem 1.1rem' }}>
              <Camera size={18} color="#818cf8" /> Abrir no Calibrador ROI
            </button>
          </div>

        </div>
      </div>

      {/* GRID DE INFORMAÇÕES: CONTATOS, ENDEREÇO & PLANO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* CARD DE CONTATOS E INTERAÇÃO DIRETA */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8' }}>
            <MessageCircle size={20} /> Contato & Atendimento de Lances
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {auction.phone_whatsapp ? (
              <a 
                href={`https://wa.me/${cleanWhatsapp}?text=Ol%C3%A1%2C+estou+interessado+no+leil%C3%A3o+${encodeURIComponent(auction.title)}`}
                target="_blank" rel="noreferrer"
                className="btn-gradient"
                style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  justifyContent: 'center', textDecoration: 'none', padding: '0.75rem'
                }}
              >
                <MessageCircle size={20} /> Falar no WhatsApp Oficial
              </a>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>WhatsApp não cadastrado.</span>
            )}

            {auction.phone_primary && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
                <Phone size={18} color="#818cf8" />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Telefone Principal:</span>
                  <a href={`tel:${auction.phone_primary}`} style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
                    {auction.phone_primary}
                  </a>
                </div>
              </div>
            )}

            {auction.website_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
                <Globe size={18} color="#38bdf8" />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Website Oficial:</span>
                  <a href={auction.website_url.startsWith('http') ? auction.website_url : `https://${auction.website_url}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none', fontSize: '0.85rem' }}>
                    {auction.website_url} <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CARD DE LOCALIZAÇÃO & ENDEREÇO */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#facc15' }}>
            <MapPin size={20} /> Endereço & Localização do Recinto
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Building2 size={20} color="var(--text-muted)" style={{ marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leiloeira / Recinto:</span>
                <p style={{ fontWeight: 600, margin: '2px 0 0', fontSize: '0.95rem' }}>
                  {auction.auctioneer_name || 'Recinto de Leilões'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <MapPin size={20} color="#f87171" style={{ marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Endereço Completo:</span>
                <p style={{ fontWeight: 600, margin: '2px 0 0', fontSize: '0.9rem' }}>
                  {auction.address_street || 'Endereço não informado'}<br />
                  {auction.address_city ? `${auction.address_city} - ${auction.address_state || ''}` : ''}
                  {auction.address_zip ? ` (CEP: ${auction.address_zip})` : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
              <Calendar size={18} color="#818cf8" />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Data e Hora de Início:</span>
                <span style={{ fontWeight: 700, color: '#a7f3d0' }}>
                  {new Date(auction.start_date).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD DE DIVULGAÇÃO & STATUS DE PATROCÍNIO */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a7f3d0' }}>
            <Award size={20} /> Plano de Divulgação & Selo Oficial
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nível de Destaque:</span>
                <span className="badge-glow" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                  {auction.plan_tier || 'Gratuito'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status de Pagamento:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isPaidPromotion ? '#34d399' : '#94a3b8' }}>
                  {auction.payment_status || 'Gratuito'}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#34d399" />
              Leilão auditado e verificado na plataforma de IA.
            </div>
          </div>
        </div>

      </div>

      {/* LOTES E ITENS DISPONÍVEIS NO LEILÃO */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Box size={22} color="var(--accent-primary)" /> Lotes Disponíveis ({auction.items ? auction.items.length : 0})
        </h3>

        {!auction.items || auction.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Nenhum lote pré-cadastrado no momento. Os lotes serão capturados automaticamente durante a transmissão ao vivo pelo Calibrador ROI.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {auction.items.map(item => (
              <div key={item.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.9rem' }}>Lote #{item.lot_number}</span>
                  <span className="badge-glow" style={{ fontSize: '0.65rem' }}>{item.status}</span>
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{item.title}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>{item.description || 'Sem detalhes.'}</p>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                  Lance: R$ {item.current_bid ? item.current_bid.toLocaleString('pt-BR') : item.starting_bid.toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
