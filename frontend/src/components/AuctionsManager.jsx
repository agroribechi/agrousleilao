import React, { useState, useEffect } from 'react';
import { 
  Database, Plus, Users, Search, Box, Calendar, Edit3, Trash2, 
  X, AlertCircle, MapPin, Phone, MessageCircle, Globe, Award, 
  Building2, ExternalLink, Image as ImageIcon, CheckCircle, Eye,
  Save, RotateCcw
} from 'lucide-react';

const EMPTY_FORM = {
  title: '',
  description: '',
  start_date: new Date().toISOString().slice(0,16),
  status: 'Agendado',
  logo_url: '',
  banner_url: '',
  auctioneer_name: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  phone_primary: '',
  phone_whatsapp: '',
  website_url: '',
  social_instagram: '',
  payment_status: 'Gratuito',
  plan_tier: 'Gratuito',
  template_id: ''
};

export default function AuctionsManager({ API_BASE, user, onViewAuctionPage, templates = [] }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'admin';

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAuctionId, setEditingAuctionId] = useState(null); // null = creating, number = editing
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [activeTabModal, setActiveTabModal] = useState('media');
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null); // auction object or null
  const [deleting, setDeleting] = useState(false);

  // Toast notification
  const [toast, setToast] = useState(null);

  // Form State (shared for create & edit)
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // Access Management
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Search / filter
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAuctions();
    if (isAdmin) fetchUsers();
  }, [user]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const getHeaders = () => {
    const token = localStorage.getItem('leilao_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'null' && token !== 'undefined') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchAuctions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auctions`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuctions(data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Falha ao carregar leilões');
      }
    } catch (err) {
      console.error("DEBUG FETCH ERROR:", err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Não foi possível conectar ao servidor backend. Verifique se ele está rodando.');
      } else {
        setError(`Erro: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ ...prev, [field]: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- OPEN MODALS ---

  const openCreateModal = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingAuctionId(null);
    setActiveTabModal('media');
    setIsFormModalOpen(true);
  };

  const openEditModal = (auction) => {
    setFormData({
      title: auction.title || '',
      description: auction.description || '',
      start_date: auction.start_date ? new Date(auction.start_date).toISOString().slice(0,16) : '',
      status: auction.status || 'Agendado',
      logo_url: auction.logo_url || '',
      banner_url: auction.banner_url || '',
      auctioneer_name: auction.auctioneer_name || '',
      address_street: auction.address_street || '',
      address_city: auction.address_city || '',
      address_state: auction.address_state || '',
      address_zip: auction.address_zip || '',
      phone_primary: auction.phone_primary || '',
      phone_whatsapp: auction.phone_whatsapp || '',
      website_url: auction.website_url || '',
      social_instagram: auction.social_instagram || '',
      payment_status: auction.payment_status || 'Gratuito',
      plan_tier: auction.plan_tier || 'Gratuito',
      template_id: auction.template_id ? String(auction.template_id) : ''
    });
    setEditingAuctionId(auction.id);
    setActiveTabModal('media');
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingAuctionId(null);
    setFormSaving(false);
  };

  // --- CREATE / UPDATE ---

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    try {
      const payload = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        template_id: formData.template_id ? Number(formData.template_id) : null
      };

      const isEditing = editingAuctionId !== null;
      const url = isEditing
        ? `${API_BASE}/api/auctions/${editingAuctionId}`
        : `${API_BASE}/api/auctions`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeFormModal();
        fetchAuctions();
        showToast(isEditing ? 'Leilão atualizado com sucesso!' : 'Leilão cadastrado com sucesso!');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Erro: ${errData.detail || 'Falha ao salvar leilão'}`);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setFormSaving(false);
    }
  };

  // --- DELETE ---

  const handleDeleteAuction = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auctions/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchAuctions();
        showToast('Leilão excluído com sucesso!');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Erro: ${errData.detail || 'Falha ao excluir leilão'}`);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // --- ACCESS MODAL ---

  const openAccessModal = async (auction) => {
    setSelectedAuction(auction);
    try {
      const res = await fetch(`${API_BASE}/api/auctions/${auction.id}`, { headers: getHeaders() });
      if (res.ok) {
        const detail = await res.json();
        setSelectedUserIds(detail.allowed_user_ids || []);
        setIsAccessModalOpen(true);
      } else {
        alert('Falha ao obter detalhes do leilão.');
      }
    } catch(e) {
      alert('Erro de conexão ao buscar leilão.');
    }
  };

  const handleSaveAccess = async () => {
    if (!selectedAuction) return;
    try {
      const res = await fetch(`${API_BASE}/api/auctions/${selectedAuction.id}/access`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ user_ids: selectedUserIds })
      });
      if (res.ok) {
        showToast('Permissões atualizadas com sucesso!');
        setIsAccessModalOpen(false);
      } else {
        const errData = await res.json();
        alert(`Erro: ${errData.detail}`);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  // --- FILTERING ---

  const filteredAuctions = auctions.filter(a => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (a.title || '').toLowerCase().includes(term) ||
      (a.auctioneer_name || '').toLowerCase().includes(term) ||
      (a.address_city || '').toLowerCase().includes(term) ||
      (a.status || '').toLowerCase().includes(term) ||
      (a.description || '').toLowerCase().includes(term)
    );
  });

  // --- RENDER ---

  if (!user) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 1rem' }} />
        <h2>Acesso Restrito</h2>
        <p style={{ color: 'var(--text-muted)' }}>Faça login para gerenciar leilões.</p>
      </div>
    );
  }

  // Shared input style helper
  const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 2000,
          background: toast.type === 'success' ? 'rgba(22, 163, 74, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#fff', padding: '0.85rem 1.5rem', borderRadius: '12px',
          fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <CheckCircle size={18} />
          {toast.message}
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Leilões Promovidos & Cadastrados</h2>
          <p style={{ color: 'var(--text-muted)' }}>Gerencie os leilões com logotipo, endereço, contatos e divulgação personalizada.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* SEARCH BAR */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              className="glass-input"
              placeholder="Buscar leilão..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.2rem', width: '220px', fontSize: '0.85rem' }}
            />
          </div>
          {isAdmin && (
            <button onClick={openCreateModal} className="btn-gradient">
              <Plus size={18} /> Cadastrar Novo Leilão
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Carregando leilões...</div>
      ) : filteredAuctions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
          <Database size={48} color="rgba(99, 102, 241, 0.4)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {searchTerm ? 'Nenhum leilão encontrado para esta busca' : 'Nenhum leilão disponível'}
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {searchTerm ? 'Tente termos diferentes.' : 'Nenhum leilão cadastrado no momento.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredAuctions.map(auction => {
            const isPaid = auction.payment_status === 'Pago - Destaque' || auction.plan_tier === 'Destaque Ouro' || auction.plan_tier === 'Patrocinado Premium';
            const cleanWhatsapp = auction.phone_whatsapp ? auction.phone_whatsapp.replace(/\D/g, '') : '';

            return (
              <div key={auction.id} className="glass-panel hover-glow" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                
                {/* TOPO DO CARD COM LOGOTIPO & BADGES */}
                <div style={{
                  padding: '1.25rem',
                  background: auction.banner_url ? `url(${auction.banner_url}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.95) 100%)',
                  position: 'relative', minHeight: '120px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.75)' }} />

                  {/* AVATAR DO LOGOTIPO */}
                  <div style={{
                    width: '60px', height: '60px', borderRadius: '12px', background: '#0f172a',
                    border: '2px solid rgba(99, 102, 241, 0.5)', zIndex: 2, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                  }}>
                    {auction.logo_url ? (
                      <img src={auction.logo_url} alt={auction.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }} />
                    ) : (
                      <Building2 size={28} color="#818cf8" />
                    )}
                  </div>

                  {/* BADGES DE STATUS + ADMIN ACTIONS */}
                  <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span className="badge-glow" style={{ 
                      background: auction.status === 'Ao Vivo' ? 'rgba(239, 68, 68, 0.25)' : auction.status === 'Encerrado' ? 'rgba(100,116,139,0.25)' : 'rgba(59, 130, 246, 0.25)',
                      color: auction.status === 'Ao Vivo' ? '#f87171' : auction.status === 'Encerrado' ? '#94a3b8' : '#38bdf8',
                      fontSize: '0.7rem'
                    }}>
                      {auction.status}
                    </span>

                    {isPaid && (
                      <span className="badge-glow" style={{ background: 'rgba(234, 179, 8, 0.25)', color: '#facc15', fontSize: '0.65rem' }}>
                        <Award size={12} style={{ marginRight: '3px' }} /> Destaque Pago
                      </span>
                    )}

                    {/* ADMIN: EDIT & DELETE QUICK ACTIONS */}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem' }}>
                        <button
                          onClick={() => openEditModal(auction)}
                          title="Editar Leilão"
                          style={{
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.5)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'; }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(auction)}
                          title="Excluir Leilão"
                          style={{
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.45)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* CORPO DO CARD */}
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                    {auction.auctioneer_name || 'Leiloeira Oficial'}
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{auction.title}</h3>
                  
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', flex: 1, margin: 0 }}>
                    {auction.description || 'Sem descrição.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} color="#818cf8" />
                      {new Date(auction.start_date).toLocaleString('pt-BR')}
                    </div>
                    {auction.address_city && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MapPin size={14} color="#f87171" />
                        {auction.address_city}{auction.address_state ? ` - ${auction.address_state}` : ''}
                      </div>
                    )}
                    {auction.template_id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Box size={14} color="#22d3ee" />
                        Template #{auction.template_id}
                      </div>
                    )}
                  </div>

                  {/* AÇÕES */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button 
                      onClick={() => onViewAuctionPage && onViewAuctionPage(auction)} 
                      className="btn-gradient"
                      style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <Eye size={16} /> Página do Leilão
                    </button>

                    {auction.phone_whatsapp && (
                      <a 
                        href={`https://wa.me/${cleanWhatsapp}`} 
                        target="_blank" rel="noreferrer"
                        className="btn-secondary" 
                        style={{ padding: '0.5rem', color: '#22c55e' }} 
                        title="Contato WhatsApp"
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}

                    {isAdmin && (
                      <>
                        <button onClick={() => openEditModal(auction)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Editar Leilão">
                          <Edit3 size={16} color="#fbbf24" />
                        </button>
                        <button onClick={() => openAccessModal(auction)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Gerenciar Permissões">
                          <Users size={16} color="#818cf8" />
                        </button>
                      </>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL CRIAR / EDITAR LEILÃO (Apenas Admin)                  */}
      {/* ============================================================ */}
      {isFormModalOpen && isAdmin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '680px', width: '100%', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={closeFormModal} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={22} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingAuctionId ? (
                <><Edit3 size={22} color="#fbbf24" /> Editar Leilão</>
              ) : (
                <><Plus size={22} color="#22c55e" /> Cadastrar Novo Leilão Promovido</>
              )}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              {editingAuctionId
                ? 'Altere os dados do leilão e clique em salvar para aplicar as mudanças.'
                : 'Preencha os dados completos do leilão para gerar a sua página personalizada e vinculá-lo ao Calibrador ROI.'
              }
            </p>

            {/* ABAS DO MODAL */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { key: 'media', icon: '📷', label: 'Mídia & Dados' },
                { key: 'address', icon: '📍', label: 'Endereço' },
                { key: 'contact', icon: '📞', label: 'Contatos' },
                { key: 'plan', icon: '⭐', label: 'Plano & Pagamento' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTabModal(tab.key)}
                  className={activeTabModal === tab.key ? 'btn-gradient' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            
            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* ABA 1: MÍDIA E IDENTIFICAÇÃO */}
              {activeTabModal === 'media' && (
                <>
                  <div>
                    <label style={labelStyle}>Título do Leilão *</label>
                    <input type="text" required className="glass-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Leilão Nelore Elite de Unaí" />
                  </div>

                  <div>
                    <label style={labelStyle}>Nome da Leiloeira / Empresa</label>
                    <input type="text" className="glass-input" value={formData.auctioneer_name} onChange={e => setFormData({...formData, auctioneer_name: e.target.value})} placeholder="Ex: Leiloboi Unai Ltda" />
                  </div>

                  <div>
                    <label style={labelStyle}>Logotipo do Leilão (Upload ou URL)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {formData.logo_url && (
                        <img src={formData.logo_url} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', background: '#0f172a', border: '1px solid #818cf8' }} />
                      )}
                      <label className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                        📤 Upload Logo
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'logo_url')} style={{ display: 'none' }} />
                      </label>
                      <input type="text" className="glass-input" value={formData.logo_url} onChange={e => setFormData({...formData, logo_url: e.target.value})} placeholder="https://..." style={{ fontSize: '0.85rem' }} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Imagem de Banner de Capa (Upload ou URL)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {formData.banner_url && (
                        <img src={formData.banner_url} alt="Banner" style={{ width: '60px', height: '35px', borderRadius: '6px', objectFit: 'cover', background: '#0f172a', border: '1px solid var(--border-subtle)' }} />
                      )}
                      <label className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                        🖼️ Upload Banner
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'banner_url')} style={{ display: 'none' }} />
                      </label>
                      <input type="text" className="glass-input" value={formData.banner_url} onChange={e => setFormData({...formData, banner_url: e.target.value})} placeholder="https://..." style={{ fontSize: '0.85rem' }} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Descrição Detalhada</label>
                    <textarea className="glass-input" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Informações sobre os lotes, raça, condição de pagamento..."></textarea>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Data e Hora de Início *</label>
                      <input type="datetime-local" required className="glass-input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                    </div>
                    <div>
                      <label style={labelStyle}>Status Transmissão</label>
                      <select className="glass-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="Agendado">Agendado</option>
                        <option value="Ao Vivo">Ao Vivo</option>
                        <option value="Encerrado">Encerrado</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* ABA 2: ENDEREÇO */}
              {activeTabModal === 'address' && (
                <>
                  <div>
                    <label style={labelStyle}>Endereço do Recinto (Rua, Nº, Bairro)</label>
                    <input type="text" className="glass-input" value={formData.address_street} onChange={e => setFormData({...formData, address_street: e.target.value})} placeholder="Ex: Rodovia BR-251, Km 5 - Parque de Exposições" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Cidade</label>
                      <input type="text" className="glass-input" value={formData.address_city} onChange={e => setFormData({...formData, address_city: e.target.value})} placeholder="Unaí" />
                    </div>
                    <div>
                      <label style={labelStyle}>Estado (UF)</label>
                      <input type="text" className="glass-input" value={formData.address_state} onChange={e => setFormData({...formData, address_state: e.target.value})} placeholder="MG" />
                    </div>
                    <div>
                      <label style={labelStyle}>CEP</label>
                      <input type="text" className="glass-input" value={formData.address_zip} onChange={e => setFormData({...formData, address_zip: e.target.value})} placeholder="38610-000" />
                    </div>
                  </div>
                </>
              )}

              {/* ABA 3: CONTATOS */}
              {activeTabModal === 'contact' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>WhatsApp de Atendimento/Lances</label>
                      <input type="text" className="glass-input" value={formData.phone_whatsapp} onChange={e => setFormData({...formData, phone_whatsapp: e.target.value})} placeholder="(38) 99999-9999" />
                    </div>
                    <div>
                      <label style={labelStyle}>Telefone Principal</label>
                      <input type="text" className="glass-input" value={formData.phone_primary} onChange={e => setFormData({...formData, phone_primary: e.target.value})} placeholder="(38) 3671-0000" />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Site Oficial da Leiloeira</label>
                    <input type="text" className="glass-input" value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="https://www.leiloeira.com.br" />
                  </div>

                  <div>
                    <label style={labelStyle}>Instagram</label>
                    <input type="text" className="glass-input" value={formData.social_instagram} onChange={e => setFormData({...formData, social_instagram: e.target.value})} placeholder="@leiloeira_oficial" />
                  </div>
                </>
              )}

              {/* ABA 4: PLANO & PAGAMENTO */}
              {activeTabModal === 'plan' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Plano de Divulgação</label>
                      <select className="glass-input" value={formData.plan_tier} onChange={e => setFormData({...formData, plan_tier: e.target.value})}>
                        <option value="Gratuito">Gratuito</option>
                        <option value="Destaque Ouro">⭐ Destaque Ouro</option>
                        <option value="Patrocinado Premium">👑 Patrocinado Premium</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status de Pagamento</label>
                      <select className="glass-input" value={formData.payment_status} onChange={e => setFormData({...formData, payment_status: e.target.value})}>
                        <option value="Gratuito">Gratuito</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Pago - Destaque">Pago - Destaque Ativo</option>
                      </select>
                    </div>
                  </div>

                  {templates.length > 0 && (
                    <div>
                      <label style={labelStyle}>Vincular ao Gabarito do Calibrador ROI</label>
                      <select className="glass-input" value={formData.template_id} onChange={e => setFormData({...formData, template_id: e.target.value})}>
                        <option value="">Nenhum — vincular mais tarde</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>📂 {t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* BOTÕES DE AÇÃO */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={closeFormModal} className="btn-secondary" style={{ padding: '0.75rem 1.25rem' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={formSaving} className="btn-gradient" style={{ flex: 1, padding: '0.75rem' }}>
                  {formSaving ? (
                    <><RotateCcw size={18} className="spin" /> Salvando...</>
                  ) : editingAuctionId ? (
                    <><Save size={18} /> Salvar Alterações</>
                  ) : (
                    <><CheckCircle size={18} /> Salvar e Publicar Cadastro do Leilão</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL CONFIRMAÇÃO DE EXCLUSÃO                                */}
      {/* ============================================================ */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 1.25rem',
              background: 'rgba(239, 68, 68, 0.15)', border: '2px solid rgba(239, 68, 68, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Trash2 size={26} color="#f87171" />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Excluir Leilão?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Tem certeza que deseja excluir o leilão:
            </p>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#f87171', marginBottom: '1.5rem' }}>
              "{deleteConfirm.title}"
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Esta ação não pode ser desfeita. Todos os dados, lotes e permissões associados serão removidos.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
                style={{ flex: 1, padding: '0.7rem' }}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAuction}
                disabled={deleting}
                style={{
                  flex: 1, padding: '0.7rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#fff', border: 'none', cursor: deleting ? 'wait' : 'pointer',
                  opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                }}
              >
                {deleting ? <><RotateCcw size={16} /> Excluindo...</> : <><Trash2 size={16} /> Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL GERENCIAR ACESSOS (Apenas Admin)                      */}
      {/* ============================================================ */}
      {isAccessModalOpen && isAdmin && selectedAuction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '600px', width: '100%', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsAccessModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Gerenciar Permissões de Acesso</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Leilão: <strong>{selectedAuction.title}</strong></p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(15,23,42,0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
              {allUsers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum usuário cadastrado no sistema.</p>
              ) : (
                allUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <input 
                      type="checkbox" 
                      id={`user-${u.id}`}
                      checked={selectedUserIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                        else setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                      }}
                      style={{ width: '16px', height: '16px', accentColor: '#818cf8' }}
                    />
                    <label htmlFor={`user-${u.id}`} style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{u.full_name || 'Sem Nome'} {u.role === 'admin' ? '(Admin)' : ''}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.email}</span>
                    </label>
                  </div>
                ))
              )}
            </div>

            <button onClick={handleSaveAccess} className="btn-gradient" style={{ width: '100%' }}>
              Salvar Permissões
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
