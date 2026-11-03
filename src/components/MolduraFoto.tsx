// =============================================================================
// MOLDURA FOTO — aplica o rodapé de patrocinadores numa foto escolhida
// Tudo no aparelho (canvas): escolhe a foto, escolhe o formato, gera o JPG e
// compartilha (WhatsApp/Instagram) ou baixa.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';

// Ordem do rodapé: Pro Engenharia sempre no meio, todos do mesmo tamanho
const LOGOS = [
  { src: '/patrocinadores/marinho-terraplenagem-logo.jpg', nome: ['MARINHO', 'TERRAPLENAGEM'] },
  { src: '/patrocinadores/bola-na-rede-logo.jpg',          nome: ['BOLA NA REDE', 'SPORTS'] },
  { src: '/patrocinadores/pro-engenharia-logo.jpg',        nome: ['PRO', 'ENGENHARIA'] },
  { src: '/patrocinadores/primavera-modas-logo.jpg',       nome: ['PRIMAVERA', 'MODAS'] },
  { src: '/patrocinadores/dama-advogados-logo.jpg',        nome: ['DAMA', 'ADVOGADOS'] },
];

type Formato = 'original' | 'feed' | 'story';
const FORMATOS: { id: Formato; label: string }[] = [
  { id: 'original', label: 'Sem cortar' },
  { id: 'feed',     label: 'Feed 4:5' },
  { id: 'story',    label: 'Story 9:16' },
];

const FONTE = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    img.src = src;
  });
}

function tamanhoSaida(img: HTMLImageElement, formato: Formato) {
  if (formato === 'feed')  return { W: 1440, H: 1800 };
  if (formato === 'story') return { W: 1440, H: 2560 };
  const lado = Math.max(img.naturalWidth, img.naturalHeight);
  const k = Math.min(1, 2400 / lado);
  return { W: Math.round(img.naturalWidth * k), H: Math.round(img.naturalHeight * k) };
}

