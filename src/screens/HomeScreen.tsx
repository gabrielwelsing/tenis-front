// =============================================================================
// HOME SCREEN — Hub principal pós-login
// =============================================================================

import React, { useRef, useState } from 'react';
import type { SaveMode } from '../App';
import type { Screen } from '../App';

interface Props {
  saveMode:       SaveMode;
  username:       string;
  role:           'user' | 'aluno' | 'admin';
  fotoUrl?:       string | null;
  telefone?:      string | null;
  localidade?:    string | null;
  onLogout:       () => void;
  onNavigate:     (screen: Screen) => void;
  onFotoUpload:   (file: File) => Promise<void>;
  onAssinar:      () => void;
  onSalvarPerfil: (dados: { nome: string; localidade: string; telefone: string }) => Promise<void>;
}

function UserOutlineIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.8 20.2c1.35-4.1 4.05-6.15 7.2-6.15s5.85 2.05 7.2 6.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.8 12 4l8 6.8v8.4a.8.8 0 0 1-.8.8h-4.4v-5.6H9.2V20H4.8a.8.8 0 0 1-.8-.8v-8.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function TennisBallIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="currentColor" />
      <path d="M10 18c8 2.8 14.3 9.1 17.4 20" stroke="#fff7ef" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M38 30c-8-2.8-14.3-9.1-17.4-20" stroke="#fff7ef" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.8v4M16 3.8v4M4.7 10h14.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 19c.9-3.3 2.7-5 5.2-5s4.3 1.7 5.2 5M14.2 15.2c2.4.15 4 1.4 4.9 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h8v4.8c0 3-1.65 5.2-4 5.2s-4-2.2-4-5.2V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 6H5.2v2.1c0 2 1.2 3.4 3.2 3.7M16 6h2.8v2.1c0 2-1.2 3.4-3.2 3.7M12 14v3.2M8.5 20h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.8" y="7" width="16.4" height="12" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 7 9.6 4.8h4.8L15.8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BiomechanicsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="4.8" r="2.1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.2v5.2M12 12.4l-4.2 4M12 12.4l4.2 4M9.4 9.4 6.1 11M14.6 9.4l3.3 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.8 20.2 9.4 16M16.2 20.2 14.6 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CompareIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="6.8" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.2" y="5" width="6.8" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function InstagramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.8" cy="7.4" r="1" fill="currentColor" />
    </svg>
  );
}

function HistoryIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 6.5h5l1.5 2h8.5v9.2a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 13h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.8v3M21.2 12h-3M12 21.2v-3M2.8 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function HomeScreen({
  saveMode, username, role, fotoUrl, telefone, localidade,
  onLogout, onNavigate, onFotoUpload, onAssinar, onSalvarPerfil,
}: Props) {
  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'Professor';

  const isAdmin = role === 'admin' || role === 'aluno';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [cfgNome, setCfgNome] = useState(username ?? '');
  const [cfgLocalidade, setCfgLocalidade] = useState(localidade ?? '');
  const [cfgTelefone, setCfgTelefone] = useState(telefone ?? '');
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgMsg, setCfgMsg] = useState('');

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onFotoUpload(file); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let masked = d;
    if (d.length > 7) masked = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    else if (d.length > 2) masked = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    else if (d.length > 0) masked = `(${d}`;
    setCfgTelefone(masked);
  };

  const handleSalvarConfig = async () => {
    if (!cfgNome.trim()) { setCfgMsg('Nome é obrigatório.'); return; }
    const digits = cfgTelefone.replace(/\D/g, '');
    if (digits.length !== 11) { setCfgMsg('Telefone inválido. Use (XX) 9XXXX-XXXX.'); return; }
    setCfgLoading(true);
    setCfgMsg('');
    try {
      await onSalvarPerfil({
        nome: cfgNome.trim(),
        localidade: cfgLocalidade.trim(),
        telefone: cfgTelefone.trim(),
      });
      setCfgMsg('✅ Salvo com sucesso!');
      setTimeout(() => {
        setCfgMsg('');
        setShowConfig(false);
      }, 1500);
    } catch {
      setCfgMsg('Erro ao salvar. Tente novamente.');
    } finally {
      setCfgLoading(false);
    }
  };

  const semTelefone = !telefone || telefone.trim() === '';

  const LockedCard = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div style={{ ...s.quickCard, ...s.quickCardLocked }}>
      <div style={s.quickLock}>🔒</div>
      <div style={s.quickIcon}>{icon}</div>
      <div style={s.quickLabel}>{title}</div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.bgGlow1} />
      <div style={s.bgGlow2} />
      <div style={s.bgImage} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {showConfig && (
        <div style={cfg.overlay} onClick={e => e.target === e.currentTarget && setShowConfig(false)}>
          <div style={cfg.sheet}>
            <div style={cfg.headerRow}>
              <div>
                <h2 style={cfg.title}>Perfil</h2>
                <p style={cfg.subtitle}>Atualize seus dados do app</p>
              </div>
              <button onClick={() => setShowConfig(false)} style={cfg.closeBtn}>✕</button>
            </div>

            <div style={cfg.fieldGroup}>
              <span style={cfg.label}>Nome</span>
              <input
                style={cfg.input}
                type="text"
                value={cfgNome}
                onChange={e => setCfgNome(e.target.value)}
                autoCapitalize="words"
              />
            </div>

            <div style={cfg.fieldGroup}>
              <span style={cfg.label}>Cidade / Localidade</span>
              <input
                style={cfg.input}
                type="text"
                value={cfgLocalidade}
                onChange={e => setCfgLocalidade(e.target.value)}
                autoCapitalize="words"
              />
            </div>

            <div style={cfg.fieldGroup}>
              <span style={cfg.label}>Telefone / WhatsApp *</span>
              <input
                style={{
                  ...cfg.input,
                  borderColor: cfgTelefone.replace(/\D/g, '').length !== 11 ? '#d86c56' : '#eadfd6',
                }}
                type="tel"
                inputMode="numeric"
                placeholder="(11) 91234-5678"
                value={cfgTelefone}
                onChange={handleTelefoneChange}
              />
            </div>

            {cfgMsg && (
              <p
                style={{
                  color: cfgMsg.startsWith('✅') ? '#3f8f5b' : '#c95441',
                  fontSize: 13,
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                {cfgMsg}
              </p>
            )}

            <button
              style={{ ...cfg.saveBtn, opacity: cfgLoading ? 0.6 : 1 }}
              onClick={handleSalvarConfig}
              disabled={cfgLoading}
            >
              {cfgLoading ? 'Salvando...' : 'Salvar perfil'}
            </button>

            <button style={cfg.logoutBtn} onClick={onLogout}>
              Sair da conta
            </button>
          </div>
        </div>
      )}

      <div style={s.scrollBody}>
        <div style={s.content}>

          <div style={s.header}>
            <div style={s.avatarRow}>
              <div style={s.avatarWrap} onClick={handleAvatarClick} title="Alterar foto">
                {uploading ? (
                  <div style={{ ...s.avatarFallback, fontSize: 12 }}>⏳</div>
                ) : fotoUrl ? (
                  <img src={fotoUrl} alt={displayName} style={s.avatar} />
                ) : (
                  <div style={s.avatarFallback}>{displayName.charAt(0).toUpperCase()}</div>
                )}
                <div style={s.avatarEditBadge}>📷</div>
              </div>

              <div>
                <h2 style={s.greeting}>Olá, <span style={s.greetingName}>{displayName}</span></h2>
                <p style={s.greetingSub}>Pronto para jogar melhor hoje?</p>
              </div>
            </div>

            <div style={s.headerActions}>
              <button onClick={() => setShowConfig(true)} style={s.profileBtn} title="Perfil">
                <UserOutlineIcon size={21} />
              </button>
            </div>
          </div>

          {semTelefone && (
            <div style={s.alertBanner}>
              <span style={s.alertText}>📱 Preencha seu telefone nas configurações para usar todos os recursos do app.</span>
              <button onClick={() => setShowConfig(true)} style={s.alertBtn}>Preencher agora</button>
            </div>
          )}

          {role === 'user' && !semTelefone && (
            <div style={s.upgradeBanner}>
              <span style={s.upgradeText}>⚡ Assine por R$ 14,90/mês e desbloqueie todas as funcionalidades</span>
              <button onClick={onAssinar} style={s.assinarBtn}>Assinar agora</button>
            </div>
          )}

          {role === 'user' && semTelefone && (
            <div style={{ ...s.upgradeBanner, opacity: 0.5 }}>
              <span style={s.upgradeText}>⚡ Assine por R$ 14,90/mês e desbloqueie todas as funcionalidades</span>
            </div>
          )}

          <section style={s.heroCard}>
            <div style={s.heroOverlay} />

            <div style={s.heroContent}>
              <div style={s.heroKicker}>SEM ATIVIDADE AGENDADA</div>
              <h1 style={s.heroTitle}>Agende sua próxima atividade!</h1>

              <div style={s.heroMeta}>
                <div style={s.heroMetaLine}>
                  <CalendarIcon size={15} />
                  <span>Partidas, aulas e treinos em um só lugar</span>
                </div>
                <div style={s.heroMetaLine}>
                  <TargetIcon size={15} />
                  <span>Use o mural para encontrar parceiros</span>
                </div>
              </div>
            </div>
          </section>

          <section style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Acesso rápido</h3>
              <span style={s.sectionLink}>Ver tudo ›</span>
            </div>

            <div style={s.quickGrid}>
              <button style={s.quickCard} onClick={() => onNavigate('mural')}>
                <div style={s.quickIcon}><PeopleIcon /></div>
                <div style={s.quickLabel}>Mural de Treinos</div>
              </button>

              <button style={s.quickCard} onClick={() => onNavigate('agenda')}>
                <div style={s.quickIcon}><CalendarIcon /></div>
                <div style={s.quickLabel}>Agenda</div>
              </button>

              {isAdmin ? (
                <button style={s.quickCard} onClick={() => onNavigate('ranking')}>
                  <div style={s.quickIcon}><TrophyIcon /></div>
                  <div style={s.quickLabel}>Ranking</div>
                </button>
              ) : (
                <LockedCard icon={<TrophyIcon />} title="Ranking" />
              )}

              {isAdmin ? (
                <button style={s.quickCard} onClick={() => onNavigate('camera')}>
                  <div style={s.quickIcon}><CameraIcon /></div>
                  <div style={s.quickLabel}>Câmera</div>
                </button>
              ) : (
                <LockedCard icon={<CameraIcon />} title="Câmera" />
              )}

              {isAdmin ? (
                <button style={s.quickCard} onClick={() => onNavigate('biomechanics')}>
                  <div style={s.quickIcon}><BiomechanicsIcon /></div>
                  <div style={s.quickLabel}>Biomecânica (IA)</div>
                </button>
              ) : (
                <LockedCard icon={<BiomechanicsIcon />} title="Biomecânica (IA)" />
              )}

              {isAdmin ? (
                <button style={s.quickCard} onClick={() => onNavigate('comparison')}>
                  <div style={s.quickIcon}><CompareIcon /></div>
                  <div style={s.quickLabel}>Comparativo de Vídeos</div>
                </button>
              ) : (
                <LockedCard icon={<CompareIcon />} title="Comparativo de Vídeos" />
              )}

              {isAdmin ? (
                <button style={s.quickCard} onClick={() => onNavigate('instagram')}>
                  <div style={s.quickIcon}><InstagramIcon /></div>
                  <div style={s.quickLabel}>Instagram Reels</div>
                </button>
              ) : (
                <LockedCard icon={<InstagramIcon />} title="Instagram Reels" />
              )}

              {isAdmin ? (
                <button style={s.quickCard} onClick={() => onNavigate('history')}>
                  <div style={s.quickIcon}><HistoryIcon /></div>
                  <div style={s.quickLabel}>Histórico</div>
                </button>
              ) : (
                <LockedCard icon={<HistoryIcon />} title="Histórico" />
              )}
            </div>
          </section>

          <section style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Próximos eventos</h3>
              <span style={s.sectionLink}>Ver agenda ›</span>
            </div>

            <div style={s.eventsCard}>
              <div style={s.eventItem}>
                <div style={s.eventDateBox}>
                  <strong>--</strong>
                  <span>---</span>
                </div>

                <div style={s.eventInfo}>
                  <div style={s.eventTitle}>Nenhum evento próximo</div>
                  <div style={s.eventMeta}>
                    Quando houver partidas, aulas ou treinos agendados, eles aparecerão aqui.
                  </div>
                </div>

                <div style={s.eventArrow}>›</div>
              </div>
            </div>
          </section>

          <div style={s.footer}>
            <span style={s.footerText}>@jogartenisto</span>
          </div>

        </div>
      </div>

      <nav style={s.bottomNav}>
        <button style={s.navItem} onClick={() => onNavigate('home')}>
          <span style={{ ...s.navIcon, ...s.navIconActive }}><HomeIcon size={21} /></span>
          <span style={{ ...s.navLabel, ...s.navLabelActive }}>Início</span>
        </button>

        <button style={s.navCenterBtn} onClick={() => onNavigate('mural')} aria-label="Criar atividade no mural">
          <TennisBallIcon size={38} />
        </button>

        <button style={s.navItem} onClick={() => setShowConfig(true)}>
          <span style={s.navIcon}><UserOutlineIcon size={21} /></span>
          <span style={s.navLabel}>Perfil</span>
        </button>
      </nav>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: '#fbf7f1',
    color: '#2c2420',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  bgGlow1: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(191,102,72,0.16) 0%, transparent 68%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  bgGlow2: {
    position: 'absolute',
    bottom: -130,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(116,80,58,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  bgImage: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(255,251,245,0.98), rgba(248,239,230,0.96))',
    pointerEvents: 'none',
    zIndex: 0,
  },

  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    position: 'relative',
    zIndex: 2,
  },

  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0 14px 112px',
    gap: 14,
    maxWidth: 440,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    paddingTop: 'max(18px, env(safe-area-inset-top, 18px))',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '4px 2px 0',
  },

  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },

  avatarWrap: {
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
    width: 54,
    height: 54,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #fff',
    boxShadow: '0 10px 25px rgba(111,73,54,0.16)',
  },

  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #c6714e, #8f4635)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 21,
    fontWeight: 900,
    color: '#fff',
    border: '3px solid #fff',
    boxShadow: '0 10px 25px rgba(111,73,54,0.16)',
  },

  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -3,
    background: '#fff7ef',
    borderRadius: '50%',
    fontSize: 10,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(127,75,55,0.16)',
    boxShadow: '0 6px 16px rgba(111,73,54,0.16)',
  },

  greeting: {
    color: '#2d2521',
    fontSize: 22,
    fontWeight: 850,
    margin: 0,
    lineHeight: 1.1,
    letterSpacing: -0.55,
    whiteSpace: 'nowrap',
  },

  greetingName: {
    color: '#2d2521',
  },

  greetingSub: {
    color: '#94857a',
    fontSize: 12.5,
    fontWeight: 600,
    margin: '4px 0 0',
    lineHeight: 1.2,
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    background: '#f3e8de',
    color: '#6e4b3c',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(111,73,54,0.08)',
  },

  alertBanner: {
    background: '#fff',
    border: '1px solid rgba(216,108,86,0.18)',
    borderRadius: 18,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 10px 26px rgba(123,72,52,0.07)',
  },

  alertText: {
    color: '#b85e4d',
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.45,
  },

  alertBtn: {
    width: '100%',
    padding: '11px 0',
    borderRadius: 13,
    background: '#fff3ec',
    border: '1px solid rgba(216,108,86,0.24)',
    color: '#a44e3e',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },

  upgradeBanner: {
    background: '#fff',
    border: '1px solid rgba(127,75,55,0.12)',
    borderRadius: 18,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 10px 26px rgba(123,72,52,0.07)',
  },

  upgradeText: {
    color: '#815544',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.45,
  },

  assinarBtn: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 13,
    background: 'linear-gradient(135deg, #bc6548, #8c4736)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(140,71,54,0.22)',
  },

  heroCard: {
    position: 'relative',
    minHeight: 210,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundImage: 'url(/tela_inicial.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center right',
    backgroundRepeat: 'no-repeat',
    boxShadow: '0 18px 36px rgba(134,72,50,0.22)',
    padding: '24px 22px',
    boxSizing: 'border-box',
    isolation: 'isolate',
  },

  heroOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    background: 'linear-gradient(90deg, rgba(88,39,25,0.78) 0%, rgba(118,53,31,0.52) 42%, rgba(118,53,31,0.08) 100%)',
    pointerEvents: 'none',
  },

  heroContent: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '58%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  heroKicker: {
    color: 'rgba(255,245,235,0.78)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.7,
  },

  heroTitle: {
    margin: 0,
    color: '#fff8ef',
    fontSize: 27,
    lineHeight: 1.08,
    fontWeight: 900,
    letterSpacing: -0.8,
    textShadow: '0 2px 12px rgba(71,35,26,0.18)',
  },

  heroMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 2,
  },

  heroMetaLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    color: 'rgba(255,248,239,0.88)',
    fontSize: 11.5,
    fontWeight: 650,
    lineHeight: 1.35,
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2px',
  },

  sectionTitle: {
    margin: 0,
    color: '#342a24',
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: -0.2,
  },

  sectionLink: {
    color: '#a86a55',
    fontSize: 11,
    fontWeight: 800,
  },

  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 9,
  },

  quickCard: {
    position: 'relative',
    minHeight: 86,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(130,82,62,0.08)',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
    cursor: 'pointer',
    padding: '11px 6px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textAlign: 'center',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },

  quickCardLocked: {
    cursor: 'default',
    opacity: 0.62,
  },

  quickIcon: {
    color: '#b45e45',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },

  quickLabel: {
    color: '#3d332e',
    fontSize: 10.3,
    fontWeight: 800,
    lineHeight: 1.15,
    minHeight: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickLock: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 19,
    height: 19,
    borderRadius: '50%',
    background: '#fff4ec',
    color: '#8f4a39',
    fontSize: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(117,76,56,0.08)',
  },

  eventsCard: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  eventItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 72,
    boxSizing: 'border-box',
  },

  eventDateBox: {
    width: 48,
    height: 52,
    borderRadius: 13,
    background: '#f4ebe3',
    color: '#7b5141',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  eventInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  eventTitle: {
    color: '#342a24',
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  eventMeta: {
    color: '#938174',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.35,
  },

  eventArrow: {
    color: '#b59c8c',
    fontSize: 22,
    fontWeight: 300,
    paddingRight: 2,
  },

  footer: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 2,
  },

  footerText: {
    color: '#b29c8f',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: 700,
  },

  bottomNav: {
    position: 'absolute',
    left: '50%',
    bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 28px)',
    maxWidth: 412,
    height: 66,
    borderRadius: 26,
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(130,82,62,0.08)',
    boxShadow: '0 18px 42px rgba(91,61,46,0.16)',
    zIndex: 20,
    display: 'grid',
    gridTemplateColumns: '1fr 86px 1fr',
    alignItems: 'center',
    padding: '0 12px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(16px)',
  },

  navItem: {
    border: 'none',
    background: 'transparent',
    color: '#a7958a',
    cursor: 'pointer',
    height: 52,
    borderRadius: 18,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: 'inherit',
  },

  navIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9b8b81',
  },

  navIconActive: {
    color: '#c16649',
  },

  navLabel: {
    color: '#9b8b81',
    fontSize: 10,
    fontWeight: 800,
  },

  navLabelActive: {
    color: '#c16649',
  },

  navCenterBtn: {
    width: 62,
    height: 62,
    borderRadius: '50%',
    border: '5px solid #fff8f0',
    background: 'linear-gradient(135deg, #d56d4d, #9d4937)',
    color: '#fff',
    cursor: 'pointer',
    margin: '0 auto',
    transform: 'translateY(-18px)',
    boxShadow: '0 14px 26px rgba(157,73,55,0.32)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

const cfg: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(44,30,24,0.42)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    backdropFilter: 'blur(5px)',
  },

  sheet: {
    background: '#fffaf5',
    border: '1px solid rgba(130,82,62,0.12)',
    borderRadius: '28px 28px 0 0',
    padding: '26px 22px 34px',
    maxWidth: 480,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 15,
    boxShadow: '0 -16px 44px rgba(55,35,26,0.22)',
  },

  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    margin: 0,
    fontSize: 21,
    fontWeight: 900,
    color: '#2d2521',
    letterSpacing: -0.4,
  },

  subtitle: {
    margin: '3px 0 0',
    fontSize: 12,
    fontWeight: 650,
    color: '#9b8a7f',
  },

  closeBtn: {
    background: '#f4ebe3',
    border: 'none',
    color: '#8b6657',
    fontSize: 18,
    cursor: 'pointer',
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  label: {
    fontSize: 11,
    fontWeight: 850,
    color: '#8f7769',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },

  input: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 15,
    fontWeight: 650,
    boxSizing: 'border-box' as const,
    outline: 'none',
  },

  saveBtn: {
    width: '100%',
    padding: '15px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  logoutBtn: {
    width: '100%',
    padding: '13px',
    borderRadius: 16,
    background: '#f5ebe4',
    border: '1px solid rgba(130,82,62,0.12)',
    color: '#8f4a39',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },
};
