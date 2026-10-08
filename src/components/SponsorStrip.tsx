// =============================================================================
// SPONSOR STRIP — anúncio nativo discreto (estilo "Patrocinado" do Google)
// Um card compacto por vez, rotação automática; toque/"Contato" abre o banner
// completo com as opções de contato do patrocinador.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Sponsor {
  id: string;
  nome: string;
  descricao: string;
  banner: string;
  logo: string;        // miniatura quadrada
  whatsapp?: string;   // só dígitos, com DDI
  site?: string;
  instagram?: string;  // URL completa
}

const SPONSORS: Sponsor[] = [
  {
    id: 'marinho',
    nome: 'Marinho Terraplenagem',
    descricao: 'Apoiando o esporte em Teófilo Otoni',
    banner: '/patrocinadores/marinho-terraplenagem.jpg',
    logo: '/patrocinadores/marinho-terraplenagem-logo.jpg',
    whatsapp: '5533988069938',
  },
  {
    id: 'bola-na-rede',
    nome: 'Bola na Rede Sports',
    descricao: 'Parceira do Tênis Coach',
    banner: '/patrocinadores/bola-na-rede.jpg',
    logo: '/patrocinadores/bola-na-rede-logo.jpg',
    whatsapp: '5533988285777',
    instagram: 'https://www.instagram.com/lojabolanarede/',
  },
  {
    id: 'pro-engenharia',
    nome: 'Pro Engenharia',
    descricao: 'Projetos e construções · desde 1997',
    banner: '/patrocinadores/pro-engenharia.jpg',
    logo: '/patrocinadores/pro-engenharia-logo.jpg',
    whatsapp: '5533997057567',
    site: 'https://proengenharia.srv.br/',
  },
];

const THUMB = 46;
const ROTACAO_MS = 6000;

type Canal = 'whatsapp' | 'site' | 'instagram';

function urlContato(sp: Sponsor, canal: Canal): string {
  if (canal === 'whatsapp')
    return `https://wa.me/${sp.whatsapp}?text=${encodeURIComponent('Olá! Vi vocês no app Tênis Coach com Carlão.')}`;
  return (canal === 'site' ? sp.site : sp.instagram) ?? '';
}

function abrirContato(sp: Sponsor, canal: Canal) {
  window.open(urlContato(sp, canal), '_blank', 'noopener,noreferrer');
}

function temContato(sp: Sponsor): boolean {
  return Boolean(sp.whatsapp || sp.site || sp.instagram);
}

