// =============================================================================
// HOME SCREEN — Hub principal pós-login
// =============================================================================

import React from 'react';
import type { SaveMode } from '../App';
import type { Screen } from '../App';

interface Props {
  saveMode: SaveMode;
  username: string;
  role: 'user' | 'admin';
  onLogout: () => void;
  onNavigate: (screen: Screen) => void;
}

export default function HomeScreen({ saveMode, username, role, onLogout, onNavigate }: Props) {
  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'Professor';

  const isAdmin = role === 'admin';

  return (
    <div style={s.page}>
      <div style={s.bgImage} />
      <div style={s.bgOverlay} />

      <div style={s.scrollBody}>
        <div style={s.content}>

          {/* Header */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <h2 style={s.greeting}>
                Olá, <span style={s.greetingName}>{displayName}</span> 👋
              </h2>
              <p style={s.appName}>Tenis Coach com Carlão</p>
            </div>
            <button onClick={onLogout} style={s.sairBtn}>Sair</button>
          </div>

          {/* Cards */}
          <div style={s.cardList}>

            {/* Mural de Treinos — todos */}
            <button style={{ ...s.card, ...s.cardGreen }} onClick={() => onNavigate('mural')}>
              <div style={s.cardIcon}>🎾</div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Mural de Treinos</div>
                <div style={s.cardSub}>Encontre um parceiro para treinar</div>
              </div>
              <div style={{ ...s.badge, ...s.badgeGreen }}>novo</div>
            </button>

            {/* Instagram Reels — todos */}
            <button style={{ ...s.card, ...s.cardGradient }} onClick={() => onNavigate('instagram')}>
              <div style={s.cardIcon}>📱</div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Instagram Reels</div>
                <div style={s.cardSub}>Recorte horizontal → 9:16 para Stories</div>
              </div>
              <div style={{ ...s.badge, ...s.badgePink }}>local</div>
            </button>

            {/* Câmera — admin only */}
            {isAdmin && (
              <button style={{ ...s.card, ...s.cardRed }} onClick={() => onNavigate('camera')}>
                <div style={s.cardIcon}>🎬</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Câmera</div>
                  <div style={s.cardSub}>Grave e salve os últimos segundos do treino</div>
                </div>
                <div style={{ ...s.badge, ...s.badgeRed }}>principal</div>
              </button>
            )}

            {/* Análise Biomecânica — admin only */}
            {isAdmin && (
              <button style={{ ...s.card, ...s.cardTeal }} onClick={() => onNavigate('biomechanics')}>
                <div style={s.cardIcon}>🦴</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Análise Biomecânica</div>
                  <div style={s.cardSub}>Detecte ângulos articulares via IA</div>
                </div>
                <div style={{ ...s.badge, ...s.badgeTeal }}>sem custo</div>
              </button>
            )}

            {/* Comparativo de Vídeos — admin only */}
            {isAdmin && (
              <button style={{ ...s.card, ...s.cardPurple }} onClick={() => onNavigate('comparison')}>
                <div style={s.cardIcon}>⚖️</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Comparativo de Vídeos</div>
                  <div style={s.cardSub}>Compare dois vídeos lado a lado</div>
                </div>
                <div style={{ ...s.badge, ...s.badgePurple }}>sincronizado</div>
              </button>
            )}

            {/* Histórico — admin only */}
            {isAdmin && (
              <button style={{ ...s.card, ...s.cardGray }} onClick={() => onNavigate('history')}>
                <div style={s.cardIcon}>📂</div>
                <div style={s.cardBody}>
                  <div style={s.cardTitle}>Histórico</div>
                  <div style={s.cardSub}>Veja os vídeos e áudios salvos</div>
                </div>
              </button>
            )}

          </div>

          {/* Footer */}
          <div style={s.footer}>
            <span style={s.footerText}>
              {saveMode === 'drive' ? '☁️ Google Drive' : '📱 Armazenamento local'}
            </span>
            
              href="https://www.instagram.com/jogartenisto/"
              target="_blank"
              rel="noopener noreferrer"
              style={s.instaLink}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig2)" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4.5" stroke="url(#ig2)" strokeWidth="2"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig2)"/>
                <defs>
                  <linearGradient id="ig2" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f56040"/>
                    <stop offset="0.5" stopColor="#c13584"/>
                    <stop offset="1" stopColor="#405de6"/>
                  </linearGradient>
                </defs>
              </svg>
              @jogartenisto
            </a>
          </div>

        </div>
      </div>
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
    background: '#0d0d1a',
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url(/carlao-atual.jpg)',
    backgroundPosition: 'center center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    opacity: 0.14,
    pointerEvents: 'none',
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(13,13,26,0.5) 0%, rgba(13,13,26,0.9) 55%, rgba(13,13,26,0.98) 100%)',
    pointerEvents: 'none',
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
    padding: '0 16px 36px',
    gap: 14,
    maxWidth: 520,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  greeting: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.15,
    letterSpacing: -0.5,
  },
  greetingName: { color: '#4fc3f7' },
  appName: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: 700,
    margin: 0,
    letterSpacing: 0.2,
  },
  sairBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#cce0ff',
    padding: '9px 16px',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 40,
    flexShrink: 0,
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    minHeight: 88,
    padding: '14px 16px',
    borderRadius: 18,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    position: 'relative',
    fontFamily: 'system-ui, sans-serif',
  },
  cardGreen:    { background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', boxShadow: '0 4px 20px rgba(46,125,50,0.35)' },
  cardRed:      { background: 'linear-gradient(135deg, #b71c1c 0%, #e53935 100%)', boxShadow: '0 4px 20px rgba(229,57,53,0.32)' },
  cardTeal:     { background: 'linear-gradient(135deg, #006064 0%, #00838f 100%)', boxShadow: '0 4px 20px rgba(0,131,143,0.28)' },
  cardPurple:   { background: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 100%)', boxShadow: '0 4px 20px rgba(123,31,162,0.28)' },
  cardGradient: { background: 'linear-gradient(135deg, #880e4f 0%, #c2185b 50%, #7b1fa2 100%)', boxShadow: '0 4px 20px rgba(194,24,91,0.28)' },
  cardGray:     { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' },
  cardIcon:  { fontSize: 28, lineHeight: 1, flexShrink: 0 },
  cardBody:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.3 },
  cardSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.4 },
  badge: {
    position: 'absolute', top: 9, right: 12,
    fontSize: 10, fontWeight: 700, padding: '3px 8px',
    borderRadius: 20, letterSpacing: 0.3, whiteSpace: 'nowrap', textTransform: 'uppercase',
  },
  badgeGreen:  { background: 'rgba(0,0,0,0.25)', color: '#c8e6c9' },
  badgeRed:    { background: 'rgba(255,255,255,0.2)', color: '#fff' },
  badgeTeal:   { background: 'rgba(0,0,0,0.25)', color: '#b2ebf2' },
  badgePurple: { background: 'rgba(0,0,0,0.25)', color: '#e1bee7' },
  badgePink:   { background: 'rgba(0,0,0,0.25)', color: '#f8bbd0' },
  footer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 },
  footerText: { color: 'rgba(255,255,255,0.28)', fontSize: 11 },
  instaLink: {
    display: 'flex', alignItems: 'center', gap: 5,
    color: 'rgba(255,255,255,0.45)', fontSize: 12,
    textDecoration: 'none', fontWeight: 600, letterSpacing: 0.3,
  },
};
