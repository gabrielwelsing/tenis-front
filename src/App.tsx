// =============================================================================
// APP — Login Google (Drive) ou Perfil local (ADM)
// =============================================================================

import React, { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { setAccessToken } from '@services/driveService';
import { admLogin, admLogout, setCurrentUser } from '@services/localSaveService';
import CameraScreen  from '@screens/CameraScreen';
import HistoryScreen from '@screens/HistoryScreen';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export type SaveMode = 'drive' | 'local';
type Screen = 'camera' | 'history';

// ---------------------------------------------------------------------------
// Tela de Login
// ---------------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (mode: SaveMode, username?: string) => void }) {
  const [showAdm, setShowAdm] = useState(false);
  const [user,    setUser]    = useState('');
  const [pass,    setPass]    = useState('');
  const [info,    setInfo]    = useState('');
  const [error,   setError]   = useState('');

  const loginGoogle = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: (res) => { setAccessToken(res.access_token); onLogin('drive'); },
    onError:   () => setError('Falha no login Google.'),
  });

  const handleAdmLogin = () => {
    setError(''); setInfo('');
    if (!user.trim() || !pass) { setError('Preencha usuário e senha.'); return; }

    const result = admLogin(user.trim(), pass);

    if (result === 'created') {
      setInfo(`Perfil "${user.trim()}" criado!`);
      setTimeout(() => onLogin('local', user.trim().toLowerCase()), 800);
    } else if (result === 'ok') {
      onLogin('local', user.trim().toLowerCase());
    } else {
      setError('Senha incorreta.');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.bgImage} />
      <div style={s.bgOverlay} />
      <div style={s.bgSides} />

      <div style={s.card}>
        <h1 style={s.title}>Tenis Coach com Carlos</h1>
        <p style={s.sub}>Escolha como entrar</p>

        <button onClick={() => loginGoogle()} style={s.googleBtn}>
          <span>🔵</span> Entrar com Google
          <span style={s.badge}>salva no Drive</span>
        </button>

        <div style={s.divider}><span>ou</span></div>

        {!showAdm ? (
          <button onClick={() => setShowAdm(true)} style={s.admToggle}>
            Entrar com perfil local
          </button>
        ) : (
          <div style={s.admForm}>
            <p style={s.admTitle}>Perfil local — salva no celular</p>
            <input
              style={s.input}
              placeholder="Nome (ex: Carlos)"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <input
              style={s.input}
              placeholder="Senha"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            {error && <p style={s.error}>{error}</p>}
            {info  && <p style={s.infoMsg}>{info}</p>}
            <button onClick={handleAdmLogin} style={s.admBtn}>
              Entrar / Criar perfil
              <span style={s.badge}>salva no celular</span>
            </button>
          </div>
        )}

        <p style={s.hint}>
          Primeira vez? Digite seu nome e crie uma senha.{'\n'}
          Próximas vezes, use o mesmo nome e senha.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App principal
// ---------------------------------------------------------------------------
function App() {
  const [saveMode,  setSaveMode]  = useState<SaveMode | null>(null);
  const [username,  setUsername]  = useState<string>('');
  const [screen,    setScreen]    = useState<Screen>('camera');

  const handleLogin = (mode: SaveMode, user?: string) => {
    if (user) { setCurrentUser(user); setUsername(user); }
    setSaveMode(mode);
  };

  const handleLogout = () => {
    admLogout();
    setSaveMode(null);
    setUsername('');
    setScreen('camera');
  };

  if (!saveMode) return <LoginScreen onLogin={handleLogin} />;

  return screen === 'camera'
    ? <CameraScreen
        saveMode={saveMode}
        username={username}
        onGoHistory={() => setScreen('history')}
        onLogout={handleLogout}
      />
    : <HistoryScreen
        saveMode={saveMode}
        onBack={() => setScreen('camera')}
      />;
}

export default function Root() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative', minHeight: '100dvh', overflow: 'hidden',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  bgImage: {
    position: 'fixed', inset: 0,
    backgroundImage: 'url(/court-bg.png)',
    backgroundPosition: 'top center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  },
  bgOverlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0.82) 74%, rgba(0,0,0,0.92) 100%)',
  },
  bgSides: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse at 0% 65%, rgba(0,0,0,0.3) 0%, transparent 50%), radial-gradient(ellipse at 100% 65%, rgba(0,0,0,0.3) 0%, transparent 50%)',
  },
  card: {
    position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 14, padding: '0 24px 48px', maxWidth: 360, width: '100%',
  },
  title: {
    color: '#fff', fontSize: 28, fontWeight: 800, margin: 0,
    textAlign: 'center', lineHeight: 1.2,
    textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  },
  sub:      { color: '#cce0ff', fontSize: 14, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  googleBtn: {
    width: '100%', padding: '15px 20px', borderRadius: 14,
    background: '#1a73e8', border: 'none', color: '#fff',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  divider: {
    width: '100%', textAlign: 'center', color: 'rgba(180,210,255,0.5)',
    fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14,
  },
  admToggle: {
    width: '100%', padding: '15px 20px', borderRadius: 14,
    border: '1.5px solid rgba(255,255,255,0.25)', color: '#cce0ff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
  },
  admForm:  { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  admTitle: { color: '#cce0ff', fontSize: 13, textAlign: 'center', margin: 0 },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: 'rgba(0,0,20,0.6)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', fontSize: 15, boxSizing: 'border-box',
    backdropFilter: 'blur(4px)',
  },
  admBtn: {
    width: '100%', padding: '15px 20px', borderRadius: 14,
    background: '#2e7d32', border: 'none', color: '#fff',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  badge:   { background: 'rgba(255,255,255,0.2)', padding: '3px 9px', borderRadius: 20, fontSize: 10, letterSpacing: 0.5 },
  error:   { color: '#ff6666', fontSize: 13, margin: 0, textAlign: 'center' },
  infoMsg: { color: '#44ff88', fontSize: 13, margin: 0, textAlign: 'center' },
  hint: {
    color: 'rgba(160,200,255,0.65)', fontSize: 11, textAlign: 'center',
    lineHeight: 1.6, whiteSpace: 'pre-line', marginTop: 4,
  },
};
