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

const GOOGLE_CLIENT_ID  = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const CLOUDINARY_CLOUD  = 'dgier8xfp';
const CLOUDINARY_PRESET = 'tenis-to';
const TOKEN_KEY = 'tenis_token';

export type SaveMode = 'drive' | 'local';
export type Screen   = 'camera' | 'history' | 'biomechanics' | 'home' | 'comparison' | 'instagram' | 'mural' | 'agenda';
export type Role     = 'user' | 'aluno' | 'admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function uploadFotoCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Erro ao fazer upload da foto.');
  const data = await res.json();
  return data.secure_url as string;
}

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
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Falha ao entrar com Google.')}
            text={mode === 'login' ? 'signin_with' : 'signup_with'}
            shape="rectangular"
            theme="filled_black"
            width="312"
          />
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

function App() {
  const [user,     setUser]     = useState<UserRecord | null>(null);
  const [token,    setToken]    = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [screen,   setScreen]   = useState<Screen>('home');

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
    const adminOnly: Screen[] = ['camera', 'history', 'biomechanics', 'comparison'];
    if (user?.role === 'user' && adminOnly.includes(target)) return;
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

  switch (screen) {
    case 'home':
      return <HomeScreen saveMode={saveMode} username={username} role={user.role} fotoUrl={user.foto_url} onLogout={handleLogout} onNavigate={handleNavigate} onFotoUpload={handleFotoUpload} />;
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
      return <MuralScreen onBack={() => setScreen('home')} emailUsuario={user.email} />;
    case 'agenda':
      return <AgendaScreen onBack={() => setScreen('home')} emailUsuario={user.email} role={user.role} username={username} />;
    default:
      return <HomeScreen saveMode={saveMode} username={username} role={user.role} fotoUrl={user.foto_url} onLogout={handleLogout} onNavigate={handleNavigate} onFotoUpload={handleFotoUpload} />;
  }
}

export default function Root() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative', minHeight: '100dvh', overflow: 'hidden',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  bgImage: {
    position: 'fixed', inset: 0,
    backgroundImage: 'url(/carlao-atual.jpg)',
    backgroundPosition: 'center top',
    backgroundSize: window.innerWidth >= 768 && navigator.maxTouchPoints === 0 ? 'auto 100%' : 'cover',
    backgroundRepeat: 'no-repeat', backgroundColor: '#0d0d1a',
  },
  bgOverlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0.82) 74%, rgba(0,0,0,0.92) 100%)',
  },
  bgSides: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse at 0% 65%, rgba(0,0,0,0.3) 0%, transparent 50%), radial-gradient(ellipse at 100% 65%, rgba(0,0,0,0.3) 0%, transparent 50%)',
  },
  instaCorner: {
    position: 'fixed', top: 16, right: 16, zIndex: 50,
    width: 44, height: 44, borderRadius: 14,
    background: 'linear-gradient(135deg, #405de6 0%, #833ab4 30%, #c13584 55%, #e1306c 75%, #fd1d1d 88%, #f56040 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(193,53,132,0.5)', textDecoration: 'none',
  },
  card: {
    position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 14, padding: '0 24px 48px', maxWidth: 360, width: '100%',
  },
  title: {
    color: '#fff', fontSize: 28, fontWeight: 800, margin: 0,
    textAlign: 'center', lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  },
  sub: { color: '#cce0ff', fontSize: 14, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  modeToggle: {
    display: 'flex', width: '100%',
    background: 'rgba(0,0,20,0.5)', borderRadius: 14, padding: 4, gap: 4,
    backdropFilter: 'blur(6px)',
  },
  modeBtn: {
    flex: 1, padding: '12px 0', borderRadius: 11, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.5)',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  modeBtnActive: { background: '#2e7d32', color: '#fff' },
  googleWrap: { width: '100%', display: 'flex', justifyContent: 'center' },
  divider: { width: '100%', display: 'flex', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' },
  dividerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 },
  admForm: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    background: 'rgba(0,0,20,0.65)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', fontSize: 15, boxSizing: 'border-box', backdropFilter: 'blur(6px)',
  },
  admBtn: {
    width: '100%', padding: '16px 20px', borderRadius: 14,
    background: '#2e7d32', border: 'none', color: '#fff',
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  error:   { color: '#ff6666', fontSize: 13, margin: 0, textAlign: 'center' },
  infoMsg: { color: '#44ff88', fontSize: 13, margin: 0, textAlign: 'center' },
  hint: {
    color: 'rgba(160,200,255,0.65)', fontSize: 11, textAlign: 'center',
    lineHeight: 1.6, marginTop: 4,
  },
};
