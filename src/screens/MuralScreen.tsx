// =============================================================================
// MuralScreen — Mural de Treinos (Encontrar Parceiro de Treino)
// TODO: substituir MOCK_JOGOS + publicarJogo() por chamadas reais à API quando
//       o backend de jogos estiver pronto (POST /jogos, GET /jogos)
// =============================================================================

import React, { useState } from 'react';

interface Props {
  onBack: () => void;
  emailUsuario: string; // e-mail do usuário logado (para identificar publicações futuras)
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Jogo {
  id:        string;
  classe:    string;
  data:      string; // formato ISO yyyy-mm-dd
  horario:   string; // HH:MM
  local:     string;
  whatsapp:  string; // só dígitos, ex: 33999990001
  publicadoEm: number; // Date.now()
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CLASSES = ['Iniciante', 'Classe 5', 'Classe 4', 'Classe 3', 'Classe 2', 'Classe 1'];

const LOCAIS = [
  'Arena Bar (Prof. Carlos)',
  'Automóvel Clube (ACTO)',
  'Quadra Pública',
  'Condomínio',
  'Outro',
];

// ---------------------------------------------------------------------------
// Mock data — simula parceiros já publicados em Teófilo Otoni
// TODO: remover MOCK_JOGOS e buscar do backend quando a API /jogos estiver pronta
// ---------------------------------------------------------------------------
const MOCK_JOGOS: Jogo[] = [
  {
    id: 'mock-1',
    classe: 'Classe 3',
    data: '2026-04-28',
    horario: '08:00',
    local: 'Arena Bar (Prof. Carlos)',
    whatsapp: '33999990001',
    publicadoEm: Date.now() - 1000 * 60 * 40,
  },
  {
    id: 'mock-2',
    classe: 'Iniciante',
    data: '2026-04-30',
    horario: '18:30',
    local: 'Automóvel Clube (ACTO)',
    whatsapp: '33999990002',
    publicadoEm: Date.now() - 1000 * 60 * 90,
  },
  {
    id: 'mock-3',
    classe: 'Classe 4',
    data: '2026-05-02',
    horario: '07:00',
    local: 'Quadra Pública',
    whatsapp: '33999990003',
    publicadoEm: Date.now() - 1000 * 60 * 180,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildWhatsAppUrl(jogo: Jogo): string {
  const numero = `55${jogo.whatsapp.replace(/\D/g, '')}`;
  const msg = encodeURIComponent(
    `Olá! Vi sua publicação no Mural de Treinos do app do Prof. Carlos. ` +
    `Quero treinar com você! ${jogo.classe} no ${jogo.local}, ` +
    `dia ${fmtData(jogo.data)} às ${jogo.horario}. Bora marcar?`
  );
  return `https://wa.me/${numero}?text=${msg}`;
}

function tempoRelativo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1)   return 'agora mesmo';
  if (diff < 60)  return `há ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24)     return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function MuralScreen({ onBack }: Props) {
  // Feed começa com os mocks — novas publicações são inseridas no topo
  const [jogos, setJogos]         = useState<Jogo[]>(MOCK_JOGOS);
  const [classe, setClasse]       = useState('Iniciante');
  const [data, setData]           = useState('');
  const [horario, setHorario]     = useState('');
  const [local, setLocal]         = useState(LOCAIS[0]);
  const [whatsapp, setWhatsapp]   = useState('');
  const [erro, setErro]           = useState('');
  const [sucesso, setSucesso]     = useState(false);

  const handlePublicar = () => {
    setErro('');
    if (!data)    { setErro('Escolha a data do treino.'); return; }
    if (!horario) { setErro('Informe o horário.'); return; }
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) { setErro('WhatsApp inválido. Use (XX) XXXXX-XXXX.'); return; }

    // TODO: substituir por POST /jogos quando o backend estiver pronto
    const novoJogo: Jogo = {
      id: `local-${Date.now()}`,
      classe,
      data,
      horario,
      local,
      whatsapp: digits,
      publicadoEm: Date.now(),
    };
    setJogos(prev => [novoJogo, ...prev]);
    setSucesso(true);
    // Reset form
    setData(''); setHorario(''); setWhatsapp('');
    setTimeout(() => setSucesso(false), 3000);
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <span style={s.headerTitle}>Mural de Treinos</span>
        <span style={s.headerSpacer} />
      </div>

      <div style={s.body}>

        {/* ── Seção A: Formulário ─────────────────────────────────────── */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>📢 Publicar Desafio</h2>
          <p style={s.sectionSub}>Encontre um parceiro para treinar</p>

          <div style={s.form}>
            {/* Classe */}
            <label style={s.label}>Sua Classe</label>
            <select value={classe} onChange={e => setClasse(e.target.value)} style={s.select}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Data + Horário */}
            <div style={s.row}>
              <div style={s.col}>
                <label style={s.label}>Data do Treino</label>
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  style={s.input}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div style={s.col}>
                <label style={s.label}>Horário</label>
                <input
                  type="time"
                  value={horario}
                  onChange={e => setHorario(e.target.value)}
                  style={s.input}
                />
              </div>
            </div>

            {/* Local */}
            <label style={s.label}>Local</label>
            <select value={local} onChange={e => setLocal(e.target.value)} style={s.select}>
              {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* WhatsApp */}
            <label style={s.label}>Seu WhatsApp</label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="(33) 99999-0000"
              value={whatsapp}
              onChange={e => setWhatsapp(maskPhone(e.target.value))}
              style={s.input}
            />

            {erro    && <p style={s.erro}>{erro}</p>}
            {sucesso && <p style={s.ok}>✅ Publicado com sucesso!</p>}

            <button onClick={handlePublicar} style={s.publishBtn}>
              📢 Publicar Desafio
            </button>
          </div>
        </section>

        {/* ── Seção B: Feed ───────────────────────────────────────────── */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>🎾 Parceiros Disponíveis</h2>
          <p style={s.sectionSub}>{jogos.length} {jogos.length === 1 ? 'publicação' : 'publicações'} em Teófilo Otoni</p>

          <div style={s.feed}>
            {jogos.map(jogo => (
              <JogoCard key={jogo.id} jogo={jogo} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de jogo
// ---------------------------------------------------------------------------

function JogoCard({ jogo }: { jogo: Jogo }) {
  const url = buildWhatsAppUrl(jogo);

  return (
    <div style={sc.card}>
      {/* Cabeçalho do card */}
      <div style={sc.cardHeader}>
        <span style={sc.classeBadge}>{jogo.classe}</span>
        <span style={sc.tempo}>{tempoRelativo(jogo.publicadoEm)}</span>
      </div>

      {/* Informações */}
      <div style={sc.infoGrid}>
        <div style={sc.infoItem}>
          <span style={sc.infoIcon}>📅</span>
          <span style={sc.infoText}>{fmtData(jogo.data)}</span>
        </div>
        <div style={sc.infoItem}>
          <span style={sc.infoIcon}>🕐</span>
          <span style={sc.infoText}>{jogo.horario}</span>
        </div>
        <div style={{ ...sc.infoItem, gridColumn: '1 / -1' }}>
          <span style={sc.infoIcon}>📍</span>
          <span style={sc.infoText}>{jogo.local}</span>
        </div>
      </div>

      {/* Botão WhatsApp */}
      <a href={url} target="_blank" rel="noopener noreferrer" style={sc.waBtn}>
        <WaIcon />
        Chamar no WhatsApp
      </a>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: '#0d0d1a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    gap: 12,
    background: 'rgba(0,0,0,0.4)',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#cce0ff',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  headerSpacer: { width: 80, flexShrink: 0 },

  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    maxWidth: 540,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: -0.3,
  },
  sectionSub: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '20px 16px',
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 15,
    boxSizing: 'border-box',
    colorScheme: 'dark',
  },
  select: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 15,
    appearance: 'auto',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: 10 },
  col: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },

  erro: { color: '#ff6b6b', fontSize: 13, margin: '4px 0 0', fontWeight: 600 },
  ok:   { color: '#aef359', fontSize: 13, margin: '4px 0 0', fontWeight: 600 },

  publishBtn: {
    marginTop: 6,
    padding: '16px 20px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(46,125,50,0.4)',
    letterSpacing: 0.2,
  },

  feed: { display: 'flex', flexDirection: 'column', gap: 14 },
};

const sc: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classeBadge: {
    background: 'rgba(79,195,247,0.18)',
    border: '1px solid rgba(79,195,247,0.4)',
    color: '#4fc3f7',
    fontSize: 13,
    fontWeight: 800,
    padding: '5px 14px',
    borderRadius: 20,
    letterSpacing: 0.3,
  },
  tempo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 12px',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  infoIcon: {
    fontSize: 16,
    flexShrink: 0,
  },
  infoText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  },
  waBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '14px 20px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 4px 16px rgba(46,125,50,0.35)',
    letterSpacing: 0.2,
  },
};
