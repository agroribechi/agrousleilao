import React, { useState, useEffect } from 'react';
import { 
  Radio, Calendar, Clock, MapPin, Award, CheckCircle, Lock, 
  MessageCircle, Phone, Sparkles, Building2, Search, Filter, 
  ChevronRight, ArrowRight, ShieldCheck, Tag, Heart, BellRing,
  ExternalLink, Layers, Eye
} from 'lucide-react';

const RURAL_CATEGORIES = [
  { id: 'all', label: '🌾 Todos os Leilões' },
  { id: 'live', label: '🔴 Ao Vivo Agora' },
  { id: 'nelore', label: '🐂 Nelore & Elite' },
  { id: 'corte', label: '🐄 Gado de Corte' },
  { id: 'bezerros', label: '🐂 Bezerros & Garrotes' },
];

export default function ClientAuctionsHome({ 
  auctions = [], 
  API_BASE, 
  user, 
  onSelectAuction, 
  onNavigateToLive,
  onNavigateToCalibrator
}) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedFavorites, setSavedFavorites] = useState([]);

  const isAdmin = user?.role === 'admin';

  // Filtra os leilões com base na busca e filtro de categoria
  const filteredAuctions = auctions.filter(auction => {
    const title = (auction.title || '').toLowerCase();
    const desc = (auction.description || '').toLowerCase();
    const auctioneer = (auction.auctioneer_name || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = title.includes(q) || desc.includes(q) || auctioneer.includes(q);

    if (!matchesSearch) return false;

    if (selectedFilter === 'live') return auction.status === 'Ao Vivo';
    if (selectedFilter === 'nelore') return title.includes('nelore') || desc.includes('nelore') || title.includes('elite');
    if (selectedFilter === 'corte') return title.includes('corte') || desc.includes('corte');
    if (selectedFilter === 'bezerros') return title.includes('bezerro') || desc.includes('bezerro') || desc.includes('garrote');

    return true;
  });

  const liveAuctions = auctions.filter(a => a.status === 'Ao Vivo');
  const upcomingAuctions = auctions.filter(a => a.status !== 'Ao Vivo');

  const toggleFavorite = (id) => {
    if (savedFavorites.includes(id)) {
      setSavedFavorites(savedFavorites.filter(favId => favId !== id));
    } else {
      setSavedFavorites([...savedFavorites, id]);
    }
  };

  const getCountdown = (startDateStr) => {
    try {
      const diff = new Date(startDateStr) - new Date();
      if (diff <= 0) return 'Pronto para Iniciar';
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `Faltam ${days} dia(s)`;
      }
      return `Em ${hours}h ${mins}m`;
    } catch (e) {
      return 'Agendado';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      
      {/* BANNER PRINCIPAL DE BOAS-VINDAS (TEMA RURAL/PECUÁRIA MODERNIZADO) */}
      <div className="glass-panel" style={{
        padding: '2.5rem 2rem',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(20, 83, 45, 0.45) 0%, rgba(15, 23, 42, 0.85) 60%, rgba(120, 53, 15, 0.35) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
      }}>
        {/* ELEMENTO DE BRILHO E AMBIENTE RURAL */}
        <div style={{
          position: 'absolute', top: '-50px', right: '-50px', width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge-glow" style={{
              background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80',
              borderColor: 'rgba(74, 222, 128, 0.4)', fontWeight: 700
            }}>
              🌾 Portal de Leilões de Pecuária & Agronegócio
            </span>

            {user && (
              <span className="badge-glow" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                <ShieldCheck size={14} style={{ marginRight: '4px' }} /> Cliente Autorizado
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Bem-vindo aos Leilões <span style={{ background: 'linear-gradient(135deg, #4ade80 0%, #facc15 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ao Vivo & Destaques</span>
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '750px', margin: 0 }}>
            Acompanhe as transmissões dos leilões de gado autorizados para você. Consulte a agenda, ative alertas e participe dos lances em tempo real com leitura via inteligência artificial.
          </p>

          {/* BARRA DE PESQUISA & FILTROS TOUCH */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="glass-input"
                placeholder="Buscar por leilão, leiloeira ou raça (ex: Nelore, Unaí)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.75rem', height: '48px', fontSize: '0.95rem' }}
              />
            </div>

          </div>

          {/* CHIPS DE NAVEGAÇÃO / CATEGORIAS DE GADO */}
          <div className="horizontal-chips-scroll" style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
            {RURAL_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedFilter(cat.id)}
                className={selectedFilter === cat.id ? 'btn-gradient' : 'btn-secondary'}
                style={{
                  padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: selectedFilter === cat.id 
                    ? 'linear-gradient(135deg, #16a34a 0%, #ca8a04 100%)' 
                    : undefined
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* SEÇÃO 1: LEILÕES AO VIVO AGORA (DESTAQUE MÁXIMO COM EFEITO RED PULSE) */}
      {liveAuctions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f87171' }}>
              <Radio size={22} className="pulse-red" color="#ef4444" /> Transmissões Ao Vivo (Acontecendo Agora)
            </h2>
            <span className="badge-glow" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
              {liveAuctions.length} leilão(ões) no ar
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {liveAuctions.map(auction => {
              const cleanWhatsapp = auction.phone_whatsapp ? auction.phone_whatsapp.replace(/\D/g, '') : '';

              return (
                <div 
                  key={auction.id} 
                  className="glass-panel hover-glow" 
                  style={{
                    padding: '1.5rem',
                    border: '2px solid rgba(239, 68, 68, 0.5)',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.25)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      
                      {/* AVATAR DO LOGOTIPO DO LEILÃO */}
                      <div style={{
                        width: '70px', height: '70px', borderRadius: '16px', background: '#0f172a',
                        border: '2px solid rgba(239, 68, 68, 0.6)', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.5)', flexShrink: 0
                      }}>
                        {auction.logo_url ? (
                          <img src={auction.logo_url} alt={auction.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
                        ) : (
                          <Building2 size={32} color="#f87171" />
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                        <span className="badge-glow" style={{ background: 'rgba(239, 68, 68, 0.3)', color: '#f87171', fontWeight: 800 }}>
                          🔴 AO VIVO NO AR
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle size={12} /> Acesso Liberado
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {auction.auctioneer_name || 'Leiloeira Oficial'}
                    </span>
                    
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.2rem 0 0.5rem' }}>
                      {auction.title}
                    </h3>
                    
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                      {auction.description || 'Transmissão ao vivo com reconhecimento de lotes em tempo real.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '1rem' }}>
                    <button 
                      onClick={() => onNavigateToLive && onNavigateToLive(auction)} 
                      className="btn-gradient" 
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        padding: '0.85rem', fontSize: '0.95rem', fontWeight: 800, width: '100%',
                        boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)'
                      }}
                    >
                      <Radio size={20} /> ASSISTIR LEILÃO AO VIVO AGORA
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => onSelectAuction && onSelectAuction(auction)} 
                        className="btn-secondary"
                        style={{ flex: 1, padding: '0.55rem', fontSize: '0.825rem' }}
                      >
                        <Eye size={16} /> Ver Detalhes
                      </button>

                      {auction.phone_whatsapp && (
                        <a 
                          href={`https://wa.me/${cleanWhatsapp}?text=Ol%C3%A1%2C+estou+assistindo+ao+leil%C3%A3o+${encodeURIComponent(auction.title)}`} 
                          target="_blank" rel="noreferrer"
                          className="btn-secondary" 
                          style={{ padding: '0.55rem 0.85rem', color: '#22c55e', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <MessageCircle size={16} /> Lances
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEÇÃO 2: LEILÕES CADASTRAIS & PRÓXIMOS EVENTOS (MEUS LEILÕES AUTORIZADOS) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={22} color="#818cf8" /> Próximos Leilões & Agenda Oficial
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>
              Leilões cadastrados pelo administrador onde você possui permissão de acesso.
            </p>
          </div>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Exibindo {filteredAuctions.length} de {auctions.length} leilão(ões)
          </span>
        </div>

        {filteredAuctions.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building2 size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Nenhum leilão encontrado</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.35rem' }}>
              Tente alterar os termos da busca ou selecione outra categoria nos filtros acima.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {filteredAuctions.map(auction => {
              const cleanWhatsapp = auction.phone_whatsapp ? auction.phone_whatsapp.replace(/\D/g, '') : '';
              const isFav = savedFavorites.includes(auction.id);
              const countdownStr = getCountdown(auction.start_date);

              return (
                <div 
                  key={auction.id} 
                  className="glass-panel hover-glow"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}
                >
                  
                  <div>
                    {/* CABEÇALHO DO CARD COM LOGO E BOTÃO FAVORITO */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                      
                      {/* AVATAR DO LOGOTIPO DO LEILÃO */}
                      <div style={{
                        width: '64px', height: '64px', borderRadius: '16px', background: '#0f172a',
                        border: '2px solid rgba(99, 102, 241, 0.4)', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.4)', flexShrink: 0
                      }}>
                        {auction.logo_url ? (
                          <img src={auction.logo_url} alt={auction.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
                        ) : (
                          <Building2 size={30} color="#818cf8" />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          onClick={() => toggleFavorite(auction.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: isFav ? '#f43f5e' : 'var(--text-dim)', padding: '0.2rem'
                          }}
                          title={isFav ? "Remover dos favoritos" : "Salvar nos favoritos"}
                        >
                          <Heart size={20} fill={isFav ? "#f43f5e" : "none"} />
                        </button>

                        <span className="badge-glow" style={{
                          background: auction.status === 'Ao Vivo' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: auction.status === 'Ao Vivo' ? '#f87171' : '#38bdf8',
                          fontSize: '0.7rem'
                        }}>
                          {auction.status}
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {auction.auctioneer_name || 'Leilão Pecuária'}
                    </span>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.2rem 0 0.5rem' }}>
                      {auction.title}
                    </h3>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                      {auction.description || 'Sem descrição.'}
                    </p>
                  </div>

                  {/* BLOCO DE INFORMAÇÕES DE DATA, LOCAL E AÇÕES */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    
                    {/* DATA E HORA DE INÍCIO */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Calendar size={16} color="#818cf8" />
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                          {new Date(auction.start_date).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80' }}>
                        ⏳ {countdownStr}
                      </span>
                    </div>

                    {auction.address_city && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <MapPin size={15} color="#f87171" />
                        <span>{auction.address_city} - {auction.address_state}</span>
                      </div>
                    )}

                    {/* BOTOES DE AÇÃO COMPLETA */}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                      <button 
                        onClick={() => onSelectAuction && onSelectAuction(auction)}
                        className="btn-gradient" 
                        style={{ flex: 1, padding: '0.65rem', fontSize: '0.875rem' }}
                      >
                        <Eye size={16} /> Entrar na Página
                      </button>

                      {auction.phone_whatsapp && (
                        <a 
                          href={`https://wa.me/${cleanWhatsapp}?text=Ol%C3%A1%2C+gostaria+de+informa%C3%A7%C3%B5es+sobre+o+leil%C3%A3o+${encodeURIComponent(auction.title)}`}
                          target="_blank" rel="noreferrer"
                          className="btn-secondary"
                          style={{ padding: '0.65rem 0.85rem', color: '#22c55e', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          title="Falar no WhatsApp Oficial"
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
