// =============================================================================
// MuralScreen — Mural de Treinos (Encontrar Parceiro de Treino)
// TODO: substituir MOCK_JOGOS + handlePublicar por chamadas reais à API quando
//       o backend de jogos estiver pronto (POST /jogos, GET /jogos)
// =============================================================================

import React, { useState } from 'react';

interface Props {
  onBack: () => void;
  emailUsuario: string;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Jogo {
  id:            string;
  classe:        string;
  dataInicio:    string;   // yyyy-mm-dd
  dataFim?:      string;   // yyyy-mm-dd — undefined = dia único
  horarioInicio: string;   // HH:MM
  horarioFim:    string;   // HH:MM
  local:         string;
  whatsapp:      string;   // só dígitos
  publicadoEm:   number;
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

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------------------------------------------------------------------------
// Mock data — parceiros simulados em Teófilo Otoni
// TODO: remover e buscar do backend quando GET /jogos estiver pronto
// ---------------------------------------------------------------------------
const MOCK_JOGOS: Jogo[] = [
  {
    id: 'mock-1', classe: 'Classe 3',
    dataInicio: '2026-04-24', dataFim: '2026-04-25',
    horarioInicio: '16:00', horarioFim: '18:00',
    local: 'Arena Bar (Prof. Carlos)', whatsapp: '33999990001',
    publicadoEm: Date.now() - 1000 * 60 * 40,
  },
  {
    id: 'mock-2', classe: 'Iniciante',
    dataInicio: '2026-04-26',
    horarioInicio: '08:00', horarioFim: '10:00',
    local: 'Automóvel Clube (ACTO)', whatsapp: '33999990002',
    publicadoEm: Date.now() - 1000 * 60 * 90,
  },
  {
    id: 'mock-3', classe: 'Classe 4',
    dataInicio: '2026-04-25', dataFim: '2026-04-26',
    horarioInicio: '07:00', horarioFim: '09:00',
    local: 'Quadra Pública', whatsapp: '33999990003',
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
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[date.getDay()]} ${d}/${m}`;
}

function fmtDataRange(jogo: Jogo): string {
  if (!jogo.dataFim || jogo.dataFim === jogo.dataInicio) {
    return fmtData(jogo.dataInicio);
  }
  return `${fmtData(jogo.dataInicio)} – ${fmtData(jogo.dataFim)}`;
}

function buildWhatsAppUrl(jogo: Jogo): string {
  const numero = `55${jogo.whatsapp.replace(/\D/g, '')}`;
  const dataStr = !jogo.dataFim || jogo.dataFim === jogo.dataInicio
    ? fmtData(jogo.dataInicio)
    : `${fmtData(jogo.dataInicio)} a ${fmtData(jogo.dataFim)}`;
  const msg = encodeURIComponent(
    `Olá! Vi sua publicação no Mural de Treinos do Prof. Carlos. ` +
    `Quero treinar com você! ${jogo.classe} no ${jogo.local}, ` +
    `${dataStr} das ${jogo.horarioInicio.replace(':', 'h')} às ${jogo.horarioFim.replace(':', 'h')}. Bora?`
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

function classeColor(classe: string): string {
  const map: Record<string, string> = {
    'Iniciante': '#4fc3f7',
    'Classe 5':  '#81c784',
    'Classe 4':  '#aef359',
    'Classe 3':  '#ffb74d',
    'Classe 2':  '#ff8a65',
    'Classe 1':  '#ef5350',
  };
  return map[classe] ?? '#fff';
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function MuralScreen({ onBack }: Props) {
  const [jogos, setJogos]               = useState<Jogo[]>(MOCK_JOGOS);

  // Form state
  const [formAberto, setFormAberto]     = useState(true); // inicia expandido
  const [classe, setClasse]             = useState('Iniciante');
  const [janelaData, setJanelaData]     = useState(false); // false = dia único
  const [dataInicio, setDataInicio]     = useState('');
  const [dataFim, setDataFim]           = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim]     = useState('');
  const [local, setLocal]               = useState(LOCAIS[0]);
  const [whatsapp, setWhatsapp]         = useState('');
  const [erro, setErro]                 = useState('');
  const [sucesso, setSucesso]           = useState(false);

  const hoje = new Date().toISOString().split('T')[0];

  const handlePublicar = () => {
    setErro('');
    if (!dataInicio) { setErro('Escolha a data de início.'); return; }
    if (janelaData && !dataFim) { setErro('Escolha a data final.'); return; }
    if (janelaData && dataFim < dataInicio) { setErro('Data final deve ser após a inicial.'); return; }
    if (!horarioInicio) { setErro('Informe o horário de início.'); return; }
    if (!horarioFim)    { setErro('Informe o horário final.'); return; }
    if (horarioFim <= horarioInicio) { setErro('Horário final deve ser após o inicial.'); return; }
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) { setErro('WhatsApp inválido. Ex: (33) 99999-0000.'); return; }

    // TODO: substituir por POST /jogos quando o backend estiver pronto
    const novo: Jogo = {
      id: `local-${Date.now()}`,
      classe, dataInicio,
      dataFim: janelaData ? dataFim : undefined,
      horarioInicio, horarioFim,
      local, whatsapp: digits,
      publicadoEm: Date.now(),
    };
    setJogos(prev => [novo, ...prev]);
    setSucesso(true);
    setDataInicio(''); setDataFim(''); setHorarioInicio(''); setHorarioFim(''); setWhatsapp('');
    setTimeout(() => setSucesso(false), 3000);
  };

  return (
    // Scroll fix iOS: position:fixed + overflow:hidden no pai, overflow-y:auto + WebkitOverflowScrolling no filho
    <div style={s.page}>

      {/* Header fixo */}
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <span style={s.headerTitle}>Mural de Treinos</span>
        <span style={s.headerSpacer} />
      </div>

      {/* Corpo rolável */}
      <div style={s.scrollBody}>
        <div style={s.inner}>

          {/* ── Seção A: Formulário ─────────────────────────────── */}
          <section style={s.section}>
            <div style={s.sectionHead}>
              <span style={s.sectionIcon}>📢</span>
              <div style={{ flex: 1 }}>
                <h2 style={s.sectionTitle}>Publicar Disponibilidade</h2>
                <p style={s.sectionSub}>Encontre um parceiro para treinar</p>
              </div>
              <button onClick={() => setFormAberto(v => !v)} style={s.minimizeBtn}>
                {formAberto ? '▲ Minimizar' : '▼ Abrir'}
              </button>
            </div>

            {formAberto && <div style={s.formCard}>

              {/* Classe */}
              <FieldGroup label="Sua Classe">
                <select value={classe} onChange={e => setClasse(e.target.value)} style={s.select}>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FieldGroup>

              {/* Modo de data */}
              <FieldGroup label="Disponibilidade de dias">
                <div style={s.modeToggle}>
                  <button
                    style={{ ...s.modeBtn, ...(janelaData ? {} : s.modeBtnActive) }}
                    onClick={() => setJanelaData(false)}
                  >
                    Dia único
                  </button>
                  <button
                    style={{ ...s.modeBtn, ...(janelaData ? s.modeBtnActive : {}) }}
                    onClick={() => setJanelaData(true)}
                  >
                    Janela de dias
                  </button>
                </div>
              </FieldGroup>

              {/* Datas */}
              <div style={s.row}>
                <div style={s.col}>
                  <span style={s.subLabel}>{janelaData ? 'De' : 'Data'}</span>
                  <input type="date" value={dataInicio} min={hoje}
                    onChange={e => setDataInicio(e.target.value)} style={s.input} />
                </div>
                {janelaData && (
                  <div style={s.col}>
                    <span style={s.subLabel}>Até</span>
                    <input type="date" value={dataFim} min={dataInicio || hoje}
                      onChange={e => setDataFim(e.target.value)} style={s.input} />
                  </div>
                )}
              </div>

              {/* Horários — grid garante renderização correta no iOS */}
              <FieldGroup label="Janela de horários">
                <div style={s.timeGrid}>
                  <div style={s.timeCol}>
                    <span style={s.subLabel}>Das</span>
                    <input type="time" value={horarioInicio}
                      onChange={e => setHorarioInicio(e.target.value)} style={s.timeInput} />
                  </div>
                  <div style={s.timeSep}>→</div>
                  <div style={s.timeCol}>
                    <span style={s.subLabel}>Às</span>
                    <input type="time" value={horarioFim}
                      onChange={e => setHorarioFim(e.target.value)} style={s.timeInput} />
                  </div>
                </div>
              </FieldGroup>

              {/* Local */}
              <FieldGroup label="Local">
                <select value={local} onChange={e => setLocal(e.target.value)} style={s.select}>
                  {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FieldGroup>

              {/* WhatsApp */}
              <FieldGroup label="Seu WhatsApp">
                <input
                  type="tel" inputMode="numeric" placeholder="(33) 99999-0000"
                  value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))}
                  style={s.input}
                />
              </FieldGroup>

              {erro    && <p style={s.erro}>{erro}</p>}
              {sucesso && <p style={s.ok}>✅ Publicado! Aguardando parceiro…</p>}

              <button onClick={handlePublicar} style={s.publishBtn}>
                📢 Publicar Disponibilidade
              </button>
            </div>}
          </section>

          {/* ── Seção B: Feed ───────────────────────────────────── */}
          <section style={s.section}>
            <div style={s.sectionHead}>
              <span style={s.sectionIcon}>🎾</span>
              <div>
                <h2 style={s.sectionTitle}>Parceiros Disponíveis</h2>
                <p style={s.sectionSub}>{jogos.length} publicações em Teófilo Otoni</p>
              </div>
            </div>

            <div style={s.feed}>
              {jogos.map(jogo => <JogoCard key={jogo.id} jogo={jogo} />)}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldGroup — label + conteúdo
// ---------------------------------------------------------------------------
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={s.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de jogo
// ---------------------------------------------------------------------------
function JogoCard({ jogo }: { jogo: Jogo }) {
  const cor = classeColor(jogo.classe);
  const url = buildWhatsAppUrl(jogo);

  return (
    <div style={sc.card}>
      {/* Barra lateral colorida */}
      <div style={{ ...sc.accent, background: cor }} />

      <div style={sc.content}>
        {/* Cabeçalho */}
        <div style={sc.cardHeader}>
          <span style={{ ...sc.classeBadge, color: cor, borderColor: `${cor}55`, background: `${cor}18` }}>
            {jogo.classe}
          </span>
          <span style={sc.tempo}>{tempoRelativo(jogo.publicadoEm)}</span>
        </div>

        {/* Infos */}
        <div style={sc.infoGrid}>
          <InfoItem icon="📅" text={fmtDataRange(jogo)} />
          <InfoItem icon="🕐" text={`${jogo.horarioInicio.replace(':', 'h')} – ${jogo.horarioFim.replace(':', 'h')}`} />
          <div style={{ gridColumn: '1 / -1' }}>
            <InfoItem icon="📍" text={jogo.local} />
          </div>
        </div>

        {/* WhatsApp */}
        <a href={url} target="_blank" rel="noopener noreferrer" style={sc.waBtn}>
          <WaIcon />
          Chamar no WhatsApp
        </a>
      </div>
    </div>
  );
}

function InfoItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{text}</span>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Estilos principais
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  // Fix scroll iOS: pai fixo + filho com overflow
  page: {
    position: 'fixed',
    inset: 0,
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
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    flexShrink: 0,
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.22)',
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
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 80, flexShrink: 0 },

  // Área rolável — fix iOS: overflow-y + WebkitOverflowScrolling
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    padding: '24px 16px 48px',
    maxWidth: 540,
    margin: '0 auto',
    boxSizing: 'border-box',
    width: '100%',
  },

  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHead: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionIcon: { fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: -0.3,
  },
  sectionSub: {
    margin: '3px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },

  formCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 22,
    padding: '20px 16px 24px',
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 0.4,
  },

  input: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)',
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
    border: '1px solid rgba(255,255,255,0.13)',
    color: '#fff',
    fontSize: 15,
    appearance: 'auto',
    boxSizing: 'border-box',
    colorScheme: 'dark',
  },

  row: { display: 'flex', gap: 10 },
  col: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  minimizeBtn: {
    flexShrink: 0,
    padding: '8px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-start',
    marginTop: 2,
  },

  // Grid para horários — mais confiável que flex no iOS Safari
  timeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'end',
    gap: '0 10px',
  },
  timeCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  timeSep: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 16,
    fontWeight: 600,
    paddingBottom: 12,
    textAlign: 'center',
  },
  timeInput: {
    width: '100%',
    padding: '13px 10px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)',
    color: '#fff',
    fontSize: 15,
    boxSizing: 'border-box',
    colorScheme: 'dark',
    minWidth: 0,
  },

  modeToggle: {
    display: 'flex',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: 9,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    background: 'rgba(79,195,247,0.2)',
    color: '#4fc3f7',
    boxShadow: 'inset 0 0 0 1px rgba(79,195,247,0.4)',
  },

  erro: { color: '#ff6b6b', fontSize: 13, fontWeight: 600, margin: 0 },
  ok:   { color: '#aef359', fontSize: 13, fontWeight: 600, margin: 0 },

  publishBtn: {
    padding: '16px 20px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #1b5e20, #388e3c)',
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(56,142,60,0.4)',
    letterSpacing: 0.2,
    marginTop: 4,
  },

  feed: { display: 'flex', flexDirection: 'column', gap: 14 },
};

// ---------------------------------------------------------------------------
// Estilos do card
// ---------------------------------------------------------------------------
const sc: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  accent: {
    width: 5,
    flexShrink: 0,
    borderRadius: '0 0 0 0',
  },
  content: {
    flex: 1,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classeBadge: {
    fontSize: 13,
    fontWeight: 800,
    padding: '5px 14px',
    borderRadius: 20,
    border: '1px solid',
    letterSpacing: 0.3,
  },
  tempo: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 12px',
  },
  waBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '13px 18px',
    borderRadius: 13,
    background: 'linear-gradient(135deg, #1b5e20, #388e3c)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 3px 14px rgba(56,142,60,0.35)',
    letterSpacing: 0.2,
    marginTop: 2,
  },
};
