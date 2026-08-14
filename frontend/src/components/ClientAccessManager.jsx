import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Lock, Unlock, CheckCircle, Shield, Key, 
  Building2, Calendar, X, AlertCircle, Save, Edit3, Phone, Mail, FileText, UserCheck
} from 'lucide-react';

export default function ClientAccessManager({ API_BASE, user }) {
  const [users, setUsers] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de Liberação Individual de Leilões
  const [selectedClient, setSelectedClient] = useState(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedAuctionIds, setSelectedAuctionIds] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Modal de Edição de Dados do Cliente
  const [editingClient, setEditingClient] = useState(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', phone: '', document: '', role: 'user' });

  const isAdmin = user?.role === 'admin';

  const getHeaders = () => {
    const token = localStorage.getItem('leilao_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAuctions();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        throw new Error('Falha ao carregar lista de clientes');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuctions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auctions`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuctions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openAccessModal = (client) => {
    setSelectedClient(client);
    setSelectedAuctionIds(client.accessible_auction_ids || []);
    setIsAccessModalOpen(true);
  };

  const toggleAuctionPermission = (auctionId) => {
    if (selectedAuctionIds.includes(auctionId)) {
      setSelectedAuctionIds(selectedAuctionIds.filter(id => id !== auctionId));
    } else {
      setSelectedAuctionIds([...selectedAuctionIds, auctionId]);
    }
  };

  const handleSelectAllAuctions = () => {
    setSelectedAuctionIds(auctions.map(a => a.id));
  };

  const handleClearAllAuctions = () => {
    setSelectedAuctionIds([]);
  };

  const handleSaveClientAccess = async () => {
    if (!selectedClient) return;
    setSavingAccess(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${selectedClient.id}/access`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ auction_ids: selectedAuctionIds })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Autorizações atualizadas com sucesso para ${selectedClient.full_name || selectedClient.email}!`);
        setIsAccessModalOpen(false);
        fetchUsers();
      } else {
        throw new Error(data.detail || 'Falha ao salvar acessos');
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingAccess(false);
    }
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setEditFormData({
      full_name: client.full_name || '',
      phone: client.phone || '',
      document: client.document || '',
      role: client.role || 'user'
    });
  };

  const handleSaveClientData = async (e) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${editingClient.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setEditingClient(null);
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(`Erro: ${errData.detail || 'Falha ao atualizar cliente'}`);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const doc = (u.document || '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q) || doc.includes(q);
  });

  if (!user || !isAdmin) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 1rem' }} />
        <h2>Acesso Restrito a Administradores</h2>
        <p style={{ color: 'var(--text-muted)' }}>Faça login com uma conta de Administrador para gerenciar acessos de clientes.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* CABEÇALHO DA GESTÃO DE CLIENTES */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={28} color="#818cf8" /> Gestão de Clientes & Liberação Individual
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            Autorize ou revogue individualmente o acesso de cada cliente aos leilões cadastrados.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge-glow" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            👥 {users.length} Clientes Cadastrados
          </span>
        </div>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Search size={20} color="var(--text-muted)" />
        <input 
          type="text" 
          className="glass-input" 
          placeholder="Buscar cliente por nome, e-mail, telefone ou CPF/CNPJ..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ fontSize: '0.925rem', height: '42px' }}
        />
      </div>

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
          {error}
        </div>
      )}

      {/* GRADE DE CARDS DOS CLIENTES */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Carregando clientes...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={48} style={{ opacity: 0.4, marginBottom: '1rem' }} />
          <h3>Nenhum cliente encontrado</h3>
          <p style={{ fontSize: '0.85rem' }}>Nenhum usuário coincide com os termos da pesquisa.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {filteredUsers.map(client => {
            const accessibleCount = client.accessible_auction_ids ? client.accessible_auction_ids.length : 0;
            const isClientAdmin = client.role === 'admin';

            return (
              <div key={client.id} className="glass-panel hover-glow" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  
                  {/* CABEÇALHO DO CARD COM AVATAR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: isClientAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      border: isClientAdmin ? '2px solid rgba(56, 189, 248, 0.5)' : '2px solid rgba(99, 102, 241, 0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, color: isClientAdmin ? '#38bdf8' : '#818cf8', fontSize: '1.2rem',
                      flexShrink: 0
                    }}>
                      {client.full_name ? client.full_name.charAt(0).toUpperCase() : client.email.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {client.full_name || 'Cliente Sem Nome'}
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.email}
                      </span>
                    </div>

                    <span className="badge-glow" style={{
                      background: isClientAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      color: isClientAdmin ? '#38bdf8' : '#4ade80',
                      fontSize: '0.68rem', alignSelf: 'flex-start'
                    }}>
                      {isClientAdmin ? 'Admin' : 'Cliente'}
                    </span>
                  </div>

                  {/* DETALHES DE CONTATO E DOCUMENTO */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <Phone size={14} color="#818cf8" />
                      <span>{client.phone || 'Telefone não cadastrado'}</span>
                    </div>

                    {client.document && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <FileText size={14} color="#facc15" />
                        <span>CPF/CNPJ: {client.document}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <Lock size={14} color={accessibleCount > 0 ? '#4ade80' : '#f87171'} />
                      <span style={{ fontWeight: 700, color: accessibleCount > 0 ? '#4ade80' : '#f87171' }}>
                        {accessibleCount > 0 ? `${accessibleCount} leilão(ões) liberado(s)` : 'Nenhum leilão liberado'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* BOTÕES DE AÇÃO */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button 
                    onClick={() => openAccessModal(client)} 
                    className="btn-gradient" 
                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                    <Key size={16} /> Liberação de Leilões
                  </button>

                  <button 
                    onClick={() => openEditModal(client)} 
                    className="btn-secondary" 
                    style={{ padding: '0.6rem' }}
                    title="Editar Dados do Cliente"
                  >
                    <Edit3 size={16} color="#818cf8" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE LIBERAÇÃO INDIVIDUAL DE LEILÕES PARA O CLIENTE */}
      {isAccessModalOpen && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '650px', width: '100%', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <button onClick={() => setIsAccessModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={22} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#818cf8' }}>
                {selectedClient.full_name ? selectedClient.full_name.charAt(0).toUpperCase() : selectedClient.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Autorização de Leilões: {selectedClient.full_name || 'Cliente'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedClient.email}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Marque abaixo os leilões para os quais este cliente terá permissão para assistir e participar:
            </p>

            {/* BOTÕES DE SELEÇÃO EM MASSA */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button onClick={handleSelectAllAuctions} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: '#4ade80' }}>
                <CheckCircle size={14} /> Liberar Todos
              </button>
              <button onClick={handleClearAllAuctions} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: '#f87171' }}>
                <X size={14} /> Revogar Todos
              </button>
            </div>

            {/* LISTA DE LEILÕES COM TOGGLE SWITCH */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '0.25rem', marginBottom: '1.5rem' }}>
              {auctions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum leilão cadastrado no sistema.</div>
              ) : (
                auctions.map(auction => {
                  const isAllowed = selectedAuctionIds.includes(auction.id);

                  return (
                    <div 
                      key={auction.id}
                      onClick={() => toggleAuctionPermission(auction.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1rem', borderRadius: '12px', cursor: 'pointer',
                        background: isAllowed ? 'rgba(34, 197, 94, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                        border: isAllowed ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border-subtle)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {/* LOGO DO LEILÃO */}
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '10px', background: '#0f172a',
                          border: '1px solid var(--border-subtle)', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {auction.logo_url ? (
                            <img src={auction.logo_url} alt={auction.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
                          ) : (
                            <Building2 size={20} color="#818cf8" />
                          )}
                        </div>

                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.15rem', color: isAllowed ? '#fff' : 'var(--text-dim)' }}>
                            {auction.title}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Calendar size={12} />
                            {new Date(auction.start_date).toLocaleDateString('pt-BR')}
                            <span className="badge-glow" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>{auction.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* BADGE TOGGLE AUTORIZADO / BLOQUEADO */}
                      <span className="badge-glow" style={{
                        background: isAllowed ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        color: isAllowed ? '#4ade80' : '#94a3b8',
                        borderColor: isAllowed ? 'rgba(74, 222, 128, 0.5)' : 'transparent',
                        fontWeight: 700, fontSize: '0.75rem', padding: '0.35rem 0.75rem'
                      }}>
                        {isAllowed ? '🟢 LIBERADO' : '⚪ BLOQUEADO'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={handleSaveClientAccess} 
              disabled={savingAccess}
              className="btn-gradient" 
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }}
            >
              <Save size={18} /> {savingAccess ? 'Salvando Permissões...' : 'Salvar Autorizações do Cliente'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE DADOS DO CLIENTE */}
      {editingClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '2rem', position: 'relative' }}>
            
            <button onClick={() => setEditingClient(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Editar Cadastro do Cliente</h3>

            <form onSubmit={handleSaveClientData} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nome Completo</label>
                <input type="text" className="glass-input" value={editFormData.full_name} onChange={e => setEditFormData({...editFormData, full_name: e.target.value})} placeholder="Nome do Cliente" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Telefone WhatsApp</label>
                <input type="text" className="glass-input" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} placeholder="(00) 90000-0000" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>CPF ou CNPJ</label>
                <input type="text" className="glass-input" value={editFormData.document} onChange={e => setEditFormData({...editFormData, document: e.target.value})} placeholder="000.000.000-00" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nível de Permissão</label>
                <select className="glass-input" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})}>
                  <option value="user">Cliente (Usuário Comum)</option>
                  <option value="admin">Administrador (Acesso Total)</option>
                </select>
              </div>

              <button type="submit" className="btn-gradient" style={{ marginTop: '0.5rem', padding: '0.7rem' }}>
                <Save size={16} /> Salvar Dados do Cliente
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
