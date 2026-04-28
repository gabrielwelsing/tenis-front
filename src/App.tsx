// =============================================================================
// APP — Autenticação via API (banco) + JWT no localStorage
// =============================================================================

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { login, register, loginGoogle, getMe, updateProfile, type UserRecord } from '@services/apiService';
import { setCurrentUser } from '@services/localSaveService';
import CameraScreen       from '@screens/CameraScreen';
import HistoryScreen      from '@screens/HistoryScreen';
import BiomechanicsScreen from '@screens/BiomechanicsScreen';
import HomeScreen         from '@screens/HomeScreen';
import ComparisonScreen   from '@screens/ComparisonScreen';
import InstagramScreen    from '@screens/InstagramScreen';
import MuralScreen        from '@screens/MuralScreen';
import AgendaScreen       from '@screens/AgendaScreen';
import RankingScreen      from '@screens/RankingScreen';

const GOOGLE_CLIENT_ID  = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const CLOUDINARY_CLOUD  = 'dgier8xfp';
const CLOUDINARY_PRESET = 'tenis-to';
const API_URL           = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';
const TOKEN_KEY = 'tenis_token';

export type SaveMode = 'drive' | 'local';
export type Screen   = 'camera' | 'history' | 'biomechanics' | 'home' | 'comparison' | 'instagram' | 'mural' | 'agenda' | 'ranking';
export type Role     = 'user' | 'aluno' | 'admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function uploadFotoCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Erro ao fazer upload da foto.');
  const data = await res.json();
  return data.secure_url as string;
}

