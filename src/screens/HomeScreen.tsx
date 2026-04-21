// =============================================================================
// HOME SCREEN — Hub principal pós-login
// =============================================================================

import React from 'react';
import type { SaveMode } from '../App';
import type { Screen } from '../App';

interface Props {
  saveMode: SaveMode;
  username: string;
  onLogout: () => void;
  onNavigate: (screen: Screen) => void;
}

export default function HomeScreen({ saveMode, username, onLogout, onNavigate }: Props) {
  const displayName = username || 'Professor';

  return (
    <div style={s.page}>
      {/* Background */}
      <div style={s.bgImage} />
      <div style={s.bgOverlay} />

      {/* Content */}
      <div style={s.content}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.greeting}>Olá, {displayName}</h2>
            <p style={s.appName}>Tenis Coach Com Carlos</p>
          </div>
          <button onClick={onLogout} style={s.sairBtn}>Sair</button>
        </div>

        {/* Cards */}
        <div style={s.cardList}>

          {/* Card 1 — Câmera */}
          <button style={{ ...s.card, ...s.cardRed }} onClick={() => onNavigate('camera')}>
            <div style={s.cardIcon}>🎬</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Câmera</div>
              <div style={s.cardSub}>
                Grave e salve os últimos segundos do treino
              </div>
            </div>
            <div style={{ ...s.badge, ...s.badgeRed }}>principal</div>
          </button>

          {/* Card 2 — Análise Biomecânica */}
          <button style={{ ...s.card, ...s.cardTeal }} onClick={() => onNavigate('biomechanics')}>
            <div style={s.cardIcon}>🦴</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Análise Biomecânica</div>
              <div style={s.cardSub}>
                Detecte ângulos de cotovelo, joelho e quadril via IA
              </div>
            </div>
            <div style={{ ...s.badge, ...s.badgeTeal }}>sem custo de servidor</div>
          </button>

          {/* Card 3 — Comparativo de Vídeos */}
          <button style={{ ...s.card, ...s.cardPurple }} onClick={() => onNavigate('comparison')}>
            <div style={s.cardIcon}>⚖️</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Comparativo de Vídeos</div>
              <div style={s.cardSub}>
                Compare dois vídeos lado a lado em sincronia
              </div>
            </div>
            <div style={{ ...s.badge, ...s.badgePurple }}>draw tools + narração</div>
          </button>

          {/* Card 4 — Instagram Reels */}
          <button style={{ ...s.card, ...s.cardGradient }} onClick={() => onNavigate('instagram')}>
            <div style={s.cardIcon}>📱</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Instagram Reels</div>
              <div style={s.cardSub}>
                Recorte horizontal → 9:16 vertical para Stories/Reels
              </div>
            </div>
            <div style={{ ...s.badge, ...s.badgePink }}>processamento local</div>
          </button>

          {/* Card 5 — Mural de Treinos */}
          <button style={{ ...s.card, ...s.cardGreen }} onClick={() => onNavigate('mural')}>
            <div style={s.cardIcon}>🎾</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Mural de Treinos</div>
              <div style={s.cardSub}>
                Encontre um parceiro para treinar em Teófilo Otoni
              </div>
            </div>
            <div style={{ ...s.badge, ...s.badgeGreen }}>novo</div>
          </button>

          {/* Card Histórico */}
          <button style={{ ...s.card, ...s.cardGray }} onClick={() => onNavigate('history')}>
            <div style={s.cardIcon}>📂</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Histórico</div>
              <div style={s.cardSub}>Veja os vídeos e áudios salvos</div>
            </div>
          </button>

        </div>

        {/* Footer mode indicator */}
        <div style={s.footer}>
          <span style={s.footerText}>
            {saveMode === 'drive' ? '☁️ Salvando no Google Drive' : '📱 Salvando no celular'}
          </span>
          <a
            href="https://www.instagram.com/jogartenisto/"
            target="_blank"
            rel="noopener noreferrer"
            style={s.instaLink}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig)" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4.5" stroke="url(#ig)" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig)"/>
              <defs>
                <linearGradient id="ig" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
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
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative',
    minHeight: '100dvh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: '#0d0d1a',
  },
  bgImage: {
    position: 'fixed',
    inset: 0,
    backgroundImage: 'url(/carlao-atual.jpg)',
    backgroundPosition: 'center center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    opacity: 0.18,
  },
  bgOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(13,13,26,0.6) 0%, rgba(13,13,26,0.92) 60%, rgba(13,13,26,0.98) 100%)',
  },
  content: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 16px 32px',
    gap: 16,
    maxWidth: 520,
    width: '100%',
    margin: '0 auto',
    paddingTop: 'max(24px, env(safe-area-inset-top, 24px))',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  greeting: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.2,
    letterSpacing: -0.5,
  },
  appName: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    margin: '4px 0 0',
    letterSpacing: 0.3,
  },
  sairBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#cce0ff',
    padding: '10px 18px',
    borderRadius: 16,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 44,
    flexShrink: 0,
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    minHeight: 112,
    padding: '18px 20px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    position: 'relative',
    transition: 'opacity .15s, transform .15s',
  },
  cardRed: {
    background: 'linear-gradient(135deg, #b71c1c 0%, #e53935 100%)',
    boxShadow: '0 4px 24px rgba(229,57,53,0.35)',
  },
  cardTeal: {
    background: 'linear-gradient(135deg, #006064 0%, #00838f 100%)',
    boxShadow: '0 4px 24px rgba(0,131,143,0.3)',
  },
  cardPurple: {
    background: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 100%)',
    boxShadow: '0 4px 24px rgba(123,31,162,0.3)',
  },
  cardGradient: {
    background: 'linear-gradient(135deg, #880e4f 0%, #c2185b 50%, #7b1fa2 100%)',
    boxShadow: '0 4px 24px rgba(194,24,91,0.3)',
  },
  cardGray: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: 'none',
  },
  cardIcon: {
    fontSize: 32,
    lineHeight: 1,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: -0.3,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 14,
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 20,
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
  },
  cardGreen: {
    background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
    boxShadow: '0 4px 24px rgba(46,125,50,0.35)',
  },
  badgeRed:    { background: 'rgba(255,255,255,0.22)', color: '#fff' },
  badgeTeal:   { background: 'rgba(0,0,0,0.25)', color: '#b2ebf2' },
  badgePurple: { background: 'rgba(0,0,0,0.25)', color: '#e1bee7' },
  badgePink:   { background: 'rgba(0,0,0,0.25)', color: '#f8bbd0' },
  badgeGreen:  { background: 'rgba(0,0,0,0.25)', color: '#c8e6c9' },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  footerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
  instaLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textDecoration: 'none',
    fontWeight: 600,
    letterSpacing: 0.3,
  },
};
