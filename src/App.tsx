// =============================================================================
// APP — Roteamento simples + Login Google
// =============================================================================

import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { setAccessToken } from '@services/driveService';
import CameraScreen  from '@screens/CameraScreen';
import HistoryScreen from '@screens/HistoryScreen';

// Cole aqui o Web Client ID gerado no Google Cloud Console
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

type Screen = 'camera' | 'history';

function App() {
  const [authed,  setAuthed]  = useState(false);
  const [screen,  setScreen]  = useState<Screen>('camera');

  const handleLogin = (response: { access_token?: string; credential?: string }) => {
    // GoogleLogin retorna credential (ID token); usamos o access token via implicit flow
    // Para upload no Drive precisamos do access token — configure o OAuth para retornar via tokenResponse
    const token = response.access_token ?? response.credential ?? '';
    setAccessToken(token);
    setAuthed(true);
  };

  if (!authed) {
    return (
      <div style={loginStyles.page}>
        <div style={loginStyles.card}>
          <h1 style={loginStyles.title}>Tenis Coach Cam</h1>
          <p style={loginStyles.sub}>Entre com sua conta Google para sincronizar os lances com o Drive</p>
          <GoogleLogin
            onSuccess={(res) => handleLogin({ credential: res.credential })}
            onError={() => console.error('Login falhou')}
            useOneTap
            theme="filled_black"
            shape="pill"
            text="signin_with"
          />
        </div>
      </div>
    );
  }

  return screen === 'camera'
    ? <CameraScreen  onGoHistory={() => setScreen('history')} />
    : <HistoryScreen onBack={() => setScreen('camera')} />;
}

export default function Root() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

const loginStyles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 40, maxWidth: 360, textAlign: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: '#888', fontSize: 14, lineHeight: 1.6, margin: 0 },
};
