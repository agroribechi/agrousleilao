import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Camera, Layers, User as UserIcon, LogOut, 
  Shield, Sparkles, Cpu, Radio, Database, Home, Users 
} from 'lucide-react';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import CalibratorCanvas from './components/CalibratorCanvas';
import TemplatesManager from './components/TemplatesManager';
import LiveBiddingRoom from './components/LiveBiddingRoom';
import AuctionsManager from './components/AuctionsManager';
import AuctionDetailPage from './components/AuctionDetailPage';
import ClientAuctionsHome from './components/ClientAuctionsHome';
import ClientAccessManager from './components/ClientAccessManager';

const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname}:8000`;
};
const API_BASE = getApiBase();

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'live', 'dashboard', 'auctions', 'clients', 'calibrator', 'templates', 'auction_detail'
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [selectedAuctionDetailId, setSelectedAuctionDetailId] = useState(null);
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState(null);

  // Verifica usuário salvo no localStorage (com fallback automático para Admin)
  useEffect(() => {
    const savedUser = localStorage.getItem('leilao_user');
    const token = localStorage.getItem('leilao_token');
    
    if (savedUser && token && token !== 'null' && token !== 'undefined') {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          setUser(parsed);
          // Busca o perfil atualizado do backend
          fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.role) {
              setUser(data);
              localStorage.setItem('leilao_user', JSON.stringify(data));
            }
          })
          .catch(e => console.error(e));
        }
      } catch (e) {
        localStorage.removeItem('leilao_user');
      }
    } else {
      // Limpa dados de sessões antigas ou falsas
      localStorage.removeItem('leilao_user');
      localStorage.removeItem('leilao_token');
    }
    fetchTemplates();
    fetchAuctions();
  }, []);



  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (e) {
      console.error('API backend offline ou não conectada ainda:', e);
    }
  };

  const fetchAuctions = async () => {
    try {
      const token = localStorage.getItem('leilao_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token && token !== 'null' && token !== 'undefined') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/auctions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAuctions(data);
      }
    } catch (e) {
      console.error('Erro ao buscar leilões:', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('leilao_token');
    localStorage.removeItem('leilao_user');
    setUser(null);
  };

  const handleEditTemplate = (t) => {
    setSelectedTemplateForEdit(t);
    setActiveTab('calibrator');
  };

  const handleViewAuctionPage = (auction) => {
    setSelectedAuctionDetailId(auction.id);
    setActiveTab('auction_detail');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SUPERIOR COM GLASSMORPHISM & DESIGN RURAL DE ELITE */}
      <header className="glass-panel" style={{
        borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0,
        position: 'sticky', top: 0, zIndex: 100, padding: '0.7rem 1.75rem'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* BRAND LOGO - TEMA PECUÁRIA IA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #16a34a 0%, #ca8a04 100%)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(22, 163, 74, 0.45)'
            }}>
              <Cpu size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                Leilão IA <span className="badge-glow" style={{ fontSize: '0.65rem', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)' }}>RURAL PRO</span>
              </h1>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                Visão Computacional para Pecuária & Agronegócio
              </span>
            </div>
          </div>

          {/* NAVEGAÇÃO DE ABAS (DESKTOP) */}
          <nav className="hide-mobile" style={{ alignItems: 'center', gap: '0.4rem', background: 'rgba(15, 23, 42, 0.75)', padding: '0.3rem', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <button 
              onClick={() => setActiveTab('home')}
              className={activeTab === 'home' ? 'btn-gradient' : 'btn-secondary'}
              style={{
                padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 700,
                background: activeTab === 'home' ? 'linear-gradient(135deg, #16a34a 0%, #059669 100%)' : undefined
              }}
            >
              <Home size={15} /> 🌾 Portal Leilões
            </button>

            <button 
              onClick={() => setActiveTab('live')}
              className={activeTab === 'live' ? 'btn-gradient' : 'btn-secondary'}
              style={{
                padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 700,
                background: activeTab === 'live' ? 'linear-gradient(135deg, #ef4444 0%, #a855f7 100%)' : undefined
              }}
            >
              <Radio size={15} color={activeTab === 'live' ? '#fff' : '#ef4444'} /> 🔴 Ao Vivo
            </button>

            <button 
              onClick={() => setActiveTab('dashboard')}
              className={activeTab === 'dashboard' ? 'btn-gradient' : 'btn-secondary'}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <LayoutDashboard size={15} /> Painel
            </button>

            <button 
              onClick={() => setActiveTab('auctions')}
              className={activeTab === 'auctions' || activeTab === 'auction_detail' ? 'btn-gradient' : 'btn-secondary'}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <Database size={15} /> Gestão Leilões
            </button>

            {isAdmin && (
              <button 
                onClick={() => setActiveTab('clients')}
                className={activeTab === 'clients' ? 'btn-gradient' : 'btn-secondary'}
                style={{
                  padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 700,
                  background: activeTab === 'clients' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : undefined
                }}
              >
                <Users size={15} /> 👥 Gestão Clientes
              </button>
            )}

            <button 
              onClick={() => setActiveTab('calibrator')}
              className={activeTab === 'calibrator' ? 'btn-gradient' : 'btn-secondary'}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <Camera size={15} /> Calibrador ROI
            </button>

            <button 
              onClick={() => setActiveTab('templates')}
              className={activeTab === 'templates' ? 'btn-gradient' : 'btn-secondary'}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <Layers size={15} /> Canais ({templates.length})
            </button>
          </nav>

          {/* ÁREA DO USUÁRIO / AUTENTICAÇÃO */}
          <div>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(74, 222, 128, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontWeight: 700
                  }}>
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="hide-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {user.full_name || 'Usuário'}
                      {user.role === 'admin' && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#38bdf8' }}>(Admin)</span>}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{user.email}</span>
                  </div>
                </div>
                <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#f87171' }} title="Sair">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className="btn-gradient" style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)' }}>
                <UserIcon size={15} /> Login Cliente / Admin
              </button>
            )}
          </div>

        </div>
      </header>

      {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA PARA DISPOSITIVOS MOBILE */}
      <nav className="mobile-bottom-nav">
        <button 
          onClick={() => setActiveTab('home')} 
          className={`mobile-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
        >
          <Home size={20} />
          <span>Início</span>
        </button>
        <button 
          onClick={() => setActiveTab('live')} 
          className={`mobile-nav-btn ${activeTab === 'live' ? 'active-live' : ''}`}
        >
          <Radio size={20} color={activeTab === 'live' ? '#ef4444' : 'currentColor'} />
          <span>Ao Vivo</span>
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('clients')} 
            className={`mobile-nav-btn ${activeTab === 'clients' ? 'active' : ''}`}
          >
            <Users size={20} />
            <span>Clientes</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('auctions')} 
          className={`mobile-nav-btn ${activeTab === 'auctions' || activeTab === 'auction_detail' ? 'active' : ''}`}
        >
          <Database size={20} />
          <span>Leilões</span>
        </button>
        <button 
          onClick={() => setActiveTab('calibrator')} 
          className={`mobile-nav-btn ${activeTab === 'calibrator' ? 'active' : ''}`}
        >
          <Camera size={20} />
          <span>Calibrar</span>
        </button>
      </nav>

      {/* CONTEÚDO PRINCIPAL DA PÁGINA */}
      <main style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem', flex: 1 }}>
        {activeTab === 'home' && (
          <ClientAuctionsHome 
            auctions={auctions}
            API_BASE={API_BASE}
            user={user}
            onSelectAuction={handleViewAuctionPage}
            onNavigateToLive={() => setActiveTab('live')}
            onNavigateToCalibrator={() => setActiveTab('calibrator')}
          />
        )}
        {activeTab === 'live' && (
          <LiveBiddingRoom 
            API_BASE={API_BASE} 
            templates={templates} 
            auctions={auctions}
            user={user}
            onNavigateToCalibrator={() => setActiveTab('calibrator')} 
          />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard templates={templates} onNavigateToCalibrator={() => setActiveTab('calibrator')} />
        )}
        {activeTab === 'auctions' && (
          <AuctionsManager 
            API_BASE={API_BASE} 
            user={user} 
            templates={templates}
            onViewAuctionPage={handleViewAuctionPage} 
          />
        )}
        {activeTab === 'clients' && (
          <ClientAccessManager 
            API_BASE={API_BASE} 
            user={user} 
          />
        )}
        {activeTab === 'auction_detail' && (
          <AuctionDetailPage 
            auctionId={selectedAuctionDetailId}
            API_BASE={API_BASE}
            onBack={() => setActiveTab('auctions')}
            onNavigateToCalibrator={() => setActiveTab('calibrator')}
            onNavigateToLive={() => setActiveTab('live')}
          />
        )}
        {activeTab === 'calibrator' && (
          <CalibratorCanvas 
            API_BASE={API_BASE} 
            user={user} 
            templates={templates}
            initialTemplate={selectedTemplateForEdit}
            onTemplateSaved={() => { fetchTemplates(); fetchAuctions(); }} 
          />
        )}
        {activeTab === 'templates' && (
          <TemplatesManager 
            templates={templates} 
            API_BASE={API_BASE} 
            onRefresh={fetchTemplates} 
            onEditTemplate={handleEditTemplate}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="hide-mobile" style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        Leilão IA Platform &copy; 2026 — Visão Computacional Avançada para Agronegócio, Pecuária e Leilões ao Vivo
      </footer>

      {/* MODAL DE AUTENTICAÇÃO */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onAuthSuccess={(u) => setUser(u)}
        API_BASE={API_BASE}
      />
    </div>
  );
}
