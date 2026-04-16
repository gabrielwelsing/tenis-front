// =============================================================================
// APP — Login ADM (teste local) ou Google (Drive)
// =============================================================================

import React, { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { setAccessToken } from '@services/driveService';
import CameraScreen  from '@screens/CameraScreen';
import HistoryScreen from '@screens/HistoryScreen';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export type SaveMode = 'drive' | 'local';
type Screen = 'camera' | 'history';

// ---------------------------------------------------------------------------
// Tela de Login
// ---------------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (mode: SaveMode) => void }) {
  const [showAdm, setShowAdm] = useState(false);
  const [user,    setUser]    = useState('');
  const [pass,    setPass]    = useState('');
  const [error,   setError]   = useState('');

  // Login Google — usa implicit flow para obter access_token real (necessário para Drive API)
  const loginGoogle = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: (res) => {
      setAccessToken(res.access_token);
      onLogin('drive');
    },
    onError: () => setError('Falha no login Google.'),
  });

  const handleAdmLogin = () => {
    if (user === 'adm' && pass === '123') {
      onLogin('local');
    } else {
      setError('Usuário ou senha incorretos.');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <img src="/carlao.png" alt="Carlão Tênis" style={s.avatar} />
        <h1 style={s.title}>Tenis Coach Cam</h1>
        <p style={s.sub}>Escolha como entrar</p>

        {/* Login Google → salva no Drive */}
        <button onClick={() => loginGoogle()} style={s.googleBtn}>
          <span>🔵</span> Entrar com Google
          <span style={s.badge}>salva no Drive</span>
        </button>

        {/* Divisor */}
        <div style={s.divider}><span>ou</span></div>

        {/* Login ADM → salva localmente */}
        {!showAdm ? (
          <button onClick={() => setShowAdm(true)} style={s.admToggle}>
            Entrar como ADM (teste local)
          </button>
        ) : (
          <div style={s.admForm}>
            <p style={s.admTitle}>Login de teste</p>
            <input
              style={s.input}
              placeholder="Usuário"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoCapitalize="none"
            />
            <input
              style={s.input}
              placeholder="Senha"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            {error && <p style={s.error}>{error}</p>}
            <button onClick={handleAdmLogin} style={s.admBtn}>
              Entrar
              <span style={s.badge}>salva no celular</span>
            </button>
          </div>
        )}

        <p style={s.hint}>
          No modo ADM os arquivos são baixados direto no celular,{'\n'}
          organizados como lance1, lance2...
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
  const [screen,   setScreen]   = useState<Screen>('camera');

  if (!saveMode) {
    return <LoginScreen onLogin={setSaveMode} />;
  }

  return screen === 'camera'
    ? <CameraScreen saveMode={saveMode} onGoHistory={() => setScreen('history')} />
    : <HistoryScreen saveMode={saveMode} onBack={() => setScreen('camera')} />;
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
  page:  { minHeight: '100dvh', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 40px 40px', maxWidth: 360, width: '100%' },
  avatar: { width: 180, height: 'auto', borderRadius: 16, marginBottom: 4 },
  title:  { color: '#fff', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'center' },
  sub:    { color: '#888', fontSize: 14, margin: 0 },

  googleBtn: {
    width: '100%', padding: '14px 20px', borderRadius: 12,
    background: '#1a73e8', border: 'none', color: '#fff',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },

  divider: {
    width: '100%', textAlign: 'center', color: '#444',
    fontSize: 13, borderTop: '1px solid #222', paddingTop: 16,
  },

  admToggle: {
    background: 'none', border: '1px solid #444',
    color: '#aaa', padding: '12px 20px', borderRadius: 12,
    fontSize: 14, cursor: 'pointer', width: '100%',
  },

  admForm: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  admTitle:{ color: '#ccc', fontSize: 13, textAlign: 'center', margin: 0 },

  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: '#1a1a2e', border: '1px solid #333',
    color: '#fff', fontSize: 15, boxSizing: 'border-box',
  },

  admBtn: {
    width: '100%', padding: '14px 20px', borderRadius: 12,
    background: '#2e7d32', border: 'none', color: '#fff',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },

  badge: {
    background: '#ffffff22', padding: '2px 8px',
    borderRadius: 20, fontSize: 10, letterSpacing: 0.5,
  },

  error: { color: '#ff6666', fontSize: 13, margin: 0, textAlign: 'center' },

  hint: {
    color: '#555', fontSize: 11, textAlign: 'center',
    lineHeight: 1.6, whiteSpace: 'pre-line', marginTop: 8,
  },
};
