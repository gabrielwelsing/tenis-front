// =============================================================================
// APP — Autenticação via API (banco) + JWT no localStorage
// =============================================================================

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { login, register, loginGoogle, getMe, updateProfile, buscarCidadesIBGE, padronizarCidadeIBGE, type CidadeIBGE, type UserRecord } from '@services/apiService';
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
  const [step, setStep] = useState<'escolha' | 'loading'>('escolha');
  const [erro, setErro] = useState('');

  const criarPix = async () => {
    setErro('');
    setStep('loading');

    try {
      const res = await fetch(`${API_URL}/payment/criar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: user.id, email: user.email, tipo: 'pix' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? 'Erro ao criar pagamento.');
        setStep('escolha');
        return;
      }

      const checkoutUrl = data.checkout_url ?? data.init_point;

      if (!checkoutUrl) {
        setErro('Pagamento criado, mas a URL da Stripe não foi retornada.');
        setStep('escolha');
        return;
      }

      window.location.href = checkoutUrl;
    } catch {
      setErro('Erro de conexão. Tente novamente.');
      setStep('escolha');
    }
  };

  return (
    <div style={mp.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={mp.sheet}>
        <button onClick={onClose} style={mp.closeBtn}>×</button>

        {step === 'escolha' && (
          <>
            <div style={mp.heroCard}>
              <div style={mp.heroOverlay} />
              <div style={mp.heroContent}>
                <span style={mp.kicker}>PLANO MENSAL</span>
                <h2 style={mp.title}>Desbloqueie seu treino completo</h2>
                <p style={mp.sub}>Acesso total às ferramentas avançadas por R$ 14,90/mês.</p>
              </div>
            </div>

            <div style={mp.priceCard}>
              <span style={mp.priceLabel}>Plano Pro</span>
              <div style={mp.priceLine}>
                <strong style={mp.price}>R$ 14,90</strong>
                <span style={mp.pricePeriod}>/mês</span>
              </div>
              <p style={mp.priceHint}>Biomecânica, câmera, histórico, ranking e comparativos liberados.</p>
            </div>

            {erro && <p style={mp.erro}>{erro}</p>}

            <div style={mp.btnGroup}>
              <button style={mp.payBtnPrimary} onClick={criarPix}>
                <span style={mp.payIcon}>◆</span>
                <div style={mp.payText}>
                  <strong>Pagar com PIX</strong>
                  <span>Pagamento seguro via Stripe</span>
                </div>
                <span style={mp.payArrow}>›</span>
              </button>
            </div>

            <p style={mp.hint}>Você será redirecionado para concluir o pagamento com PIX.</p>
          </>
        )}

        {step === 'loading' && (
          <div style={mp.stateBox}>
            <div style={mp.loadingIcon}>⏳</div>
            <h2 style={mp.stateTitle}>Gerando pagamento...</h2>
            <p style={mp.stateSub}>Aguarde alguns segundos.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginScreen
// ---------------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (user: UserRecord, token: string) => void }) {
  const [mode,       setMode]       = useState<'login' | 'register'>('login');
  const [authOpen,   setAuthOpen]   = useState(false);
  const [nome,       setNome]       = useState('');
  const [email,      setEmail]      = useState('');
  const [pass,       setPass]       = useState('');
  const [localidade, setLocalidade] = useState('');
  const [cidadeSugestoes, setCidadeSugestoes] = useState<CidadeIBGE[]>([]);
  const [cidadeLoading, setCidadeLoading] = useState(false);
  const [telefone,   setTelefone]   = useState('');
  const [error,      setError]      = useState('');
  const [info,       setInfo]       = useState('');
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('tenis-roboto-font')) return;

    const link = document.createElement('link');
    link.id = 'tenis-roboto-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800;900&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    let ativo = true;
    const termo = localidade.trim();

    if (mode !== 'register' || termo.length < 2 || /^[A-Za-zÀ-ÿ0-9 .'-]+ - [A-Z]{2}$/.test(termo)) {
      setCidadeSugestoes([]);
      setCidadeLoading(false);
      return;
    }

    setCidadeLoading(true);

    buscarCidadesIBGE(termo)
      .then(opcoes => {
        if (ativo) setCidadeSugestoes(opcoes);
      })
      .catch(() => {
        if (ativo) setCidadeSugestoes([]);
      })
      .finally(() => {
        if (ativo) setCidadeLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [localidade, mode]);

  const openAuth = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setInfo('');
    setAuthOpen(true);
  };

  const closeAuth = () => {
    if (loading) return;
    setAuthOpen(false);
    setError('');
    setInfo('');
  };

  const handleSubmit = async () => {
    setError(''); setInfo('');
    const rawEmail = email.trim().toLowerCase();
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) { setError('E-mail inválido.'); return; }
    if (!pass)                                     { setError('Preencha a senha.'); return; }
    if (mode === 'register' && !nome.trim())       { setError('Preencha seu nome.'); return; }
    setLoading(true);
    try {
      const localidadeFinal = mode === 'register' && localidade.trim()
        ? await padronizarCidadeIBGE(localidade)
        : undefined;

      const res = mode === 'login'
        ? await login(rawEmail, pass)
        : await register(nome.trim(), rawEmail, pass, localidadeFinal || undefined, telefone || undefined);
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

      <main style={s.welcomeLayer}>
        <div style={s.brandBlock}>
          <h1 style={s.title}>
            <span style={s.titleMain}>Tênis Coach</span>
            <span style={s.titleSub}>com Carlão</span>
          </h1>
        </div>

        <div style={s.landingActions}>
          <button
            type="button"
            onClick={() => openAuth('login')}
            style={{ ...s.landingBtn, ...s.landingBtnPrimary }}
          >
            <span style={s.landingBtnTextPrimary}>Entrar</span>
            <span style={s.landingIconPrimary}>↪</span>
          </button>

          <button
            type="button"
            onClick={() => openAuth('register')}
            style={{ ...s.landingBtn, ...s.landingBtnSecondary }}
          >
            <span style={s.landingBtnTextSecondary}>Cadastrar</span>
            <span style={s.landingIconSecondary}>♙</span>
          </button>
        </div>
      </main>

      {authOpen && (
        <div style={s.authOverlay} onClick={e => e.target === e.currentTarget && closeAuth()}>
          <section style={s.authSheet}>
            <button type="button" onClick={closeAuth} style={s.closeBtn}>×</button>

            <div style={s.sheetHandle} />

            <div style={s.sheetHeader}>
              <h2 style={s.sheetTitle}>{mode === 'login' ? 'Entrar' : 'Cadastrar'}</h2>
              <p style={s.sheetSub}>
                {mode === 'login'
                  ? 'Acesse sua conta para continuar.'
                  : 'Crie sua conta para começar.'}
              </p>
            </div>

            <div style={s.modeToggle}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                style={{ ...s.modeBtn, ...(mode === 'login' ? s.modeBtnActive : {}) }}
              >
                Entrar
              </button>

              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setInfo(''); }}
                style={{ ...s.modeBtn, ...(mode === 'register' ? s.modeBtnActive : {}) }}
              >
                Cadastrar
              </button>
            </div>

            <div style={s.googleWrap}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Falha ao entrar com Google.')}
                text={mode === 'login' ? 'signin_with' : 'signup_with'}
                shape="rectangular"
                theme="outline"
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
                  <input
                    style={s.input}
                    placeholder="Seu nome *"
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    autoCapitalize="words"
                  />

                  <div style={s.cityFieldWrap}>
                    <input
                      style={s.input}
                      placeholder="Cidade - UF"
                      type="text"
                      value={localidade}
                      onChange={e => setLocalidade(e.target.value)}
                      autoCapitalize="words"
                      autoComplete="off"
                    />

                    {(cidadeLoading || cidadeSugestoes.length > 0) && (
                      <div style={s.citySuggestList}>
                        {cidadeLoading ? (
                          <div style={s.citySuggestLoading}>Buscando cidades...</div>
                        ) : cidadeSugestoes.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            style={s.citySuggestItem}
                            onClick={() => {
                              setLocalidade(c.label);
                              setCidadeSugestoes([]);
                            }}
                          >
                            <span style={s.citySuggestName}>{c.nome}</span>
                            <span style={s.citySuggestUf}>{c.uf}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    style={s.input}
                    placeholder="Telefone / WhatsApp"
                    type="tel"
                    inputMode="numeric"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                  />
                </>
              )}

              <input
                style={s.input}
                placeholder="seu@email.com *"
                type="email"
                inputMode="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />

              <input
                style={s.input}
                placeholder="Senha *"
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />

              {error && <p style={s.error}>{error}</p>}
              {info  && <p style={s.infoMsg}>{info}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                style={{ ...s.admBtn, opacity: loading ? 0.6 : 1 }}
                disabled={loading}
              >
                {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </div>

            {mode === 'login' && (
              <p style={s.hint}>
                Primeira vez? Clique em <button type="button" onClick={() => setMode('register')} style={s.inlineLink}>Cadastrar</button> para criar sua conta.
              </p>
            )}
          </section>
        </div>
      )}
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

  const handleSalvarPerfil = async (dados: { nome: string; localidade: string; telefone: string }) => {
    if (!token) return;

    const localidadeFinal = dados.localidade?.trim()
      ? await padronizarCidadeIBGE(dados.localidade)
      : dados.localidade;

    const updated = await updateProfile(token, {
      ...dados,
      localidade: localidadeFinal,
    });
    setUser(prev => prev ? { ...prev, ...updated } : prev);
  };

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
        <ModalPagamento user={user} onClose={() => setShowPagamento(false)} onSuccess={handlePagamentoSuccess} />
      )}

      {(() => {
        switch (screen) {
          case 'home':
            return (
              <HomeScreen
                saveMode={saveMode}
                username={username}
                emailUsuario={user.email}
                token={token ?? ''}
                role={user.role}
                fotoUrl={user.foto_url}
                telefone={user.telefone}
                localidade={user.localidade}
                planoExpiraEm={user.plano_expira_em ?? null}
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onFotoUpload={handleFotoUpload}
                onAssinar={() => setShowPagamento(true)}
                onSalvarPerfil={handleSalvarPerfil}
              />
            );

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
            return <MuralScreen onBack={() => setScreen('home')} emailUsuario={user.email} userId={user.id} username={username} telefone={user.telefone} localidade={user.localidade} />;

          case 'agenda':
            return <AgendaScreen onBack={() => setScreen('home')} emailUsuario={user.email} role={user.role} username={username} telefone={user.telefone} />;

          case 'ranking':
            return <RankingScreen onBack={() => setScreen('home')} userId={user.id} role={user.role} username={username} fotoUrl={user.foto_url} />;

          default:
            return (
              <HomeScreen
                saveMode={saveMode}
                username={username}
                emailUsuario={user.email}
                token={token ?? ''}
                role={user.role}
                fotoUrl={user.foto_url}
                telefone={user.telefone}
                localidade={user.localidade}
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onFotoUpload={handleFotoUpload}
                onAssinar={() => setShowPagamento(true)}
                onSalvarPerfil={handleSalvarPerfil}
              />
            );
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
  page: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(100vw, 430px)',
    height: '100dvh',
    minHeight: '100dvh',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    background: '#140b06',
    fontFamily: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: '0 0 0 9999px #0d0907, 0 0 34px rgba(0,0,0,0.35)',
  },

  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url(/tela_login_carlao.png)',
    backgroundPosition: 'center center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#140b06',
    zIndex: 0,
  },

  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: [
      'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 28%, rgba(0,0,0,0.18) 52%, rgba(0,0,0,0.42) 78%, rgba(0,0,0,0.62) 100%)',
      'radial-gradient(ellipse at 50% 54%, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.48) 100%)',
    ].join(', '),
    zIndex: 1,
    pointerEvents: 'none',
  },

  welcomeLayer: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: 460,
    minHeight: '100dvh',
    padding: 'max(28px, env(safe-area-inset-top, 28px)) 28px max(34px, env(safe-area-inset-bottom, 34px))',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  brandBlock: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: '50%',
    transform: 'translateY(-18%)',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },

  title: {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    color: '#fff',
    textShadow: '0 3px 18px rgba(0,0,0,0.68)',
    lineHeight: 1.03,
    letterSpacing: -0.6,
  },

  titleMain: {
    display: 'block',
    fontSize: 'clamp(28px, 8.5vw, 39px)',
    fontWeight: 900,
    color: '#fff',
  },

  titleSub: {
    display: 'block',
    alignSelf: 'flex-end',
    marginTop: 5,
    fontSize: 'clamp(17px, 4.8vw, 23px)',
    fontWeight: 400,
    color: '#fff',
    letterSpacing: -0.25,
  },

  landingActions: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginBottom: 6,
  },

  landingBtn: {
    width: '100%',
    minHeight: 70,
    borderRadius: 26,
    border: '1px solid rgba(255,255,255,0.22)',
    display: 'grid',
    gridTemplateColumns: '46px 1fr 46px',
    alignItems: 'center',
    padding: '0 18px',
    boxSizing: 'border-box',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 16px 34px rgba(0,0,0,0.25)',
    fontFamily: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  landingBtnPrimary: {
    background: 'linear-gradient(135deg, rgba(198,107,77,0.82), rgba(147,72,54,0.72))',
    color: '#fff',
  },

  landingBtnSecondary: {
    background: 'rgba(255,248,239,0.72)',
    color: '#9a4d35',
  },

  landingBtnTextPrimary: {
    gridColumn: 2,
    textAlign: 'center',
    fontSize: 21,
    fontWeight: 500,
    color: '#fff',
    letterSpacing: -0.25,
  },

  landingBtnTextSecondary: {
    gridColumn: 2,
    textAlign: 'center',
    fontSize: 21,
    fontWeight: 500,
    color: '#9a4d35',
    letterSpacing: -0.25,
  },

  landingIconPrimary: {
    gridColumn: 3,
    width: 42,
    height: 42,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    justifySelf: 'end',
    color: '#fff',
    background: 'rgba(129,55,36,0.26)',
    fontSize: 28,
    fontWeight: 400,
  },

  landingIconSecondary: {
    gridColumn: 3,
    width: 42,
    height: 42,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    justifySelf: 'end',
    color: '#9a4d35',
    background: 'rgba(154,77,53,0.08)',
    fontSize: 26,
    fontWeight: 400,
  },

  authOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 40,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0 14px max(14px, env(safe-area-inset-bottom, 14px))',
    background: 'rgba(10,6,4,0.45)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    boxSizing: 'border-box',
  },

  authSheet: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    maxHeight: 'min(86dvh, 720px)',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 13,
    padding: '14px 18px 22px',
    borderRadius: 28,
    background: 'rgba(255,250,246,0.94)',
    border: '1px solid rgba(255,255,255,0.42)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.36)',
    boxSizing: 'border-box',
    color: '#2d2521',
  },

  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    background: 'rgba(122,81,66,0.18)',
    marginBottom: 2,
  },

  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: 'none',
    background: '#f3e8de',
    color: '#8b5b49',
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    zIndex: 2,
  },

  sheetHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '4px 42px 0',
    textAlign: 'center',
  },

  sheetTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: '#2d2521',
    letterSpacing: -0.5,
  },

  sheetSub: {
    margin: 0,
    fontSize: 11.5,
    fontWeight: 500,
    color: '#8f7769',
    lineHeight: 1.35,
  },

  modeToggle: {
    display: 'flex',
    width: '100%',
    background: '#f3e8de',
    borderRadius: 18,
    padding: 4,
    gap: 4,
    boxSizing: 'border-box',
  },

  modeBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 14,
    border: 'none',
    background: 'transparent',
    color: '#8f7769',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  modeBtnActive: {
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(147,72,54,0.18)',
  },

  googleWrap: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    minHeight: 42,
  },

  divider: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(130,82,62,0.16)',
  },

  dividerText: {
    color: '#9b8a7f',
    fontSize: 12,
    fontWeight: 700,
  },

  admForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  input: {
    width: '100%',
    padding: '14px 15px',
    borderRadius: 15,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#2d2521',
    fontSize: 14,
    fontWeight: 500,
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    colorScheme: 'light' as React.CSSProperties['colorScheme'],
    boxShadow: '0 8px 18px rgba(117,76,56,0.04)',
  },

  cityFieldWrap: {
    position: 'relative',
    width: '100%',
  },

  citySuggestList: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 80,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.12)',
    borderRadius: 16,
    padding: 6,
    boxShadow: '0 16px 34px rgba(70,45,34,0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 220,
    overflowY: 'auto',
  },

  citySuggestItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    borderRadius: 12,
    padding: '10px 11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },

  citySuggestName: {
    color: '#2d2521',
    fontSize: 13,
    fontWeight: 850,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  citySuggestUf: {
    minWidth: 34,
    padding: '4px 8px',
    borderRadius: 999,
    background: '#fff1eb',
    color: '#b45e45',
    fontSize: 11,
    fontWeight: 950,
    textAlign: 'center',
  },

  citySuggestLoading: {
    padding: '12px 10px',
    color: '#8f7769',
    fontSize: 12,
    fontWeight: 750,
    textAlign: 'center',
  },

  admBtn: {
    width: '100%',
    padding: '15px 20px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.24)',
    fontFamily: 'inherit',
  },

  error: {
    color: '#c95441',
    background: '#fff4f0',
    border: '1px solid rgba(201,84,65,0.14)',
    borderRadius: 12,
    padding: '9px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    margin: 0,
    textAlign: 'center',
  },

  infoMsg: {
    color: '#3f8f5b',
    background: '#edf8ef',
    border: '1px solid rgba(63,143,91,0.16)',
    borderRadius: 12,
    padding: '9px 10px',
    fontSize: 13,
    fontWeight: 700,
    margin: 0,
    textAlign: 'center',
  },

  hint: {
    color: '#8f7769',
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 1.5,
    margin: 0,
  },

  inlineLink: {
    border: 'none',
    background: 'transparent',
    color: '#a65440',
    fontSize: 11.5,
    fontWeight: 900,
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'inherit',
  },
};


// ---------------------------------------------------------------------------
// Estilos Modal Pagamento
// ---------------------------------------------------------------------------
const mp: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(45,31,24,0.50)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
    backdropFilter: 'blur(7px)',
    WebkitBackdropFilter: 'blur(7px)',
  },

  sheet: {
    position: 'relative',
    background: '#fffaf5',
    border: '1px solid rgba(255,255,255,0.55)',
    borderRadius: 30,
    padding: '16px 16px 22px',
    maxWidth: 430,
    width: '100%',
    maxHeight: '92dvh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    alignItems: 'stretch',
    boxShadow: '0 26px 76px rgba(35,23,18,0.34)',
    boxSizing: 'border-box',
    fontFamily: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(255,250,245,0.88)',
    border: '1px solid rgba(130,82,62,0.10)',
    color: '#8b5b49',
    fontSize: 25,
    lineHeight: 1,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(44,30,24,0.10)',
  },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 148,
    borderRadius: 24,
    backgroundImage: 'url(/tela_inicial.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center right',
    boxShadow: '0 14px 32px rgba(134,72,50,0.18)',
  },

  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(88,39,25,0.84) 0%, rgba(118,53,31,0.58) 46%, rgba(118,53,31,0.16) 100%)',
    zIndex: 1,
  },

  heroContent: {
    position: 'relative',
    zIndex: 2,
    padding: '22px 56px 22px 18px',
    minHeight: 148,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 7,
  },

  kicker: {
    color: 'rgba(255,245,235,0.82)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
  },

  kickerDark: {
    color: '#b7654a',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.4,
    textAlign: 'center',
  },

  title: {
    margin: 0,
    color: '#fff8ef',
    fontSize: 23,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: -0.7,
    maxWidth: 270,
  },

  sub: {
    margin: 0,
    color: 'rgba(255,248,239,0.84)',
    fontSize: 12.5,
    fontWeight: 650,
    lineHeight: 1.38,
    maxWidth: 280,
  },

  priceCard: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    padding: '15px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    boxShadow: '0 10px 26px rgba(117,76,56,0.06)',
  },

  priceLabel: {
    color: '#9b8a7f',
    fontSize: 11,
    fontWeight: 850,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },

  priceLine: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 5,
  },

  price: {
    color: '#2d2521',
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: -1,
    lineHeight: 1,
  },

  pricePeriod: {
    color: '#8f7769',
    fontSize: 13,
    fontWeight: 750,
    paddingBottom: 3,
  },

  priceHint: {
    margin: 0,
    color: '#8f7769',
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.35,
  },

  erro: {
    color: '#c95441',
    background: '#fff4f0',
    border: '1px solid rgba(201,84,65,0.16)',
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 12.5,
    fontWeight: 750,
    margin: 0,
    textAlign: 'center',
  },

  btnGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  payBtnPrimary: {
    width: '100%',
    minHeight: 68,
    padding: '13px 14px',
    borderRadius: 19,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '42px 1fr 22px',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
    boxShadow: '0 12px 24px rgba(147,72,54,0.24)',
    fontFamily: 'inherit',
  },

  payBtnSecondary: {
    width: '100%',
    minHeight: 68,
    padding: '13px 14px',
    borderRadius: 19,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.10)',
    color: '#2d2521',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '42px 1fr 22px',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
    boxShadow: '0 10px 24px rgba(117,76,56,0.06)',
    fontFamily: 'inherit',
  },

  payIcon: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(255,248,239,0.18)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 900,
  },

  payIconLight: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: '#fff1eb',
    color: '#c66b4d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 900,
  },

  payText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },

  payArrow: {
    color: 'rgba(255,248,239,0.82)',
    fontSize: 26,
    fontWeight: 300,
    textAlign: 'right',
  },

  payArrowLight: {
    color: '#c8917d',
    fontSize: 26,
    fontWeight: 300,
    textAlign: 'right',
  },

  hint: {
    margin: 0,
    color: '#9b8a7f',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.45,
  },

  stateBox: {
    minHeight: 300,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '26px 12px 12px',
    textAlign: 'center',
  },

  stateHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    paddingTop: 10,
    textAlign: 'center',
  },

  loadingIcon: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    boxShadow: '0 10px 26px rgba(117,76,56,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
  },

  successIcon: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    background: '#edf8ef',
    border: '1px solid rgba(63,143,91,0.16)',
    color: '#3f8f5b',
    boxShadow: '0 10px 26px rgba(117,76,56,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 34,
    fontWeight: 950,
  },

  stateTitle: {
    margin: 0,
    color: '#2d2521',
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  stateSub: {
    margin: 0,
    color: '#8f7769',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.45,
    textAlign: 'center',
  },

  qrWrap: {
    alignSelf: 'center',
    background: '#fff',
    borderRadius: 24,
    padding: 12,
    border: '1px solid rgba(130,82,62,0.08)',
    boxShadow: '0 12px 30px rgba(117,76,56,0.08)',
  },

  qrImg: {
    width: 210,
    height: 210,
    borderRadius: 16,
    background: '#fff',
    display: 'block',
  },

  btnCopiar: {
    width: '100%',
    padding: '15px',
    borderRadius: 17,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
    fontFamily: 'inherit',
  },

  btnVoltar: {
    alignSelf: 'center',
    background: 'transparent',
    border: 'none',
    color: '#a65440',
    fontSize: 13,
    fontWeight: 850,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'inherit',
  },

  primaryCloseBtn: {
    width: '100%',
    padding: '15px',
    borderRadius: 17,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
    fontFamily: 'inherit',
  },
};
