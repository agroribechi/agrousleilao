import React, { useState } from 'react';
import { X, Lock, Mail, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, API_BASE }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoadingText('Conectando ao servidor...');

    try {
      if (isLogin) {
        setLoadingText('Validando credenciais...');
        // Login com Supabase
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (authError) throw authError;

        localStorage.setItem('leilao_token', data.session.access_token);
        
        setLoadingText('Sincronizando perfil...');
        // Garante que o usuário existe no nosso backend também no momento do login
        const userUid = data.user.id;
        const userEmail = data.user.email;
        const userFullName = data.user.user_metadata?.full_name || '';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const syncRes = await fetch(`${API_BASE}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.session.access_token}` },
          body: JSON.stringify({
            email: userEmail,
            full_name: userFullName,
            supabase_uid: userUid
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          localStorage.setItem('leilao_user', JSON.stringify(syncData.user));
          onAuthSuccess(syncData.user);
          onClose();
        } else {
          const errData = await syncRes.json().catch(() => ({}));
          throw new Error(errData.detail || 'Falha ao sincronizar perfil do usuário com o sistema local.');
        }

      } else {
        setLoadingText('Criando conta...');
        // Cadastro com Supabase
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (authError) throw authError;
        
        if (!data.session) {
           throw new Error('Cadastro realizado. Verifique seu e-mail para confirmar a conta.');
        }

        const token = data.session.access_token;
        const userUid = data.user.id;

        setLoadingText('Sincronizando cadastro...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Sincroniza com nosso banco de dados
        const syncRes = await fetch(`${API_BASE}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            email,
            full_name: fullName,
            supabase_uid: userUid
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!syncRes.ok) {
          throw new Error('Falha ao sincronizar cadastro com banco de dados local.');
        }

        const syncData = await syncRes.json();
        
        localStorage.setItem('leilao_token', token);
        localStorage.setItem('leilao_user', JSON.stringify(syncData.user));
        
        onAuthSuccess(syncData.user);
        onClose();
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('O servidor demorou muito para responder. Verifique se o backend está rodando.');
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 8000.');
      } else {
        setError(err.message || 'Ocorreu um erro na autenticação.');
      }
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '440px', width: '100%', padding: '2.5rem',
        position: 'relative', border: '1px solid rgba(99, 102, 241, 0.3)'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 1rem',
            background: 'var(--accent-gradient)', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldCheck color="#fff" size={26} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {isLogin ? 'Entre para gerenciar leilões e templates' : 'Cadastre-se para obter acesso completo'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fecdd3', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1.25rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nome Completo</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type="text" required 
                  className="glass-input" style={{ paddingLeft: '2.4rem' }}
                  placeholder="Seu Nome"
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>E-mail corporativo</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="email" required 
                className="glass-input" style={{ paddingLeft: '2.4rem' }}
                placeholder="seu.email@exemplo.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Senha de Acesso</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="password" required 
                className="glass-input" style={{ paddingLeft: '2.4rem' }}
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-gradient" style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? (loadingText || 'Processando...') : (isLogin ? 'Entrar no Sistema' : 'Cadastrar Conta')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isLogin ? 'Ainda não tem conta? ' : 'Já possui uma conta? '}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer' }}
          >
            {isLogin ? 'Cadastre-se' : 'Fazer Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
