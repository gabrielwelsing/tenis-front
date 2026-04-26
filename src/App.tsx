// =============================================================================
// APP — Autenticação via API (banco) + JWT no localStorage
// =============================================================================

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { login, register, getMe, type UserRecord } from '@services/apiService';
import { setCurrentUser } from '@services/localSaveService';
import CameraScreen       from '@screens/CameraScreen';
import HistoryScreen      from '@screens/HistoryScreen';
import BiomechanicsScreen from '@screens/BiomechanicsScreen';
import HomeScreen         from '@screens/HomeScreen';
import ComparisonScreen   from '@screens/ComparisonScreen';
import InstagramScreen    from '@screens/InstagramScreen';
import MuralScreen        from '@screens/MuralScreen';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const TOKEN_KEY = 'tenis_token';

export type SaveMode = 'drive' | 'local';
export type Screen   = 'camera' | 'history' | 'biomechanics' | 'home' | 'comparison' | 'instagram' | 'mural';
export type Role     = 'user' | 'aluno' | 'admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function InstaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="white" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
    </svg>
  );
}

function TennisIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke="#00e5ff" strokeWidth="2" fill="none"/>
      <path d="M6 14 Q20 20 34 14" stroke="#00e5ff" strokeWidth="2" fill="none"/>
      <path d="M6 26 Q20 20 34 26" stroke="#00e5ff" strokeWidth="2" fill="none"/>
    </svg>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: UserRecord, token: string) => void }) {
  const [mode,    setMode]    = useState<'login' | 'register'>('login');
  const [nome,    setNome]    = useState('');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');
  const [loading, setLoading] = useState(false);

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
        : await register(nome.trim(), rawEmail, pass);

      localStorage.setItem(TOKEN_KEY, res.token);
      if (mode === 'register') setInfo('Cadastro realizado! Bem-vindo(a).');
      setTimeout(() => onLogin(res.user, res.token), 300);
    } catch (e: any) {
      setError(e.message ?? 'Erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.bgGlow1} />
      <div style={s.bgGlow2} />

      <a href="https://www.instagram.com/jogartenisto/" target="_blank" rel="noopener noreferrer" style={s.instaCorner}>
        <InstaIcon />
      </a>

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <TennisIcon />
        </div>
        <h1 style={s.title}>Tenis Coach</h1>
        <p style={s.sub}>com Carlão</p>

        {/* Toggle */}
        <div style={s.modeToggle}>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{ ...s.modeBtn, ...(mode === 'login' ? s.modeBtnActive : {}) }}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            style={{ ...s.modeBtn, ...(mode === 'register' ? s.modeBtnActive : {}) }}
          >
            Cadastrar
          </button>
        </div>

        <div style={s.admForm}>
          {mode === 'register' && (
            <div style={s.inputWrap}>
              <span style={s.inputIcon}>👤</span>
              <input
                style={s.input}
                placeholder="Seu nome"
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                autoCapitalize="words"
              />
            </div>
          )}
          <div style={s.inputWrap}>
            <span style={s.inputIcon}>✉️</span>
            <input
              style={s.input}
              placeholder="seu@email.com"
              type="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div style={s.inputWrap}>
            <span style={s.inputIcon}>🔒</span>
            <input
              style={s.input}
              placeholder="Senha"
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {error && <p style={s.error}>{error}</p>}
          {info  && <p style={s.infoMsg}>{info}</p>}
          <button onClick={handleSubmit} style={{ ...s.admBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </div>

        {mode === 'login' && (
          <p style={s.hint}>Primeira vez? Clique em "Cadastrar" para criar sua conta.</p>
        )}
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
    setUser(u);
    setToken(t);
    setCurrentUser(u.email.split('@')[0]);
    setScreen('home');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setScreen('home');
  };

  const handleNavigate = (target: Screen) => {
    const adminOnly: Screen[] = ['camera', 'history', 'biomechanics', 'comparison'];
    if (user?.role === 'user' && adminOnly.includes(target)) return;
    setScreen(target);
  };

  if (checking) {
    return (
      <div style={{ background: '#0a0a0f', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(0,229,255,0.2)', borderTop: '3px solid #00e5ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const username = user.nome || user.email.split('@')[0];
  const saveMode: SaveMode = 'local';

  switch (screen) {
    case 'home':
      return <HomeScreen saveMode={saveMode} username={username} role={user.role} onLogout={handleLogout} onNavigate={handleNavigate} />;
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
    default:
      return <HomeScreen saveMode={saveMode} username={username} role={user.role} onLogout={handleLogout} onNavigate={handleNavigate} />;
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
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0a0f',
  },
  bgGlow1: {
    position: 'fixed', top: '-20%', left: '-10%',
    width: '60vw', height: '60vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgGlow2: {
    position: 'fixed', bottom: '-20%', right: '-10%',
    width: '50vw', height: '50vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,150,200,0.07) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  instaCorner: {
    position: 'fixed', top: 16, right: 16, zIndex: 50,
    width: 40, height: 40, borderRadius: 12,
    background: 'linear-gradient(135deg, #405de6, #833ab4, #c13584, #e1306c, #fd1d1d, #f56040)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(193,53,132,0.4)', textDecoration: 'none',
  },
  card: {
    position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 16, padding: '40px 28px 48px',
    maxWidth: 380, width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,229,255,0.15)',
    borderRadius: 28,
    backdropFilter: 'blur(20px)',
    boxShadow: '0 0 60px rgba(0,229,255,0.05), 0 20px 60px rgba(0,0,0,0.4)',
    margin: '0 16px',
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 20,
    background: 'rgba(0,229,255,0.08)',
    border: '1px solid rgba(0,229,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 30px rgba(0,229,255,0.15)',
  },
  title: {
    color: '#fff', fontSize: 26, fontWeight: 800, margin: 0,
    textAlign: 'center', letterSpacing: -0.5,
  },
  sub: {
    color: '#00e5ff', fontSize: 13, fontWeight: 600, margin: '-8px 0 0',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  modeToggle: {
    display: 'flex', width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 4, gap: 4,
  },
  modeBtn: {
    flex: 1, padding: '11px 0', borderRadius: 11, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.4)',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modeBtnActive: {
    background: 'linear-gradient(135deg, #0097a7, #00bcd4)',
    color: '#fff',
    boxShadow: '0 2px 12px rgba(0,188,212,0.4)',
  },
  admForm: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  inputWrap: {
    position: 'relative', display: 'flex', alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute', left: 14, fontSize: 15, pointerEvents: 'none',
  },
  input: {
    width: '100%', padding: '14px 16px 14px 42px', borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(0,229,255,0.15)',
    color: '#fff', fontSize: 15, boxSizing: 'border-box',
    outline: 'none',
  },
  admBtn: {
    width: '100%', padding: '16px 20px', borderRadius: 14,
    background: 'linear-gradient(135deg, #0097a7 0%, #00e5ff 100%)',
    border: 'none', color: '#000',
    fontSize: 15, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,229,255,0.35)',
    letterSpacing: 0.3, marginTop: 4,
  },
  error:   { color: '#ff6b6b', fontSize: 13, margin: 0, textAlign: 'center' },
  infoMsg: { color: '#00e5ff', fontSize: 13, margin: 0, textAlign: 'center' },
  hint: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center',
    lineHeight: 1.6, marginTop: 4,
  },
};
