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

export default function HomeScreen({
  saveMode, username, role, fotoUrl, telefone, localidade,
  onLogout, onNavigate, onFotoUpload, onAssinar, onSalvarPerfil,
}: Props) {
  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'Professor';

  const isAdmin = role === 'admin' || role === 'aluno';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading,   setUploading]   = useState(false);
  const [showConfig,  setShowConfig]  = useState(false);

  const [cfgNome,       setCfgNome]       = useState(username ?? '');
  const [cfgLocalidade, setCfgLocalidade] = useState(localidade ?? '');
  const [cfgTelefone,   setCfgTelefone]   = useState(telefone ?? '');
  const [cfgLoading,    setCfgLoading]    = useState(false);
  const [cfgMsg,        setCfgMsg]        = useState('');

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
    if (d.length > 7)      masked = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    else if (d.length > 2) masked = `(${d.slice(0,2)}) ${d.slice(2)}`;
    else if (d.length > 0) masked = `(${d}`;
    setCfgTelefone(masked);
  };

  const handleSalvarConfig = async () => {
    if (!cfgNome.trim()) { setCfgMsg('Nome é obrigatório.'); return; }
    const digits = cfgTelefone.replace(/\D/g, '');
    if (digits.length !== 11) { setCfgMsg('Telefone inválido. Use (XX) 9XXXX-XXXX.'); return; }
    setCfgLoading(true); setCfgMsg('');
    try {
      await onSalvarPerfil({ nome: cfgNome.trim(), localidade: cfgLocalidade.trim(), telefone: cfgTelefone.trim() });
      setCfgMsg('✅ Salvo com sucesso!');
      setTimeout(() => { setCfgMsg(''); setShowConfig(false); }, 1500);
    } catch { setCfgMsg('Erro ao salvar. Tente novamente.'); }
    finally { setCfgLoading(false); }
  };

  const semTelefone = !telefone || telefone.trim() === '';

  const LockedCard = ({ icon, title, sub, cardStyle }: { icon: string; title: string; sub: string; cardStyle: React.CSSProperties }) => (
    <div style={{ ...s.card, ...cardStyle, opacity: 0.4, cursor: 'default' }}>
      <div style={s.cardIconWrap}>{icon}</div>
      <div style={s.cardBody}>
        <div style={s.cardTitle}>{title}</div>
        <div style={s.cardSub}>{sub}</div>
      </div>
      <div style={s.lockBadge}>🔒 R$ 14,90/mês</div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.bgGlow1} />
      <div style={s.bgGlow2} />
      <div style={s.bgImage} />

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Modal Configurações */}
      {showConfig && (
        <div style={cfg.overlay} onClick={e => e.target === e.currentTarget && setShowConfig(false)}>
          <div style={cfg.sheet}>
            <div style={cfg.headerRow}>
              <h2 style={cfg.title}>⚙️ Configurações</h2>
              <button onClick={() => setShowConfig(false)} style={cfg.closeBtn}>✕</button>
            </div>

            <div style={cfg.fieldGroup}>
              <span style={cfg.label}>Nome</span>
              <input style={cfg.input} type="text" value={cfgNome} onChange={e => setCfgNome(e.target.value)} autoCapitalize="words" />
            </div>

            <div style={cfg.fieldGroup}>
              <span style={cfg.label}>Cidade / Localidade</span>
              <input style={cfg.input} type="text" value={cfgLocalidade} onChange={e => setCfgLocalidade(e.target.value)} autoCapitalize="words" />
            </div>

            <div style={cfg.fieldGroup}>
              <span style={cfg.label}>Telefone / WhatsApp *</span>
              <input
                style={{ ...cfg.input, borderColor: cfgTelefone.replace(/\D/g,'').length !== 11 ? '#ff6b6b' : 'rgba(255,255,255,0.13)' }}
                type="tel" inputMode="numeric" placeholder="(11) 91234-5678"
                value={cfgTelefone} onChange={handleTelefoneChange}
              />
            </div>

            {cfgMsg && <p style={{ color: cfgMsg.startsWith('✅') ? '#81c784' : '#ff6b6b', fontSize: 13, margin: 0, textAlign: 'center' }}>{cfgMsg}</p>}

            <button style={{ ...cfg.saveBtn, opacity: cfgLoading ? 0.6 : 1 }} onClick={handleSalvarConfig} disabled={cfgLoading}>
              {cfgLoading ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </div>
      )}

      <div style={s.scrollBody}>
        <div style={s.content}>

          <div style={s.header}>
            <div style={s.headerLeft}>
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
                  <h2 style={s.greeting}>Olá, <span style={s.greetingName}>{displayName}</span> 👋</h2>
                  <p style={s.appName}>Tenis Coach com Carlão</p>
                </div>
              </div>
            </div>
            <div style={s.headerActions}>
              <button onClick={() => setShowConfig(true)} style={s.configBtn} title="Configurações">⚙️</button>
              <button onClick={onLogout} style={s.sairBtn}>Sair</button>
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

          <div style={s.cardList}>

            {/* 1. Mural de Treinos */}
            <button style={{ ...s.card, ...s.cardCyan }} onClick={() => onNavigate('mural')}>
              <div style={s.cardIconWrap}>🎾</div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Mural de Treinos</div>
                <div style={s.cardSub}>Encontre um parceiro para treinar</div>
              </div>
              <div style={{ ...s.badge, ...s.badgeCyan }}>novo</div>
            </button>

            {/* 2. Agenda */}
            <button style={{ ...s.card, ...s.cardOrange }} onClick={() => onNavigate('agenda')}>
              <div style={s.cardIconWrap}>📅</div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Agenda</div>
                <div style={s.cardSub}>Agendar aulas e quadras</div>
              </div>
              <div style={{ ...s.badge, ...s.badgeOrange }}>novo</div>
            </button>

            {/* 3. Ranking — visível para todos */}
            <button style={{ ...s.card, ...s.cardGreen }} onClick={() => onNavigate('ranking')}>
              <div style={s.cardIconWrap}>🏆</div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Ranking</div>
                <div style={s.cardSub}>Liga, campeonato e tabela de pontos</div>
              </div>
              <div style={{ ...s.badge, ...s.badgeGreen }}>novo</div>
            </button>

            {/* 4. Câmera */}
            {isAdmin ? (
              <button style={{ ...s.card, ...s.cardBlue }} onClick={() => onNavigate('camera')}>
                <div style={s.cardIconWrap}>🎬</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Câmera</div>
                  <div style={s.cardSub}>Grave e salve os últimos segundos do treino</div>
                </div>
                <div style={{ ...s.badge, ...s.badgeBlue }}>principal</div>
              </button>
            ) : (
              <LockedCard icon="🎬" title="Câmera" sub="Grave e salve os últimos segundos do treino" cardStyle={s.cardBlue} />
            )}

            {/* 5. Análise Biomecânica */}
            {isAdmin ? (
              <button style={{ ...s.card, ...s.cardTeal }} onClick={() => onNavigate('biomechanics')}>
                <div style={s.cardIconWrap}>🦴</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Análise Biomecânica</div>
                  <div style={s.cardSub}>Detecte ângulos articulares via IA</div>
                </div>
                <div style={{ ...s.badge, ...s.badgeTeal }}>IA</div>
              </button>
            ) : (
              <LockedCard icon="🦴" title="Análise Biomecânica" sub="Detecte ângulos articulares via IA" cardStyle={s.cardTeal} />
            )}

            {/* 6. Comparativo de Vídeos */}
            {isAdmin ? (
              <button style={{ ...s.card, ...s.cardPurple }} onClick={() => onNavigate('comparison')}>
                <div style={s.cardIconWrap}>⚖️</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Comparativo de Vídeos</div>
                  <div style={s.cardSub}>Compare dois vídeos lado a lado</div>
                </div>
                <div style={{ ...s.badge, ...s.badgePurple }}>pro</div>
              </button>
            ) : (
              <LockedCard icon="⚖️" title="Comparativo de Vídeos" sub="Compare dois vídeos lado a lado" cardStyle={s.cardPurple} />
            )}

            {/* 7. Instagram Reels */}
            {isAdmin ? (
              <button style={{ ...s.card, ...s.cardPink }} onClick={() => onNavigate('instagram')}>
                <div style={s.cardIconWrap}>📸</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Instagram Reels</div>
                  <div style={s.cardSub}>Recorte e exporte vídeos 9:16 para o Instagram</div>
                </div>
                <div style={{ ...s.badge, ...s.badgePink }}>reels</div>
              </button>
            ) : (
              <LockedCard icon="📸" title="Instagram Reels" sub="Recorte e exporte vídeos 9:16 para o Instagram" cardStyle={s.cardPink} />
            )}

            {/* 8. Histórico */}
            {isAdmin ? (
              <button style={{ ...s.card, ...s.cardGray }} onClick={() => onNavigate('history')}>
                <div style={s.cardIconWrap}>📂</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Histórico</div>
                  <div style={s.cardSub}>Veja os vídeos e áudios salvos</div>
                </div>
              </button>
            ) : (
              <LockedCard icon="📂" title="Histórico" sub="Veja os vídeos e áudios salvos" cardStyle={s.cardGray} />
            )}

          </div>

          <div style={s.footer}>
            <span style={s.footerText}>@jogartenisto</span>
          </div>

        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { position: 'fixed', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0a0a0f' },
  bgGlow1: { position: 'absolute', top: '-15%', right: '-10%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  bgGlow2: { position: 'absolute', bottom: '-20%', left: '-15%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,100,180,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  bgImage: { position: 'absolute', inset: 0, backgroundImage: 'url(/carlao-atual.jpg)', backgroundPosition: 'center center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', opacity: 0.04, pointerEvents: 'none', zIndex: 0 },
  scrollBody: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'], position: 'relative', zIndex: 2 },
  content: { display: 'flex', flexDirection: 'column', padding: '0 16px 36px', gap: 12, maxWidth: 520, width: '100%', margin: '0 auto', boxSizing: 'border-box', paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  avatarRow: { display: 'flex', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative', cursor: 'pointer', flexShrink: 0, width: 48, height: 48 },
  avatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,229,255,0.4)', boxShadow: '0 0 12px rgba(0,229,255,0.2)' },
  avatarFallback: { width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #0097a7, #00e5ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#000', border: '2px solid rgba(0,229,255,0.4)' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, background: '#0a0a0f', borderRadius: '50%', fontSize: 12, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,229,255,0.3)' },
  greeting: { color: '#fff', fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: -0.5 },
  greetingName: { color: '#00e5ff' },
  appName: { color: 'rgba(0,229,255,0.45)', fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: 1, textTransform: 'uppercase' },
  configBtn: { background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)', color: '#00e5ff', width: 40, height: 40, borderRadius: 12, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sairBtn: { background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)', color: '#00e5ff', padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40, flexShrink: 0 },
  alertBanner: { background: 'linear-gradient(135deg, rgba(255,107,107,0.1), rgba(255,107,107,0.05))', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  alertText: { color: '#ff6b6b', fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  alertBtn: { width: '100%', padding: '11px 0', borderRadius: 12, background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)', color: '#ff6b6b', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  upgradeBanner: { background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(0,100,180,0.12))', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  upgradeText: { color: '#00e5ff', fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  assinarBtn: { width: '100%', padding: '13px 0', borderRadius: 12, background: 'linear-gradient(135deg, #0097a7, #00e5ff)', border: 'none', color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,229,255,0.3)' },
  cardList: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 82, padding: '14px 16px', borderRadius: 18, border: 'none', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box', position: 'relative', fontFamily: 'system-ui, sans-serif' },
  cardCyan:   { background: 'linear-gradient(135deg, #006064 0%, #0097a7 100%)', boxShadow: '0 4px 20px rgba(0,151,167,0.35)' },
  cardPink:   { background: 'linear-gradient(135deg, #880e4f 0%, #c2185b 100%)', boxShadow: '0 4px 20px rgba(194,24,91,0.3)' },
  cardBlue:   { background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)', boxShadow: '0 4px 20px rgba(25,118,210,0.3)' },
  cardTeal:   { background: 'linear-gradient(135deg, #004d40 0%, #00796b 100%)', boxShadow: '0 4px 20px rgba(0,121,107,0.3)' },
  cardPurple: { background: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 100%)', boxShadow: '0 4px 20px rgba(123,31,162,0.3)' },
  cardGray:   { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' },
  cardOrange: { background: 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)', boxShadow: '0 4px 20px rgba(245,124,0,0.3)' },
  cardGreen:  { background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', boxShadow: '0 4px 20px rgba(46,125,50,0.35)' },
  cardIconWrap: { fontSize: 28, lineHeight: 1, flexShrink: 0 },
  cardBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.3 },
  cardSub:   { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.4 },
  badge: { position: 'absolute', top: 9, right: 12, fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, letterSpacing: 0.5, whiteSpace: 'nowrap', textTransform: 'uppercase' },
  badgeCyan:   { background: 'rgba(0,0,0,0.3)', color: '#80deea' },
  badgePink:   { background: 'rgba(0,0,0,0.3)', color: '#f48fb1' },
  badgeBlue:   { background: 'rgba(255,255,255,0.2)', color: '#fff' },
  badgeTeal:   { background: 'rgba(0,0,0,0.3)', color: '#80cbc4' },
  badgePurple: { background: 'rgba(0,0,0,0.3)', color: '#ce93d8' },
  badgeOrange: { background: 'rgba(0,0,0,0.3)', color: '#ffcc80' },
  badgeGreen:  { background: 'rgba(0,0,0,0.3)', color: '#a5d6a7' },
  lockBadge: { position: 'absolute', bottom: 8, right: 12, fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' },
  footer: { display: 'flex', justifyContent: 'center', paddingTop: 8 },
  footerText: { color: 'rgba(0,229,255,0.25)', fontSize: 11, letterSpacing: 1 },
};

const cfg: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px 24px 0 0', padding: '28px 24px 48px', maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase' as const },
  input: { width: '100%', padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box' as const, colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  saveBtn: { width: '100%', padding: '15px', borderRadius: 14, background: 'linear-gradient(135deg, #0097a7, #00e5ff)', border: 'none', color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
};