function espacamento(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${px}px`;
}

async function gerarMoldura(foto: HTMLImageElement, logos: HTMLImageElement[], formato: Formato) {
  const { W, H } = tamanhoSaida(foto, formato);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Foto preenchendo o quadro; recorte vertical puxado p/ cima (preserva rostos)
  const esc = Math.max(W / foto.naturalWidth, H / foto.naturalHeight);
  const fw = foto.naturalWidth * esc, fh = foto.naturalHeight * esc;
  ctx.drawImage(foto, (W - fw) / 2, (H - fh) * 0.25, fw, fh);

  // Escala do rodapé: desenhado em base 1080 e ajustado ao menor lado
  const s = Math.min(W, H) / 1080;

  const grad = ctx.createLinearGradient(0, H - 450 * s, 0, H);
  grad.addColorStop(0,    'rgba(6,14,32,0)');
  grad.addColorStop(0.32, 'rgba(6,14,32,0.62)');
  grad.addColorStop(0.62, 'rgba(6,14,32,0.9)');
  grad.addColorStop(1,    'rgba(6,14,32,0.96)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 450 * s, W, 450 * s);

  const r  = 60 * s;              // raio dos logos
  const dx = 172 * s;             // distância entre centros
  const cy = H - 176 * s;         // centro vertical dos logos
  const cx0 = W / 2 - dx * (logos.length - 1) / 2;

  // Título
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8e64a';
  ctx.font = `800 ${22 * s}px ${FONTE}`;
  espacamento(ctx, 6 * s);
  const tituloY = cy - r - 34 * s;
  ctx.fillText('PATROCÍNIO', W / 2, tituloY);
  espacamento(ctx, 0);
  ctx.strokeStyle = 'rgba(216,230,74,0.55)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 230 * s, tituloY); ctx.lineTo(W / 2 - 110 * s, tituloY);
  ctx.moveTo(W / 2 + 110 * s, tituloY); ctx.lineTo(W / 2 + 230 * s, tituloY);
  ctx.stroke();

  logos.forEach((logo, i) => {
    const cx = cx0 + dx * i;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14 * s;
    ctx.shadowOffsetY = 4 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const lado = Math.min(logo.naturalWidth, logo.naturalHeight);
    ctx.drawImage(logo,
      (logo.naturalWidth - lado) / 2, (logo.naturalHeight - lado) / 2, lado, lado,
      cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 4 * s;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `700 ${16 * s}px ${FONTE}`;
    espacamento(ctx, 0.6 * s);
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 3 * s;
    LOGOS[i].nome.forEach((linha, j) => {
      ctx.fillText(linha, cx, cy + r + 22 * s + j * 20 * s);
    });
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  });

  // Crédito
  ctx.font = `600 ${17 * s}px ${FONTE}`;
  espacamento(ctx, 1 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('TÊNIS COACH COM CARLÃO  •  @jogartenisto  •  tecnologia SUP-IA', W / 2, H - 34 * s);
  espacamento(ctx, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/jpeg', 0.92);
  });
}

export default function MolduraFoto() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto]         = useState<HTMLImageElement | null>(null);
  const [formato, setFormato]   = useState<Formato>('original');
  const [resultado, setResultado] = useState<{ blob: Blob; url: string } | null>(null);
  const [gerando, setGerando]   = useState(false);
  const [msg, setMsg]           = useState('');

  // Regera a prévia sempre que muda a foto ou o formato
  useEffect(() => {
    if (!foto) return;
    let cancelado = false;
    setGerando(true);
    setMsg('');
    Promise.all(LOGOS.map(l => carregarImagem(l.src)))
      .then(logos => gerarMoldura(foto, logos, formato))
      .then(blob => {
        if (cancelado) return;
        setResultado(ant => {
          if (ant) URL.revokeObjectURL(ant.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      })
      .catch(e => !cancelado && setMsg(e.message || 'Não foi possível gerar a foto.'))
      .finally(() => !cancelado && setGerando(false));
    return () => { cancelado = true; };
  }, [foto, formato]);

  useEffect(() => () => { if (resultado) URL.revokeObjectURL(resultado.url); }, [resultado]);

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    const url = URL.createObjectURL(arq);
    try {
      setFoto(await carregarImagem(url));
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function nomeArquivo() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `tenis-coach-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
  }

  function baixar() {
    if (!resultado) return;
    const a = document.createElement('a');
    a.href = resultado.url;
    a.download = nomeArquivo();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function compartilhar() {
    if (!resultado) return;
    const arquivo = new File([resultado.blob], nomeArquivo(), { type: 'image/jpeg' });
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (nav.share && nav.canShare?.({ files: [arquivo] })) {
      try {
        await nav.share({ files: [arquivo] });
      } catch (e: any) {
        if (e?.name !== 'AbortError') baixar();
      }
    } else {
      baixar();
    }
  }

  return (
    <div style={st.wrap}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={escolherFoto} />

      <div style={st.formatos}>
        {FORMATOS.map(f => (
          <button
            key={f.id}
            type="button"
            style={{ ...st.formatoBtn, ...(formato === f.id ? st.formatoAtivo : null) }}
            onClick={() => setFormato(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {resultado ? (
        <img src={resultado.url} alt="Foto com a moldura dos patrocinadores" style={{ ...st.previa, opacity: gerando ? 0.5 : 1 }} />
      ) : (
        <button type="button" style={st.vazio} onClick={() => inputRef.current?.click()}>
          <span style={{ fontSize: 34 }}>📷</span>
          <strong>{gerando ? 'Gerando…' : 'Escolher foto'}</strong>
          <span>Da galeria ou tirar na hora</span>
        </button>
      )}

      {msg && <div style={st.msg}>{msg}</div>}

      {resultado && (
        <>
          <button type="button" style={{ ...st.btnPrim, opacity: gerando ? 0.6 : 1 }} disabled={gerando} onClick={compartilhar}>
            Compartilhar
          </button>
          <div style={st.linha}>
            <button type="button" style={st.btnSec} disabled={gerando} onClick={baixar}>Baixar</button>
            <button type="button" style={st.btnSec} onClick={() => inputRef.current?.click()}>Outra foto</button>
          </div>
        </>
      )}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  formatos: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  formatoBtn: {
    border: '1px solid rgba(130,82,62,0.10)',
    background: '#fff',
    color: '#8f7769',
    borderRadius: 999,
    padding: '9px 6px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  formatoAtivo: { background: '#c66b4d', color: '#fff', borderColor: '#c66b4d' },
  vazio: {
    minHeight: 240,
    borderRadius: 18,
    border: '2px dashed rgba(198,107,77,0.35)',
    background: '#fff',
    color: '#8f7769',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  previa: {
    width: '100%',
    maxHeight: '55vh',
    objectFit: 'contain',
    borderRadius: 14,
    background: '#1b1b1b',
    boxShadow: '0 10px 26px rgba(123,72,52,0.12)',
    transition: 'opacity .2s',
  },
  msg: { color: '#b0412e', fontSize: 13, fontWeight: 700, textAlign: 'center' },
  btnPrim: {
    width: '100%',
    padding: 15,
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
    fontFamily: 'inherit',
  },
  linha: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  btnSec: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(130,82,62,0.15)',
    background: '#fff',
    color: '#934836',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
