// =============================================================================
// APP — Login por e-mail (validação regex, sem banco de dados)
// =============================================================================

import React, { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { admLogout, setCurrentUser } from '@services/localSaveService';
import CameraScreen       from '@screens/CameraScreen';
import HistoryScreen      from '@screens/HistoryScreen';
import BiomechanicsScreen from '@screens/BiomechanicsScreen';
import HomeScreen         from '@screens/HomeScreen';
import ComparisonScreen   from '@screens/ComparisonScreen';
import InstagramScreen    from '@screens/InstagramScreen';
import MuralScreen        from '@screens/MuralScreen';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export type SaveMode = 'drive' | 'local';
export type Screen = 'camera' | 'history' | 'biomechanics' | 'home' | 'comparison' | 'instagram' | 'mural';

// Regex padrão para validação de e-mail (RFC 5322 simplificado)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------------------
// Ícone Instagram (SVG inline)
// ---------------------------------------------------------------------------
function InstaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="white" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tela de Login
// ---------------------------------------------------------------------------
function LoginScreen({
  onLogin,
}: {
  onLogin: (mode: SaveMode, username?: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    if (!email.trim()) { setError('Digite seu e-mail para continuar.'); return; }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('E-mail inválido. Ex: nome@email.com');
      return;
    }
    // Qualquer e-mail válido libera o acesso (MVP — sem banco de dados de usuários)
    // TODO: substituir por autenticação real (JWT/OAuth) quando necessário
    const username = email.trim().split('@')[0].toLowerCase();
    setCurrentUser(username);
    onLogin('local', username);
  };

  return (
    <div style={s.page}>
      <div style={s.bgImage} />
      <div style={s.bgOverlay} />
      <div style={s.bgSides} />

      {/* Instagram — canto superior direito */}
      <a
        href="https://www.instagram.com/jogartenisto/"
        target="_blank"
        rel="noopener noreferrer"
        style={s.instaCorner}
        title="@jogartenisto"
      >
        <InstaIcon />
      </a>

      <div style={s.card}>
        <h1 style={s.title}>Tenis Coach com Carlos</h1>
        <p style={s.sub}>Entre com seu e-mail para continuar</p>

        <div style={s.admForm}>
          <input
            style={s.input}
            placeholder="seu@email.com"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {error && <p style={s.error}>{error}</p>}
          <button onClick={handleLogin} style={s.admBtn}>
            Entrar
          </button>
        </div>

        <p style={s.hint}>
          Nenhuma senha necessária — apenas um e-mail válido.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App principal
// ---------------------------------------------------------------------------
function App() {
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [username, setUsername] = useState<string>('');
  const [screen,   setScreen]   = useState<Screen>('home');

  const handleLogin = (mode: SaveMode, user?: string) => {
    if (user) { setCurrentUser(user); setUsername(user); }
    setSaveMode(mode);
    setScreen('home');
  };

  const handleLogout = () => {
    admLogout();
    setSaveMode(null);
    setUsername('');
    setScreen('home');
  };

  if (!saveMode) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  switch (screen) {
    case 'home':
      return (
        <HomeScreen
          saveMode={saveMode}
          username={username}
          onLogout={handleLogout}
          onNavigate={setScreen}
        />
      );
    case 'camera':
      return (
        <CameraScreen
          saveMode={saveMode}
          username={username}
          onGoHistory={() => setScreen('history')}
          onLogout={() => setScreen('home')}
        />
      );
    case 'history':
      return (
        <HistoryScreen
          saveMode={saveMode}
          onBack={() => setScreen('home')}
        />
      );
    case 'biomechanics':
      return <BiomechanicsScreen onBack={() => setScreen('home')} />;
    case 'comparison':
      return <ComparisonScreen onBack={() => setScreen('home')} />;
    case 'instagram':
      return <InstagramScreen onBack={() => setScreen('home')} />;
    case 'mural':
      return <MuralScreen onBack={() => setScreen('home')} emailUsuario={username} />;
    default:
      return (
        <HomeScreen
          saveMode={saveMode}
          username={username}
          onLogout={handleLogout}
          onNavigate={setScreen}
        />
      );
  }
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
    backgroundImage: 'url(/carlao-atual.jpg)',
    backgroundPosition: 'center center',
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
  // Instagram — ícone pequeno fixo no canto superior direito
  instaCorner: {
    position: 'fixed', top: 16, right: 16, zIndex: 50,
    width: 44, height: 44, borderRadius: 14,
    background: 'linear-gradient(135deg, #405de6 0%, #833ab4 30%, #c13584 55%, #e1306c 75%, #fd1d1d 88%, #f56040 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(193,53,132,0.5)',
    textDecoration: 'none',
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
  sub: { color: '#cce0ff', fontSize: 14, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  admForm: { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    background: 'rgba(0,0,20,0.65)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', fontSize: 15, boxSizing: 'border-box',
    backdropFilter: 'blur(6px)',
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
    lineHeight: 1.6, whiteSpace: 'pre-line', marginTop: 4,
  },
};