// ---------------------------------------------------------------------------
// Modal de Pagamento
// ---------------------------------------------------------------------------
function ModalPagamento({ user, onClose, onSuccess }: {
  user: UserRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep]       = useState<'escolha' | 'pix' | 'cartao_redirect' | 'loading'>('escolha');
  const [qrCode, setQrCode]   = useState('');
  const [qrB64, setQrB64]     = useState('');
  const [erro, setErro]       = useState('');
  const [copiado, setCopiado] = useState(false);

  const criar = async (tipo: 'pix' | 'cartao') => {
    setErro('');
    setStep('loading');
    try {
      const res = await fetch(`${API_URL}/payment/criar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: user.id, email: user.email, tipo }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error ?? 'Erro ao criar pagamento.'); setStep('escolha'); return; }

      if (tipo === 'pix') {
        setQrCode(data.qr_code ?? '');
        setQrB64(data.qr_code_b64 ?? '');
        setStep('pix');
      } else {
        window.open(data.init_point, '_blank');
        setStep('cartao_redirect');
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
      setStep('escolha');
    }
  };

  const copiarPix = () => {
    navigator.clipboard.writeText(qrCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div style={mp.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={mp.sheet}>
        <button onClick={onClose} style={mp.closeBtn}>✕</button>

        {step === 'escolha' && (
          <>
            <div style={mp.icon}>⚡</div>
            <h2 style={mp.title}>Assine o Plano Mensal</h2>
            <p style={mp.sub}>R$ 14,90/mês — acesso total a todas as funcionalidades</p>
            {erro && <p style={mp.erro}>{erro}</p>}
            <div style={mp.btnGroup}>
              <button style={mp.btnPix} onClick={() => criar('pix')}>
                <span style={{ fontSize: 20 }}>📱</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Pagar com PIX</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Acesso imediato após pagamento</div>
                </div>
              </button>
              <button style={mp.btnCartao} onClick={() => criar('cartao')}>
                <span style={{ fontSize: 20 }}>💳</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Cartão de Crédito</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Renovação automática mensal</div>
                </div>
              </button>
            </div>
            <p style={mp.hint}>Pagamento seguro via Mercado Pago</p>
          </>
        )}

        {step === 'loading' && (
          <>
            <div style={{ fontSize: 40 }}>⏳</div>
            <p style={mp.sub}>Gerando pagamento...</p>
          </>
        )}

        {step === 'pix' && (
          <>
            <h2 style={mp.title}>Pague via PIX</h2>
            <p style={mp.sub}>Escaneie o QR Code ou copie o código</p>
            {qrB64 && (
              <img
                src={`data:image/png;base64,${qrB64}`}
                alt="QR Code PIX"
                style={{ width: 200, height: 200, borderRadius: 12, background: '#fff', padding: 8 }}
              />
            )}
            <button style={mp.btnCopiar} onClick={copiarPix}>
              {copiado ? '✓ Copiado!' : '📋 Copiar código PIX'}
            </button>
            <p style={{ ...mp.hint, marginTop: 8 }}>
              Após o pagamento, seu acesso será liberado automaticamente em até 1 minuto.
            </p>
            <button style={mp.btnVoltar} onClick={() => setStep('escolha')}>← Voltar</button>
          </>
        )}

        {step === 'cartao_redirect' && (
          <>
            <div style={{ fontSize: 40 }}>🔗</div>
            <h2 style={mp.title}>Redirecionado!</h2>
            <p style={mp.sub}>Complete o pagamento na página do Mercado Pago que foi aberta.</p>
            <p style={{ ...mp.hint, marginTop: 8 }}>
              Após confirmar, seu acesso será liberado automaticamente.
            </p>
            <button style={mp.btnVoltar} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginScreen
// ---------------------------------------------------------------------------
function InstaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="white" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
    </svg>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: UserRecord, token: string) => void }) {
  const [mode,       setMode]       = useState<'login' | 'register'>('login');
  const [nome,       setNome]       = useState('');
  const [email,      setEmail]      = useState('');
  const [pass,       setPass]       = useState('');
  const [localidade, setLocalidade] = useState('');
  const [telefone,   setTelefone]   = useState('');
  const [error,      setError]      = useState('');
  const [info,       setInfo]       = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleSubmit = async () => {
    setError(''); setInfo('');
    const rawEmail = email.trim().toLowerCase();
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) { setError('E-mail inválido.'); return; }
    if (!pass)                                     { setError('Preencha a senha.'); return; }
    if (mode === 'register' && !nome.trim())       { setError('Preencha seu nome.'); return; }
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await login(rawEmail, pass)
        : await register(nome.trim(), rawEmail, pass, localidade || undefined, telefone || undefined);
      localStorage.setItem(TOKEN_KEY, res.token);
      if (mode === 'register') setInfo('Cadastro realizado! Bem-vindo(a).');
      setTimeout(() => onLogin(res.user, res.token), 300);
    } catch (e: any) {
      setError(e.message ?? 'Erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    setLoading(true);
    try {
      const res = await loginGoogle(credentialResponse.credential);
      localStorage.setItem(TOKEN_KEY, res.token);
      onLogin(res.user, res.token);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao entrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.bgImage} />
      <div style={s.bgOverlay} />
      <div style={s.bgSides} />
      <a href="https://www.instagram.com/jogartenisto/" target="_blank" rel="noopener noreferrer" style={s.instaCorner}>
        <InstaIcon />
      </a>
      <div style={s.card}>
        <h1 style={s.title}>Tenis Coach com Carlão</h1>
        <p style={s.sub}>Entre com seu perfil</p>
        <div style={s.modeToggle}>
          <button onClick={() => { setMode('login'); setError(''); }} style={{ ...s.modeBtn, ...(mode === 'login' ? s.modeBtnActive : {}) }}>Entrar</button>
          <button onClick={() => { setMode('register'); setError(''); }} style={{ ...s.modeBtn, ...(mode === 'register' ? s.modeBtnActive : {}) }}>Cadastrar</button>
        </div>
        <div style={s.googleWrap}>
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Falha ao entrar com Google.')} text={mode === 'login' ? 'signin_with' : 'signup_with'} shape="rectangular" theme="filled_black" width="312" />
        </div>
        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>ou</span>
          <div style={s.dividerLine} />
        </div>
        <div style={s.admForm}>
          {mode === 'register' && (
            <>
              <input style={s.input} placeholder="Seu nome *" type="text" value={nome} onChange={e => setNome(e.target.value)} autoCapitalize="words" />
              <input style={s.input} placeholder="Cidade / Localidade" type="text" value={localidade} onChange={e => setLocalidade(e.target.value)} autoCapitalize="words" />
              <input style={s.input} placeholder="Telefone / WhatsApp" type="tel" inputMode="numeric" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </>
          )}
          <input style={s.input} placeholder="seu@email.com *" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <input style={s.input} placeholder="Senha *" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          {error && <p style={s.error}>{error}</p>}
          {info  && <p style={s.infoMsg}>{info}</p>}
          <button onClick={handleSubmit} style={{ ...s.admBtn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </div>
        {mode === 'login' && <p style={s.hint}>Primeira vez? Clique em "Cadastrar" para criar sua conta.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App principal
// ---------------------------------------------------------------------------
function App() {
  const [user,          setUser]          = useState<UserRecord | null>(null);
  const [token,         setToken]         = useState<string | null>(null);
  const [checking,      setChecking]      = useState(true);
  const [screen,        setScreen]        = useState<Screen>('home');
  const [showPagamento, setShowPagamento] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setChecking(false); return; }
    getMe(saved)
      .then(u => { setUser(u); setToken(saved); setCurrentUser(u.email.split('@')[0]); })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (u: UserRecord, t: string) => {
    setUser(u); setToken(t);
    setCurrentUser(u.email.split('@')[0]);
    setScreen('home');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null); setToken(null);
    setScreen('home');
  };

  const handleNavigate = (target: Screen) => {
    const alunoOnly: Screen[] = ['camera', 'history', 'biomechanics', 'comparison', 'instagram', 'ranking'];
    if (user?.role === 'user' && alunoOnly.includes(target)) return;
    setScreen(target);
  };

  const handleFotoUpload = async (file: File) => {
    if (!token || !user) return;
    try {
      const url     = await uploadFotoCloudinary(file);
      const updated = await updateProfile(token, { foto_url: url });
      setUser(prev => prev ? { ...prev, foto_url: updated.foto_url } : prev);
    } catch (e) {
      console.error('[FotoUpload]', e);
    }
  };

  // Após pagamento aprovado, recarrega o usuário do backend
  const handlePagamentoSuccess = async () => {
    if (!token) return;
    setShowPagamento(false);
    try {
      const u = await getMe(token);
      setUser(u);
    } catch { /* silent */ }
  };

  if (checking) {
    return (
      <div style={{ background: '#0d0d1a', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.15)', borderTop: '4px solid #4fc3f7', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const username = user.nome || user.email.split('@')[0];
  const saveMode: SaveMode = 'local';

  return (
    <>
      {showPagamento && (
        <ModalPagamento
          user={user}
          onClose={() => setShowPagamento(false)}
          onSuccess={handlePagamentoSuccess}
        />
      )}

      {(() => {
        switch (screen) {
          case 'home':
            return <HomeScreen saveMode={saveMode} username={username} role={user.role} fotoUrl={user.foto_url} onLogout={handleLogout} onNavigate={handleNavigate} onFotoUpload={handleFotoUpload} onAssinar={() => setShowPagamento(true)} />;
          case 'camera':
            return <CameraScreen saveMode={saveMode} username={username} onGoHistory={() => setScreen('history')} onLogout={() => setScreen('home')} />;
          case 'history':
            return <HistoryScreen saveMode={saveMode} onBack={() => setScreen('home')} />;
          case 'biomechanics':
            return <BiomechanicsScreen onBack={() => setScreen('home')} />;
          case 'comparison':
            return <ComparisonScreen onBack={() => setScreen('home')} />;
          case 'instagram':
            return <InstagramScreen onBack={() => setScreen('home')} />;
          case 'mural':
            return <MuralScreen onBack={() => setScreen('home')} emailUsuario={user.email} userId={user.id} />;
          case 'agenda':
            return <AgendaScreen onBack={() => setScreen('home')} emailUsuario={user.email} role={user.role} username={username} />;
          case 'ranking':
            return <RankingScreen onBack={() => setScreen('home')} userId={user.id} role={user.role} username={username} fotoUrl={user.foto_url} />;
          default:
            return <HomeScreen saveMode={saveMode} username={username} role={user.role} fotoUrl={user.foto_url} onLogout={handleLogout} onNavigate={handleNavigate} onFotoUpload={handleFotoUpload} onAssinar={() => setShowPagamento(true)} />;
        }
      })()}
    </>
  );
}

export default function Root() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Estilos Login
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  page: { position: 'relative', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  bgImage: { position: 'fixed', inset: 0, backgroundImage: 'url(/carlao-atual.jpg)', backgroundPosition: 'center top', backgroundSize: window.innerWidth >= 768 && navigator.maxTouchPoints === 0 ? 'auto 100%' : 'cover', backgroundRepeat: 'no-repeat', backgroundColor: '#0d0d1a' },
  bgOverlay: { position: 'fixed', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0.82) 74%, rgba(0,0,0,0.92) 100%)' },
  bgSides: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 0% 65%, rgba(0,0,0,0.3) 0%, transparent 50%), radial-gradient(ellipse at 100% 65%, rgba(0,0,0,0.3) 0%, transparent 50%)' },
  instaCorner: { position: 'fixed', top: 16, right: 16, zIndex: 50, width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #405de6 0%, #833ab4 30%, #c13584 55%, #e1306c 75%, #fd1d1d 88%, #f56040 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(193,53,132,0.5)', textDecoration: 'none' },
  card: { position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '0 24px 48px', maxWidth: 360, width: '100%' },
  title: { color: '#fff', fontSize: 28, fontWeight: 800, margin: 0, textAlign: 'center', lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,0.9)' },
  sub: { color: '#cce0ff', fontSize: 14, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  modeToggle: { display: 'flex', width: '100%', background: 'rgba(0,0,20,0.5)', borderRadius: 14, padding: 4, gap: 4, backdropFilter: 'blur(6px)' },
  modeBtn: { flex: 1, padding: '12px 0', borderRadius: 11, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  modeBtnActive: { background: '#2e7d32', color: '#fff' },
  googleWrap: { width: '100%', display: 'flex', justifyContent: 'center' },
  divider: { width: '100%', display: 'flex', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' },
  dividerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 },
  admForm: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', padding: '14px 16px', borderRadius: 12, background: 'rgba(0,0,20,0.65)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 15, boxSizing: 'border-box', backdropFilter: 'blur(6px)' },
  admBtn: { width: '100%', padding: '16px 20px', borderRadius: 14, background: '#2e7d32', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' },
  error:   { color: '#ff6666', fontSize: 13, margin: 0, textAlign: 'center' },
  infoMsg: { color: '#44ff88', fontSize: 13, margin: 0, textAlign: 'center' },
  hint: { color: 'rgba(160,200,255,0.65)', fontSize: 11, textAlign: 'center', lineHeight: 1.6, marginTop: 4 },
};

// ---------------------------------------------------------------------------
// Estilos Modal Pagamento
// ---------------------------------------------------------------------------
const mp: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' },
  sheet: { background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px 24px 0 0', padding: '32px 24px 48px', maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' },
  closeBtn: { alignSelf: 'flex-end', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: 0, marginBottom: -8 },
  icon:  { fontSize: 48, lineHeight: 1 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' },
  sub:   { margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 },
  erro:  { color: '#ff6b6b', fontSize: 13, margin: 0, textAlign: 'center' },
  hint:  { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.5 },
  btnGroup: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  btnPix: { width: '100%', padding: '16px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #1a6b3c, #25a55a)', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' },
  btnCartao: { width: '100%', padding: '16px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #0d47a1, #1976d2)', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' },
  btnCopiar: { width: '100%', padding: '14px', borderRadius: 14, background: 'rgba(0,229,255,0.1)', border: '1.5px solid #00e5ff', color: '#00e5ff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnVoltar: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
};