export default function SponsorStrip() {
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState<Sponsor | null>(null);
  const pausadoRef = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (!pausadoRef.current) setAtivo(i => (i + 1) % SPONSORS.length);
    }, ROTACAO_MS);
    return () => window.clearInterval(t);
  }, []);

  const sp = SPONSORS[ativo];

  return (
    <>
      <div
        style={st.wrap}
        onPointerEnter={() => { pausadoRef.current = true; }}
        onPointerLeave={() => { pausadoRef.current = false; }}
      >
        <button type="button" key={sp.id} style={st.card} onClick={() => setAberto(sp)}>
          <img src={sp.logo} alt="" style={st.thumb} />

          <div style={st.info}>
            <strong style={st.nome}>{sp.nome}</strong>
            <div style={st.topLine}>
              <span style={st.badge}>Patrocinado</span>
              <span style={st.desc}>{sp.descricao}</span>
            </div>
          </div>

          {temContato(sp) && <span style={st.cta}>Contato</span>}
        </button>

        <div style={st.dots}>
          {SPONSORS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Ver ${s.nome}`}
              style={{ ...st.dot, ...(i === ativo ? st.dotActive : {}) }}
              onClick={() => setAtivo(i)}
            />
          ))}
        </div>
      </div>

      {aberto && createPortal(
        <div style={st.overlay} onClick={e => e.target === e.currentTarget && setAberto(null)}>
          <div style={st.sheet}>
            <div style={st.sheetHead}>
              <span style={st.badge}>Patrocinado</span>
              <button type="button" style={st.closeBtn} onClick={() => setAberto(null)}>✕</button>
            </div>

            <img src={aberto.banner} alt={aberto.nome} style={st.bannerImg} />

            <div style={st.sheetInfo}>
              <strong>{aberto.nome}</strong>
              <span>{aberto.descricao}</span>
            </div>

            <div style={st.sheetBtns}>
              {aberto.whatsapp && (
                <button type="button" style={st.btnPrimary} onClick={() => abrirContato(aberto, 'whatsapp')}>
                  Falar no WhatsApp
                </button>
              )}
              {aberto.site && (
                <button type="button" style={aberto.whatsapp ? st.btnSecondary : st.btnPrimary} onClick={() => abrirContato(aberto, 'site')}>
                  Visitar site
                </button>
              )}
              {aberto.instagram && (
                <button type="button" style={aberto.whatsapp ? st.btnSecondary : st.btnPrimary} onClick={() => abrirContato(aberto, 'instagram')}>
                  Ver no Instagram
                </button>
              )}
            </div>

            <p style={st.thanks}>Obrigado por apoiar o tênis em Teófilo Otoni.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  card: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px 8px 8px',
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 16,
    boxShadow: '0 6px 18px rgba(117,76,56,0.05)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    animation: 'sponsorFade 0.45s ease',
  },

  thumb: {
    width: THUMB,
    height: THUMB,
    flexShrink: 0,
    borderRadius: 11,
    border: '1px solid rgba(130,82,62,0.10)',
    objectFit: 'cover',
    display: 'block',
  },

  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },

  topLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },

  badge: {
    flexShrink: 0,
    padding: '1px 5px',
    borderRadius: 4,
    border: '1px solid rgba(143,119,105,0.45)',
    color: '#8f7769',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.2,
    lineHeight: '13px',
  },

  nome: {
    color: '#342a24',
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  desc: {
    color: '#8f7769',
    fontSize: 11.5,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  cta: {
    flexShrink: 0,
    padding: '7px 10px',
    borderRadius: 999,
    background: '#fff7ef',
    border: '1px solid rgba(198,107,77,0.22)',
    color: '#a54f3d',
    fontSize: 11,
    fontWeight: 900,
  },

  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
  },

  dot: {
    width: 5,
    height: 5,
    padding: 0,
    border: 'none',
    borderRadius: 999,
    background: 'rgba(143,119,105,0.28)',
    cursor: 'pointer',
    transition: 'width 0.25s ease',
  },

  dotActive: {
    width: 14,
    background: '#c66b4d',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: 'rgba(28,20,16,0.55)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  sheet: {
    width: '100%',
    maxWidth: 480,
    background: '#fbf7f1',
    borderRadius: '24px 24px 0 0',
    padding: '14px 16px calc(18px + env(safe-area-inset-bottom))',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  sheetHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  closeBtn: {
    border: 'none',
    background: '#fff',
    width: 30,
    height: 30,
    borderRadius: '50%',
    color: '#8f7769',
    fontSize: 13,
    cursor: 'pointer',
  },

  bannerImg: {
    width: '100%',
    borderRadius: 14,
    display: 'block',
    boxShadow: '0 10px 26px rgba(70,45,34,0.16)',
  },

  sheetInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    color: '#342a24',
    fontSize: 15,
  },

  sheetBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  btnPrimary: {
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #a54f3d)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  btnSecondary: {
    width: '100%',
    padding: 13,
    borderRadius: 16,
    background: '#fff',
    border: '1px solid rgba(196,94,68,0.28)',
    color: '#a54f3d',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  thanks: {
    margin: 0,
    textAlign: 'center',
    color: '#9b8a7f',
    fontSize: 11.5,
    fontWeight: 600,
  },
};

// Animação de troca entre anunciantes
if (typeof document !== 'undefined' && !document.getElementById('sponsor-strip-anim')) {
  const style = document.createElement('style');
  style.id = 'sponsor-strip-anim';
  style.textContent = '@keyframes sponsorFade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}';
  document.head.appendChild(style);
}
