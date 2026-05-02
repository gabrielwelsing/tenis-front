// =============================================================================
// MuralScreen — Mural de Treinos
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { getJogos, postJogo, deleteJogo, updateJogoDatas, type JogoRecord, type UpdateJogoDatasPayload } from '@services/apiService';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';
const TOKEN_KEY = 'tenis_token';

interface Props {
  onBack:       () => void;
  emailUsuario: string;
  userId:       number;
  username:     string;
  telefone?:    string | null;
  localidade?:  string | null;
}

interface Jogo {
  id:               string;
  cidade:           string;
  classe:           string;
  dataInicio:       string;
  dataFim?:         string | null;
  horarioInicio:    string;
  horarioFim:       string;
  local:            string;
  whatsapp:         string;
  publicadoEm:      number;
  emailPublicador?: string | null;
  nomePublicador?:  string | null;
  fotoPublicador?:  string | null;
  status?:          'aberta' | 'confirmada' | 'encerrada';
  interessados?:    number;
  confirmado_com?:  string | null;
}

interface Interessado {
  email_usuario: string;
  nome_usuario:  string;
  created_at:    string;
}

interface PenalidadeRecord {
  furos:     number;
  banidoAte: number | null;
}

interface Liga {
  id: string;
  nome: string;
  temporada_ativa_id: string | null;
  temporada_ativa_nome: string | null;
}

type FiltroMural = 'todos' | 'hoje' | 'amanha' | 'calendario' | 'meus';

const CLASSES     = ['Iniciante', 'Classe 5', 'Classe 4', 'Classe 3', 'Classe 2', 'Classe 1'];
const LOCAIS      = ['Arena Bar (Prof. Carlos)', 'Automóvel Clube (ACTO)', 'Quadra Pública', 'Condomínio', 'Outro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES       = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const LS_CIDADE           = 'muralCidade';
const LS_PENALIDADES      = 'muralPenalidades';
const LS_FUROS_REPORTADOS = 'muralFurosReportados';

function getPenalidade(email: string): PenalidadeRecord {
  try {
    const data = JSON.parse(localStorage.getItem(LS_PENALIDADES) || '{}');
    return data[email] ?? { furos: 0, banidoAte: null };
  } catch {
    return { furos: 0, banidoAte: null };
  }
}

function salvarPenalidade(email: string, p: PenalidadeRecord): void {
  try {
    const data = JSON.parse(localStorage.getItem(LS_PENALIDADES) || '{}');
    data[email] = p;
    localStorage.setItem(LS_PENALIDADES, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function addFuro(email: string): void {
  const p = getPenalidade(email);
  p.furos++;

  const MES = 30 * 24 * 60 * 60 * 1000;

  if (p.furos >= 7) p.banidoAte = -1;
  else if (p.furos >= 4) p.banidoAte = Date.now() + 2 * MES;
  else if (p.furos >= 3) p.banidoAte = Date.now() + MES;
  else p.banidoAte = null;

  salvarPenalidade(email, p);
}

function getBanStatus(email: string): { banido: boolean; mensagem: string; permanente: boolean } {
  const p = getPenalidade(email);

  if (!p.banidoAte) {
    return { banido: false, mensagem: '', permanente: false };
  }

  if (p.banidoAte === -1) {
    return {
      banido: true,
      permanente: true,
      mensagem: 'Acesso permanentemente suspenso por reincidência de furos.',
    };
  }

  if (Date.now() < p.banidoAte) {
    const dias = Math.ceil((p.banidoAte - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      banido: true,
      permanente: false,
      mensagem: `Publicação suspensa por ${dias} dia(s) — furos repetidos.`,
    };
  }

  return { banido: false, mensagem: '', permanente: false };
}

function getFurosReportados(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_FUROS_REPORTADOS) || '{}');
  } catch {
    return {};
  }
}

function reportarFuro(whatsapp: string, emailAlvo?: string | null): void {
  try {
    const data = getFurosReportados();
    data[whatsapp] = (data[whatsapp] || 0) + 1;
    localStorage.setItem(LS_FUROS_REPORTADOS, JSON.stringify(data));

    if (emailAlvo) addFuro(emailAlvo);
  } catch {
    /* ignore */
  }
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);

  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;

  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function fmtData(iso: string): string {
  const dateOnly = iso.slice(0, 10);
  const dt = new Date(dateOnly + 'T12:00:00');
  const [, m, d] = dateOnly.split('-');

  return `${DIAS_SEMANA[dt.getDay()]}, ${d}/${m}`;
}

function tempoRelativo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 60000);

  if (diff < 1) return 'agora mesmo';
  if (diff < 60) return `há ${diff} min`;

  const h = Math.floor(diff / 60);

  if (h < 24) return `há ${h}h`;

  return `há ${Math.floor(h / 24)}d`;
}

function isExpired(jogo: Jogo): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const endDate = jogo.dataFim || jogo.dataInicio;

  if (endDate < today) return true;

  if (endDate === today) {
    const [h, m] = jogo.horarioFim.split(':').map(Number);
    return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
  }

  return false;
}

function jogoIsOnDate(jogo: Jogo, dateStr: string): boolean {
  return dateStr >= jogo.dataInicio && dateStr <= (jogo.dataFim || jogo.dataInicio);
}

function hojeStr(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function amanhaStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCardDateInfo(dateIso: string) {
  const dt = new Date(`${dateIso}T12:00:00`);
  const today = hojeStr();
  const tomorrow = amanhaStr();

  let label = DIAS_SEMANA[dt.getDay()].toUpperCase();
  if (dateIso === today) label = 'HOJE';
  if (dateIso === tomorrow) label = 'AMANHÃ';

  return {
    label,
    day: String(dt.getDate()).padStart(2, '0'),
    month: MESES[dt.getMonth()].toUpperCase(),
  };
}

function nomeDoPublicador(jogo: Jogo): string {
  return jogo.nomePublicador?.trim()
    || jogo.emailPublicador?.split('@')[0]
    || 'Jogador';
}

function buildWhatsAppUrl(jogo: Jogo): string {
  const numero = `55${jogo.whatsapp.replace(/\D/g, '')}`;
  const dataStr = !jogo.dataFim || jogo.dataFim === jogo.dataInicio
    ? fmtData(jogo.dataInicio)
    : `${fmtData(jogo.dataInicio)} a ${fmtData(jogo.dataFim)}`;

  const msg = encodeURIComponent(
    `Olá! Vi sua publicação no Mural de Treinos do Prof. Carlão. Quero jogar uma partida com você! Sou ${jogo.classe} e tenho disponibilidade de estar no ${jogo.local} (${jogo.cidade}), ${dataStr} entre ${jogo.horarioInicio.replace(':', 'h')} às ${jogo.horarioFim.replace(':', 'h')}. Bora?`
  );

  return `https://wa.me/${numero}?text=${msg}`;
}

async function detectarCidade(): Promise<string> {
  if (!navigator.geolocation) throw new Error('Geolocalização não suportada.');

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'TenisCoachComCarlos/1.0' } }
          );

          const json = await res.json();
          const city = json.address?.city || json.address?.town || json.address?.village || '';

          if (city) resolve(city);
          else reject(new Error('Cidade não identificada.'));
        } catch {
          reject(new Error('Falha ao consultar localização.'));
        }
      },
      () => reject(new Error('Permissão de localização negada.')),
      { timeout: 10000, maximumAge: 300_000 }
    );
  });
}

function CalendarLineIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 4v3.4M16 4v3.4M4.7 10h14.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function ClockLineIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 7.6v4.6l3 1.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinLineIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function UsersLineIcon({ size = 23 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="2.8" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16.8" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.6 18.2c.8-2.8 2.5-4.2 4.4-4.2s3.6 1.4 4.4 4.2M14.4 15.6c1.7.2 2.9 1.1 3.7 2.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function CityPickerModal({ onConfirm, onBack }: { onConfirm: (c: string) => void; onBack: () => void }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleDetectar = async () => {
    setErro('');
    setLoading(true);

    try {
      setInput(await detectarCidade());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = () => {
    const c = input.trim();

    if (!c) {
      setErro('Digite o nome da sua cidade.');
      return;
    }

    onConfirm(c);
  };

  return (
    <div style={cm.overlay}>
      <div style={cm.sheet}>
        <button onClick={onBack} style={cm.backBtn}>← Voltar</button>

        <div style={cm.icon}>📍</div>

        <h2 style={cm.title}>Qual é a sua cidade?</h2>
        <p style={cm.sub}>O mural mostra apenas publicações da sua cidade.</p>

        <button
          onClick={handleDetectar}
          disabled={loading}
          style={{ ...cm.detectBtn, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '🔍 Detectando...' : '📡 Detectar minha localização'}
        </button>

        <p style={cm.ouLabel}>— ou digite manualmente —</p>

        <input
          style={cm.input}
          placeholder="Ex: Teófilo Otoni"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirmar()}
          autoFocus
        />

        {erro && <p style={cm.erro}>{erro}</p>}

        <button onClick={handleConfirmar} style={cm.confirmBtn} disabled={!input.trim()}>
          Acessar o Mural →
        </button>
      </div>
    </div>
  );
}

function BanBanner({ status }: { status: { mensagem: string; permanente: boolean } }) {
  return (
    <div style={bb.banner}>
      <span style={{ fontSize: 28 }}>{status.permanente ? '🚫' : '⏳'}</span>

      <div>
        <p style={bb.title}>
          {status.permanente ? 'Acesso suspenso permanentemente' : 'Publicação temporariamente suspensa'}
        </p>
        <p style={bb.msg}>{status.mensagem}</p>
        {status.permanente && <p style={bb.sub}>Para contestar, entre em contato com o Prof. Carlos.</p>}
      </div>
    </div>
  );
}

function RegrasMural({ furos }: { furos: number }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div style={rg.card}>
      <button onClick={() => setAberto(v => !v)} style={rg.header}>
        <span>📋 Regras do Mural</span>
        <span style={rg.furosText}>
          Seus furos:{' '}
          <strong style={{ color: furos >= 3 ? '#c95441' : '#3f8f5b' }}>
            {furos}
          </strong>{' '}
          {aberto ? '▲' : '▼'}
        </span>
      </button>

      {aberto && (
        <div style={rg.body}>
          <p style={rg.intro}>
            O Mural funciona pela confiança mútua. Cancele com antecedência se não puder treinar.
          </p>

          <div style={rg.rules}>
            {[
              { n: 3, c: 'suspensão de 1 mês', cor: '#ffb74d' },
              { n: 4, c: 'suspensão de 2 meses', cor: '#ff8a65' },
              { n: 7, c: 'banimento permanente', cor: '#ef5350' },
            ].map(r => (
              <div key={r.n} style={rg.ruleRow}>
                <span style={{ ...rg.ruleN, color: r.cor }}>{r.n}× furos</span>
                <span style={rg.ruleArrow}>→</span>
                <span style={rg.ruleConsequence}>{r.c}</span>
              </div>
            ))}
          </div>

          <p style={rg.note}>⚠️ Penalidades aplicadas pelo Prof. Carlos.</p>
        </div>
      )}
    </div>
  );
}

export default function MuralScreen({
  onBack,
  emailUsuario,
  userId,
  username,
  telefone,
  localidade,
}: Props) {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loadingJogos, setLoadingJogos] = useState(true);

  const [cidade, setCidade] = useState<string>(() => {
    const salva = localStorage.getItem(LS_CIDADE);

    if (salva) return salva;

    if (localidade?.trim()) {
      localStorage.setItem(LS_CIDADE, localidade.trim());
      return localidade.trim();
    }

    return '';
  });

  const [showCityPicker, setShowCity] = useState(() => {
    if (localStorage.getItem(LS_CIDADE)) return false;
    if (localidade?.trim()) return false;

    return true;
  });

  const banStatus  = getBanStatus(emailUsuario);
  const penalidade = getPenalidade(emailUsuario);

  const [furosMap, setFurosMap] = useState<Record<string, number>>(getFurosReportados);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroMural>('todos');
  const [showPublicar, setShowPublicar] = useState(false);

  const [classe, setClasse] = useState('Iniciante');
  const [janelaData, setJanelaData] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim] = useState('');
  const [local, setLocal] = useState(LOCAIS[0]);
  const [localOutro, setLocalOutro] = useState('');

  const [whatsapp, setWhatsapp] = useState(() => {
    if (!telefone) return '';

    const d = telefone.replace(/\D/g, '').slice(0, 11);

    if (d.length > 7) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;

    return d;
  });

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const hoje = new Date().toISOString().split('T')[0];

  const loadJogos = useCallback(() => {
    if (!cidade) return;

    setLoadingJogos(true);

    getJogos(cidade)
      .then(data => setJogos(data as Jogo[]))
      .catch(() => setJogos([]))
      .finally(() => setLoadingJogos(false));
  }, [cidade]);

  useEffect(() => {
    loadJogos();
  }, [loadJogos]);

  const handleConfirmCity = useCallback((c: string) => {
    localStorage.setItem(LS_CIDADE, c);
    setCidade(c);
    setShowCity(false);
  }, []);

  const handlePublicar = async () => {
    setErro('');

    if (!dataInicio) {
      setErro('Escolha a data de início.');
      return;
    }

    if (janelaData && !dataFim) {
      setErro('Escolha a data final.');
      return;
    }

    if (janelaData && dataFim < dataInicio) {
      setErro('Data final deve ser após a inicial.');
      return;
    }

    if (!horarioInicio) {
      setErro('Informe o horário de início.');
      return;
    }

    if (!horarioFim) {
      setErro('Informe o horário final.');
      return;
    }

    if (horarioFim <= horarioInicio) {
      setErro('Horário final deve ser após o inicial.');
      return;
    }

    if (local === 'Outro' && !localOutro.trim()) {
      setErro('Descreva o local.');
      return;
    }

    const digits = whatsapp.replace(/\D/g, '');

    if (digits.length < 10) {
      setErro('WhatsApp inválido.');
      return;
    }

    const novo: JogoRecord = {
      id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cidade,
      classe,
      dataInicio,
      dataFim: janelaData ? dataFim : null,
      horarioInicio,
      horarioFim,
      local: local === 'Outro' ? localOutro.trim() : local,
      whatsapp: digits,
      publicadoEm: Date.now(),
      emailPublicador: emailUsuario,
    };

    try {
      const salvo = await postJogo(novo);

      setJogos(prev => [salvo as Jogo, ...prev]);
      setSucesso(true);
      setShowPublicar(false);
      setFiltro('todos');
      setSelectedDate(null);

      setDataInicio('');
      setDataFim('');
      setHorarioInicio('');
      setHorarioFim('');
      setLocalOutro('');

      setTimeout(() => setSucesso(false), 3000);
    } catch {
      setErro('Erro ao publicar. Tente novamente.');
    }
  };

  const handleReportarFuro = useCallback((jogo: Jogo) => {
    if (!window.confirm(`Confirmar furo de ${jogo.whatsapp}?`)) return;

    reportarFuro(jogo.whatsapp, jogo.emailPublicador);
    setFurosMap(getFurosReportados());
  }, []);

  const handleInteressado = useCallback(async (jogoId: string) => {
    try {
      await fetch(`${API_BASE}/jogos/${jogoId}/interessado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_usuario: emailUsuario, nome_usuario: username }),
      });

      setJogos(prev => prev.map(j =>
        j.id === jogoId
          ? { ...j, interessados: (j.interessados ?? 0) + 1 }
          : j
      ));
    } catch {
      /* silent */
    }
  }, [emailUsuario, username]);

  const handleConfirmarSala = useCallback(async (jogoId: string, confirmado_com: string) => {
    await fetch(`${API_BASE}/jogos/${jogoId}/confirmar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_publicador: emailUsuario, confirmado_com }),
    });

    setJogos(prev => prev.map(j =>
      j.id === jogoId
        ? { ...j, status: 'confirmada', confirmado_com }
        : j
    ));
  }, [emailUsuario]);

  const handleExcluirJogo = useCallback(async (jogoId: string) => {
    await deleteJogo(jogoId, emailUsuario);
    setJogos(prev => prev.filter(j => j.id !== jogoId));
  }, [emailUsuario]);

  const handleEditarDatasJogo = useCallback(async (jogoId: string, dados: UpdateJogoDatasPayload) => {
    const atualizado = await updateJogoDatas(jogoId, emailUsuario, dados);

    setJogos(prev => prev.map(j =>
      j.id === jogoId
        ? { ...j, ...atualizado }
        : j
    ));
  }, [emailUsuario]);

  const hojeFiltro = hojeStr();
  const amanhaFiltro = amanhaStr();

  const jogosAtivos = jogos
    .filter(j => j.status !== 'encerrada' && !isExpired(j))
    .filter(j => !cidade || j.cidade.toLowerCase() === cidade.toLowerCase());

  const jogosExibidos = jogosAtivos.filter(jogo => {
    if (filtro === 'hoje') return jogoIsOnDate(jogo, hojeFiltro);
    if (filtro === 'amanha') return jogoIsOnDate(jogo, amanhaFiltro);
    if (filtro === 'meus') return jogo.emailPublicador === emailUsuario;
    if (filtro === 'calendario' && selectedDate) return jogoIsOnDate(jogo, selectedDate);

    return true;
  });

  return (
    <div style={s.page}>
      {showCityPicker && <CityPickerModal onConfirm={handleConfirmCity} onBack={onBack} />}

      {showPublicar && (
        <PublishModal
          cidade={cidade}
          hoje={hoje}
          banStatus={banStatus}
          classe={classe}
          setClasse={setClasse}
          janelaData={janelaData}
          setJanelaData={setJanelaData}
          dataInicio={dataInicio}
          setDataInicio={setDataInicio}
          dataFim={dataFim}
          setDataFim={setDataFim}
          horarioInicio={horarioInicio}
          setHorarioInicio={setHorarioInicio}
          horarioFim={horarioFim}
          setHorarioFim={setHorarioFim}
          local={local}
          setLocal={setLocal}
          localOutro={localOutro}
          setLocalOutro={setLocalOutro}
          whatsapp={whatsapp}
          setWhatsapp={setWhatsapp}
          erro={erro}
          sucesso={sucesso}
          onPublicar={handlePublicar}
          onClose={() => {
            setShowPublicar(false);
            setErro('');
          }}
        />
      )}

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>‹</button>

        <div style={s.headerCenter}>
          <span style={s.headerTitle}>Mural de Treinos</span>
          <span style={s.headerSub}>Encontre parceiros para jogar</span>
        </div>

        <button
          type="button"
          onClick={() => setShowPublicar(true)}
          style={{
            ...s.publishTopBtn,
            opacity: banStatus.banido ? 0.45 : 1,
            cursor: banStatus.banido ? 'not-allowed' : 'pointer',
          }}
          disabled={banStatus.banido}
        >
          + Publicar
        </button>
      </div>

      <div style={s.scrollBody}>
        <div style={s.inner}>
          <div style={s.cityRow}>
            <button onClick={() => setShowCity(true)} style={s.cidadeBtn}>
              📍 {cidade || 'Selecionar cidade'}
            </button>

            {sucesso && <span style={s.successPill}>Publicado!</span>}
          </div>

          <RegrasMural furos={penalidade.furos} />

          {banStatus.banido && <BanBanner status={banStatus} />}

          <section style={s.section}>
            <div style={s.filterRow}>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'hoje', label: 'Hoje' },
                { key: 'amanha', label: 'Amanhã' },
                { key: 'calendario', label: selectedDate ? fmtData(selectedDate) : 'Calendário' },
                { key: 'meus', label: 'Meus posts' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  style={{
                    ...s.filterBtn,
                    ...(filtro === item.key ? s.filterBtnActive : {}),
                  }}
                  onClick={() => {
                    const next = item.key as FiltroMural;
                    setFiltro(next);

                    if (next !== 'calendario') {
                      setSelectedDate(null);
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filtro === 'calendario' && (
              <MiniCalendar
                jogos={jogosAtivos}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}

            <div style={s.listHeader}>
              <div>
                <h2 style={s.sectionTitle}>Jogos disponíveis</h2>
                <p style={s.sectionSub}>
                  {jogosExibidos.length} publicaç{jogosExibidos.length === 1 ? 'ão' : 'ões'}
                  {filtro === 'calendario' && selectedDate ? ` em ${fmtData(selectedDate)}` : ` em ${cidade || '…'}`}
                </p>
              </div>
            </div>

            {loadingJogos ? (
              <div style={s.emptyFeed}>
                <p style={s.emptyText}>Carregando mural...</p>
              </div>
            ) : jogosExibidos.length === 0 ? (
              <div style={s.emptyFeed}>
                <span style={{ fontSize: 42 }}>🎾</span>

                <p style={s.emptyText}>
                  {filtro === 'calendario' && selectedDate
                    ? `Nenhum parceiro em ${fmtData(selectedDate)}.`
                    : filtro === 'meus'
                      ? 'Você ainda não publicou nenhum treino.'
                      : `Nenhum parceiro disponível em ${cidade || 'sua cidade'} ainda.`}
                </p>

                <p style={s.emptyHint}>Clique em “Publicar” para criar uma disponibilidade.</p>
              </div>
            ) : (
              <div style={s.feed}>
                {jogosExibidos.map(jogo => (
                  <JogoCard
                    key={jogo.id}
                    jogo={jogo}
                    furosReportados={furosMap[jogo.whatsapp] || 0}
                    onReportarFuro={() => handleReportarFuro(jogo)}
                    onInteressado={() => handleInteressado(jogo.id)}
                    onConfirmarSala={(email) => handleConfirmarSala(jogo.id, email)}
                    onDelete={() => handleExcluirJogo(jogo.id)}
                    onUpdateDatas={(dados) => handleEditarDatasJogo(jogo.id, dados)}
                    emailUsuario={emailUsuario}
                    userId={userId}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PublishModal({
  cidade,
  hoje,
  banStatus,
  classe,
  setClasse,
  janelaData,
  setJanelaData,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  horarioInicio,
  setHorarioInicio,
  horarioFim,
  setHorarioFim,
  local,
  setLocal,
  localOutro,
  setLocalOutro,
  whatsapp,
  setWhatsapp,
  erro,
  sucesso,
  onPublicar,
  onClose,
}: {
  cidade: string;
  hoje: string;
  banStatus: { banido: boolean; mensagem: string; permanente: boolean };
  classe: string;
  setClasse: (v: string) => void;
  janelaData: boolean;
  setJanelaData: (v: boolean) => void;
  dataInicio: string;
  setDataInicio: (v: string) => void;
  dataFim: string;
  setDataFim: (v: string) => void;
  horarioInicio: string;
  setHorarioInicio: (v: string) => void;
  horarioFim: string;
  setHorarioFim: (v: string) => void;
  local: string;
  setLocal: (v: string) => void;
  localOutro: string;
  setLocalOutro: (v: string) => void;
  whatsapp: string;
  setWhatsapp: (v: string) => void;
  erro: string;
  sucesso: boolean;
  onPublicar: () => void;
  onClose: () => void;
}) {
  return (
    <div style={pm.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={pm.sheet}>
        <div style={pm.handle} />

        <div style={pm.header}>
          <div>
            <h2 style={pm.title}>Publicar treino</h2>
            <p style={pm.sub}>Preencha sua disponibilidade em {cidade || 'sua cidade'}.</p>
          </div>

          <button type="button" onClick={onClose} style={pm.closeBtn}>✕</button>
        </div>

        {banStatus.banido ? (
          <BanBanner status={banStatus} />
        ) : (
          <>
            <FieldGroup label="Sua Classe">
              <select value={classe} onChange={e => setClasse(e.target.value)} style={pm.select}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FieldGroup>

            <FieldGroup label="Disponibilidade de dias">
              <div style={pm.modeToggle}>
                <button
                  type="button"
                  style={{ ...pm.modeBtn, ...(janelaData ? {} : pm.modeBtnActive) }}
                  onClick={() => setJanelaData(false)}
                >
                  Dia único
                </button>

                <button
                  type="button"
                  style={{ ...pm.modeBtn, ...(janelaData ? pm.modeBtnActive : {}) }}
                  onClick={() => setJanelaData(true)}
                >
                  Janela de dias
                </button>
              </div>
            </FieldGroup>

            <div style={pm.row}>
              <div style={pm.col}>
                <span style={pm.subLabel}>{janelaData ? 'De' : 'Data'}</span>
                <input
                  type="date"
                  value={dataInicio}
                  min={hoje}
                  onChange={e => setDataInicio(e.target.value)}
                  style={pm.input}
                />
              </div>

              {janelaData && (
                <div style={pm.col}>
                  <span style={pm.subLabel}>Até</span>
                  <input
                    type="date"
                    value={dataFim}
                    min={dataInicio || hoje}
                    onChange={e => setDataFim(e.target.value)}
                    style={pm.input}
                  />
                </div>
              )}
            </div>

            <FieldGroup label="Janela de horários">
              <div style={pm.timeStack}>
                <div style={pm.timeRow}>
                  <span style={pm.timeLabel}>Das</span>
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={e => setHorarioInicio(e.target.value)}
                    style={pm.timeInput}
                  />
                </div>

                <div style={pm.timeRow}>
                  <span style={pm.timeLabel}>Às</span>
                  <input
                    type="time"
                    value={horarioFim}
                    onChange={e => setHorarioFim(e.target.value)}
                    style={pm.timeInput}
                  />
                </div>
              </div>
            </FieldGroup>

            <FieldGroup label="Local">
              <select
                value={local}
                onChange={e => {
                  setLocal(e.target.value);
                  setLocalOutro('');
                }}
                style={pm.select}
              >
                {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              {local === 'Outro' && (
                <input
                  style={{ ...pm.input, marginTop: 8 }}
                  placeholder="Descreva o local..."
                  type="text"
                  value={localOutro}
                  onChange={e => setLocalOutro(e.target.value)}
                  autoCapitalize="words"
                />
              )}
            </FieldGroup>

            <FieldGroup label="Seu WhatsApp">
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(33) 99999-0000"
                value={whatsapp}
                onChange={e => setWhatsapp(maskPhone(e.target.value))}
                style={pm.input}
              />
            </FieldGroup>

            {erro && <p style={pm.erro}>{erro}</p>}
            {sucesso && <p style={pm.ok}>✅ Publicado! Aguardando parceiro…</p>}

            <button type="button" onClick={onPublicar} style={pm.publishBtn}>
              Publicar disponibilidade
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function JogoCard({
  jogo,
  furosReportados,
  onReportarFuro,
  onInteressado,
  onConfirmarSala,
  onDelete,
  onUpdateDatas,
  emailUsuario,
  userId,
}: {
  jogo: Jogo;
  furosReportados: number;
  onReportarFuro: () => void;
  onInteressado: () => void;
  onConfirmarSala: (email: string) => void;
  onDelete: () => Promise<void>;
  onUpdateDatas: (dados: UpdateJogoDatasPayload) => Promise<void>;
  emailUsuario: string;
  userId: number;
}) {
  const waUrl = buildWhatsAppUrl(jogo);
  const isOwner = jogo.emailPublicador === emailUsuario;
  const isConfirmada = jogo.status === 'confirmada';
  const autorNome = nomeDoPublicador(jogo);
  const dateInfo = getCardDateInfo(jogo.dataInicio);

  const [reportado, setReportado] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [interessados, setInteressados] = useState<Interessado[]>([]);
  const [loadingInteress, setLoadingInteress] = useState(false);
  const [showInteress, setShowInteress] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [ownerActionMsg, setOwnerActionMsg] = useState('');

  const handleWaClick = () => {
    if (!isOwner) onInteressado();
  };

  const loadInteressados = async () => {
    setLoadingInteress(true);

    try {
      const r = await fetch(
        `${API_BASE}/jogos/${jogo.id}/interessados?email_publicador=${encodeURIComponent(emailUsuario)}`
      );

      setInteressados(await r.json());
    } catch {
      /* silent */
    } finally {
      setLoadingInteress(false);
    }
  };

  const toggleInteressados = () => {
    if (!showInteress) loadInteressados();
    setShowInteress(v => !v);
  };

  const handleConfirmar = async () => {
    if (!selectedEmail) return;

    setConfirmando(true);
    onConfirmarSala(selectedEmail);
    setConfirmando(false);
    setShowInteress(false);
  };

  const handleExcluir = async () => {
    if (!window.confirm('Deseja excluir esta publicação?')) return;

    setOwnerActionMsg('');

    try {
      await onDelete();
    } catch (e) {
      setOwnerActionMsg(e instanceof Error ? e.message : 'Erro ao excluir publicação.');
    }
  };

  const handleSalvarEdicao = async (dados: UpdateJogoDatasPayload) => {
    setOwnerActionMsg('');
    await onUpdateDatas(dados);
    setShowEdit(false);
  };

  const jaJogou = isExpired(jogo);

  return (
    <>
      {showResult && (
        <ResultadoModal
          jogo={jogo}
          emailUsuario={emailUsuario}
          userId={userId}
          onClose={() => setShowResult(false)}
        />
      )}

      {showEdit && (
        <EditJogoModal
          jogo={jogo}
          onClose={() => setShowEdit(false)}
          onSave={handleSalvarEdicao}
        />
      )}

      <div style={sc.card}>
        <div style={sc.header}>
          <div style={sc.authorWrap}>
            {jogo.fotoPublicador ? (
              <img src={jogo.fotoPublicador} alt={autorNome} style={sc.avatar} />
            ) : (
              <div style={sc.avatarFallback}>{autorNome.charAt(0).toUpperCase()}</div>
            )}

            <div style={sc.authorInfo}>
              <div style={sc.authorName}>{autorNome}</div>

              <div style={sc.authorMetaRow}>
                <div style={sc.authorMeta}>Nível {jogo.classe}</div>

                <div style={sc.interestCompactInline}>
                  <span style={sc.interestCompactIcon}>
                    <UsersLineIcon size={14} />
                  </span>
                  <span style={sc.interestCompactText}>
                    {jogo.interessados ?? 0} interessado{(jogo.interessados ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={sc.headerRight}>
            <span style={sc.postTime}>{tempoRelativo(jogo.publicadoEm)}</span>
          </div>
        </div>

        <div style={sc.matchPanel}>
          <div style={sc.dateArea}>
            <span style={sc.dateIcon}>
              <CalendarLineIcon size={20} />
            </span>
            <span style={sc.dateLabel}>{dateInfo.label}</span>
            <strong style={sc.dateDay}>{dateInfo.day}</strong>
            <span style={sc.dateMonth}>{dateInfo.month}</span>
          </div>

          <div style={sc.divider} />

          <div style={sc.centerInfo}>
            <div style={sc.infoLine}>
              <span style={sc.infoIcon}>
                <ClockLineIcon size={20} />
              </span>
              <span style={sc.timeText}>
                {jogo.horarioInicio} - {jogo.horarioFim}
              </span>
            </div>

            <div style={sc.infoLine}>
              <span style={sc.infoIcon}>
                <PinLineIcon size={20} />
              </span>
              <div style={sc.locationText}>
                <span>{jogo.local}</span>
                <span>{jogo.cidade}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={sc.chipRow}>
          {isOwner && <span style={sc.ownerChip}>Seu post</span>}
          {isConfirmada && <span style={sc.confirmedChip}>Confirmada</span>}
          {furosReportados >= 3 && <span style={sc.warningChip}>{furosReportados} furos</span>}
        </div>

        {!isConfirmada && !isOwner && (
          <div style={sc.actionArea}>
            <div style={sc.leftStatus}>
              {jogo.dataFim && jogo.dataFim !== jogo.dataInicio ? (
                <span>Disponível até {fmtData(jogo.dataFim)}</span>
              ) : (
                <span>{jogo.local}</span>
              )}
            </div>

            <div style={sc.actions}>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={sc.contactBtn}
                onClick={handleWaClick}
              >
                <WaIcon /> Entrar em contato
              </a>
            </div>
          </div>
        )}

        {isOwner && !isConfirmada && (
          <div style={sc.ownerActions}>
            <button type="button" style={sc.editBtn} onClick={() => setShowEdit(true)}>
              Editar data/horário
            </button>

            <button type="button" style={sc.deleteBtn} onClick={handleExcluir}>
              Excluir
            </button>
          </div>
        )}

        {ownerActionMsg && <p style={sc.ownerActionMsg}>{ownerActionMsg}</p>}

        {isOwner && !isConfirmada && (jogo.interessados ?? 0) > 0 && (
          <div style={sc.ownerPanel}>
            <button onClick={toggleInteressados} style={sc.interessBtn}>
              {showInteress ? 'Ocultar interessados' : `Ver interessados (${jogo.interessados})`}
            </button>

            {showInteress && (
              <div style={sc.interessBox}>
                {loadingInteress ? (
                  <p style={sc.mutedText}>Carregando...</p>
                ) : interessados.length === 0 ? (
                  <p style={sc.mutedText}>Nenhum ainda.</p>
                ) : (
                  <>
                    <select
                      style={sc.interessSelect}
                      value={selectedEmail}
                      onChange={e => setSelectedEmail(e.target.value)}
                    >
                      <option value="">Selecione com quem confirmou...</option>
                      {interessados.map(i => (
                        <option key={i.email_usuario} value={i.email_usuario}>
                          {i.nome_usuario}
                        </option>
                      ))}
                    </select>

                    <button
                      style={{ ...sc.confirmarBtn, opacity: !selectedEmail || confirmando ? 0.5 : 1 }}
                      disabled={!selectedEmail || confirmando}
                      onClick={handleConfirmar}
                    >
                      Confirmar partida
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {isConfirmada && isOwner && (
          <div style={sc.confirmadaInfo}>
            Confirmado com <strong>{jogo.confirmado_com?.split('@')[0]}</strong>
          </div>
        )}

        <div style={sc.reportRow}>
          {jaJogou && jogo.emailPublicador && jogo.emailPublicador !== emailUsuario && (
            <button onClick={() => setShowResult(true)} style={sc.rankBtn}>
              Registrar resultado
            </button>
          )}

          {!isOwner && (
            reportado ? (
              <span style={sc.reportadoTxt}>Furo registrado</span>
            ) : (
              <button
                onClick={() => {
                  onReportarFuro();
                  setReportado(true);
                }}
                style={sc.reportBtn}
              >
                Denunciar furo
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}


function EditJogoModal({
  jogo,
  onClose,
  onSave,
}: {
  jogo: Jogo;
  onClose: () => void;
  onSave: (dados: UpdateJogoDatasPayload) => Promise<void>;
}) {
  const hoje = new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(jogo.dataInicio);
  const [dataFim, setDataFim] = useState(jogo.dataFim ?? '');
  const [horarioInicio, setHorarioInicio] = useState(jogo.horarioInicio);
  const [horarioFim, setHorarioFim] = useState(jogo.horarioFim);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setErro('');

    if (!dataInicio) {
      setErro('Escolha a data de início.');
      return;
    }

    if (dataFim && dataFim < dataInicio) {
      setErro('Data final deve ser maior ou igual à data inicial.');
      return;
    }

    if (!horarioInicio) {
      setErro('Informe o horário de início.');
      return;
    }

    if (!horarioFim) {
      setErro('Informe o horário final.');
      return;
    }

    if (horarioFim <= horarioInicio) {
      setErro('Horário final deve ser após o inicial.');
      return;
    }

    setLoading(true);

    try {
      await onSave({
        dataInicio,
        dataFim: dataFim || null,
        horarioInicio,
        horarioFim,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar alteração.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pm.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={pm.sheet}>
        <div style={pm.handle} />

        <div style={pm.header}>
          <div>
            <h2 style={pm.title}>Editar publicação</h2>
            <p style={pm.sub}>Altere apenas datas e horários da partida.</p>
          </div>

          <button type="button" onClick={onClose} style={pm.closeBtn}>✕</button>
        </div>

        <div style={pm.row}>
          <div style={pm.col}>
            <span style={pm.subLabel}>Data início</span>
            <input
              type="date"
              value={dataInicio}
              min={hoje}
              onChange={e => setDataInicio(e.target.value)}
              style={pm.input}
            />
          </div>

          <div style={pm.col}>
            <span style={pm.subLabel}>Data fim</span>
            <input
              type="date"
              value={dataFim}
              min={dataInicio || hoje}
              onChange={e => setDataFim(e.target.value)}
              style={pm.input}
            />
          </div>
        </div>

        <FieldGroup label="Janela de horários">
          <div style={pm.timeStack}>
            <div style={pm.timeRow}>
              <span style={pm.timeLabel}>Das</span>
              <input
                type="time"
                value={horarioInicio}
                onChange={e => setHorarioInicio(e.target.value)}
                style={pm.timeInput}
              />
            </div>

            <div style={pm.timeRow}>
              <span style={pm.timeLabel}>Às</span>
              <input
                type="time"
                value={horarioFim}
                onChange={e => setHorarioFim(e.target.value)}
                style={pm.timeInput}
              />
            </div>
          </div>
        </FieldGroup>

        {erro && <p style={pm.erro}>{erro}</p>}

        <button
          type="button"
          onClick={handleSave}
          style={{ ...pm.publishBtn, opacity: loading ? 0.6 : 1 }}
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar alteração'}
        </button>
      </div>
    </div>
  );
}

function ResultadoModal({
  jogo,
  emailUsuario,
  userId,
  onClose,
}: {
  jogo: Jogo;
  emailUsuario: string;
  userId: number;
  onClose: () => void;
}) {
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [ligaId, setLigaId] = useState('');
  const [tempId, setTempId] = useState('');
  const [tipo, setTipo] = useState('melhor_de_3');
  const [sets, setSets] = useState([{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]);
  const [wo, setWo] = useState(false);
  const [euGanhei, setEuGanhei] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) ?? '';

    if (!token) return;

    fetch(`${API_BASE}/ranking/ligas`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const arr: Liga[] = d.data ?? [];

        setLigas(arr);

        if (arr.length > 0) {
          setLigaId(arr[0].id);
          setTempId(arr[0].temporada_ativa_id ?? '');
        }
      })
      .catch(() => setErr('Erro ao carregar ligas.'));
  }, []);

  const onLigaChange = (id: string) => {
    setLigaId(id);

    const l = ligas.find(x => x.id === id);
    setTempId(l?.temporada_ativa_id ?? '');
  };

  const submit = async () => {
    if (!tempId) {
      setErr('Selecione uma liga com temporada ativa.');
      return;
    }

    setLoading(true);
    setErr('');

    const token = localStorage.getItem(TOKEN_KEY) ?? '';

    let placar = null;
    let vencedorSouEu = euGanhei;

    if (!wo) {
      const nSets = tipo === 'pro_set' ? 1 : 2;
      const parsedSets = sets.slice(0, nSets).map(s => ({
        setA: Number(s.a || 0),
        setB: Number(s.b || 0),
      }));

      if (tipo !== 'pro_set') {
        const sA = parsedSets.filter(s => s.setA > s.setB).length;
        const sB = parsedSets.filter(s => s.setB > s.setA).length;

        if (sA === 1 && sB === 1) {
          parsedSets.push({
            setA: Number(sets[2].a || 0),
            setB: Number(sets[2].b || 0),
          });
        }
      }

      placar = parsedSets;

      const wA = parsedSets.filter(s => s.setA > s.setB).length;
      const wB = parsedSets.filter(s => s.setB > s.setA).length;

      vencedorSouEu = wA > wB;
    }

    try {
      const body: Record<string, unknown> = {
        temporada_id: tempId,
        jogador_a_id: userId,
        email_b: jogo.emailPublicador,
        placar,
        tipo_partida: tipo,
        wo,
        data_partida: jogo.dataInicio,
      };

      if (wo) body.eu_ganhei = euGanhei;
      else body.vencedor_e_a = vencedorSouEu;

      const r = await fetch(`${API_BASE}/ranking/partidas/mural`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await r.json();

      if (!r.ok) {
        setErr(json.error ?? 'Erro.');
        return;
      }

      setOk(true);
      setTimeout(onClose, 2000);
    } catch {
      setErr('Erro de conexão.');
    }

    setLoading(false);
  };

  if (ok) {
    return (
      <div style={rm.overlay} onClick={onClose}>
        <div style={rm.sheet}>
          <div style={{ fontSize: 48 }}>🏆</div>
          <p style={{ color: '#3f8f5b', fontWeight: 900, fontSize: 16, margin: 0 }}>
            Resultado registrado!
          </p>
          <p style={{ color: '#8d7b70', fontSize: 13, margin: 0 }}>
            Aguardando confirmação do adversário.
          </p>
        </div>
      </div>
    );
  }

  const nSets = tipo === 'pro_set' ? 1 : 2;
  const sA0 = Number(sets[0].a || 0);
  const sB0 = Number(sets[0].b || 0);
  const sA1 = Number(sets[1].a || 0);
  const sB1 = Number(sets[1].b || 0);

  const show3 = tipo !== 'pro_set' && !wo && (
    (sA0 > sB0 && sA1 < sB1) || (sA0 < sB0 && sA1 > sB1)
  );

  return (
    <div style={rm.overlay} onClick={onClose}>
      <div style={rm.sheet} onClick={e => e.stopPropagation()}>
        <div style={rm.header}>
          <span style={rm.title}>Registrar resultado</span>
          <button style={rm.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={rm.sub}>
          Você jogou com <strong>{jogo.emailPublicador?.split('@')[0] ?? 'esse jogador'}</strong> em {fmtData(jogo.dataInicio)}
        </p>

        {ligas.length === 0 && !err && <p style={rm.hint}>Carregando ligas…</p>}

        {ligas.length > 0 && (
          <select style={rm.sel} value={ligaId} onChange={e => onLigaChange(e.target.value)}>
            {ligas.map(l => (
              <option key={l.id} value={l.id}>
                {l.nome}{l.temporada_ativa_nome ? ` — ${l.temporada_ativa_nome}` : ' (sem temporada)'}
              </option>
            ))}
          </select>
        )}

        <div style={rm.woRow}>
          <label style={rm.woLabel}>
            <input
              type="checkbox"
              checked={wo}
              onChange={e => setWo(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            W.O. (adversário não compareceu)
          </label>
        </div>

        {!wo && (
          <>
            <select style={rm.sel} value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="melhor_de_3">Melhor de 3 sets</option>
              <option value="2sets_supertiebreak">2 Sets + Super Tiebreak</option>
              <option value="pro_set">Pró-set</option>
            </select>

            <p style={rm.hint}>Placar — Eu × Adversário</p>

            {Array.from({ length: show3 ? 3 : nSets }).map((_, i) => (
              <div key={i} style={rm.setRow}>
                <span style={rm.setLabel}>Set {i + 1}</span>
                <input
                  style={rm.setInp}
                  type="number"
                  min={0}
                  max={99}
                  placeholder="Eu"
                  value={sets[i].a}
                  onChange={e => setSets(prev => {
                    const n = [...prev];
                    n[i] = { ...n[i], a: e.target.value };
                    return n;
                  })}
                />
                <span style={{ color: '#a29186' }}>×</span>
                <input
                  style={rm.setInp}
                  type="number"
                  min={0}
                  max={99}
                  placeholder="Adv"
                  value={sets[i].b}
                  onChange={e => setSets(prev => {
                    const n = [...prev];
                    n[i] = { ...n[i], b: e.target.value };
                    return n;
                  })}
                />
              </div>
            ))}
          </>
        )}

        {wo && (
          <div style={rm.woRow}>
            <label style={rm.woLabel}>
              <input
                type="radio"
                checked={euGanhei}
                onChange={() => setEuGanhei(true)}
                style={{ marginRight: 6 }}
              />
              Eu ganhei o WO
            </label>

            <label style={rm.woLabel}>
              <input
                type="radio"
                checked={!euGanhei}
                onChange={() => setEuGanhei(false)}
                style={{ marginRight: 6 }}
              />
              Adversário ganhou o WO
            </label>
          </div>
        )}

        {err && <p style={rm.err}>{err}</p>}

        <button
          style={{ ...rm.submitBtn, opacity: loading ? 0.6 : 1 }}
          onClick={submit}
          disabled={loading || !tempId}
        >
          {loading ? 'Enviando…' : 'Registrar no Ranking'}
        </button>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={pm.fieldGroup}>
      <span style={pm.label}>{label}</span>
      {children}
    </div>
  );
}

function MiniCalendar({
  jogos,
  selectedDate,
  onSelectDate,
}: {
  jogos: Jogo[];
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
}) {
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const availDates = new Set<string>();

  jogos.forEach(jogo => {
    const start = new Date(jogo.dataInicio + 'T12:00:00');
    const end = new Date((jogo.dataFim || jogo.dataInicio) + 'T12:00:00');
    const cursor = new Date(start);

    while (cursor <= end) {
      availDates.add(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const todayStr = now.toISOString().split('T')[0];
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  return (
    <div style={cal.wrapper}>
      <div style={cal.nav}>
        <button onClick={prevMonth} style={cal.navBtn}>◀</button>
        <span style={cal.monthLabel}>{MESES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={cal.navBtn}>▶</button>
      </div>

      <div style={cal.grid}>
        {['D','S','T','Q','Q','S','S'].map((d, i) => (
          <span key={`dow${i}`} style={cal.dow}>{d}</span>
        ))}

        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;

          const mm = String(viewMonth + 1).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          const dateStr = `${viewYear}-${mm}-${dd}`;
          const hasJogos = availDates.has(dateStr);
          const isPast = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          const isSel = dateStr === selectedDate;
          const clickable = hasJogos && !isPast;

          return (
            <button
              key={dateStr}
              onClick={() => clickable && onSelectDate(isSel ? null : dateStr)}
              style={{
                ...cal.dayBtn,
                ...(isPast ? cal.dayPast : {}),
                ...(isToday && !isSel ? cal.dayToday : {}),
                ...(clickable && !isSel ? cal.dayHas : {}),
                ...(isSel ? cal.daySel : {}),
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              {d}
              {clickable && (
                <span
                  style={{
                    ...cal.dot,
                    background: isSel ? '#fff' : '#c66b4d',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <button onClick={() => onSelectDate(null)} style={cal.clearBtn}>
          × Mostrar todos os dias
        </button>
      )}
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const pm: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
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
    padding: '10px 18px 34px',
    maxWidth: 520,
    width: '100%',
    maxHeight: '92dvh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 15,
    boxSizing: 'border-box',
    boxShadow: '0 -16px 44px rgba(55,35,26,0.22)',
  },

  handle: {
    width: 46,
    height: 5,
    borderRadius: 10,
    background: '#dfc8bb',
    alignSelf: 'center',
    margin: '2px 0 4px',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    margin: 0,
    color: '#2d2521',
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: -0.6,
  },

  sub: {
    margin: '4px 0 0',
    color: '#8f7769',
    fontSize: 13,
    fontWeight: 650,
  },

  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: '#f4ebe3',
    color: '#8b6657',
    fontSize: 18,
    cursor: 'pointer',
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
    colorScheme: 'light' as React.CSSProperties['colorScheme'],
  },

  select: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 15,
    fontWeight: 650,
    boxSizing: 'border-box' as const,
    colorScheme: 'light' as React.CSSProperties['colorScheme'],
  },

  row: {
    display: 'flex',
    gap: 10,
  },

  col: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  subLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: '#9b8a7f',
  },

  modeToggle: {
    display: 'flex',
    background: '#f3e8de',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },

  modeBtn: {
    flex: 1,
    padding: '11px 8px',
    borderRadius: 11,
    border: 'none',
    background: 'transparent',
    color: '#8f7769',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },

  modeBtnActive: {
    background: '#fff',
    color: '#b45e45',
    boxShadow: '0 6px 16px rgba(117,76,56,0.08)',
  },

  timeStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  timeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  timeLabel: {
    fontSize: 13,
    fontWeight: 850,
    color: '#8f7769',
    width: 28,
    flexShrink: 0,
  },

  timeInput: {
    flex: 1,
    minWidth: 0,
    padding: '13px 14px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 15,
    fontWeight: 650,
    boxSizing: 'border-box',
    colorScheme: 'light',
  },

  erro: {
    color: '#c95441',
    fontSize: 13,
    fontWeight: 800,
    margin: 0,
  },

  ok: {
    color: '#3f8f5b',
    fontSize: 13,
    fontWeight: 800,
    margin: 0,
  },

  publishBtn: {
    width: '100%',
    padding: '15px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },
};

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'fixed',
    inset: 0,
    background: '#fbf7f1',
    color: '#2d2521',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  header: {
    display: 'grid',
    gridTemplateColumns: '44px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
    background: '#fbf7f1',
    flexShrink: 0,
    zIndex: 10,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: 'none',
    background: '#f3e8de',
    color: '#7a5142',
    fontSize: 28,
    lineHeight: 1,
    cursor: 'pointer',
  },

  headerCenter: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: 950,
    color: '#2d2521',
    letterSpacing: -0.7,
  },

  headerSub: {
    fontSize: 12,
    fontWeight: 650,
    color: '#94857a',
  },

  publishTopBtn: {
    padding: '11px 14px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 900,
    boxShadow: '0 10px 20px rgba(147,72,54,0.18)',
    whiteSpace: 'nowrap',
  },

  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },

  inner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '4px 16px 36px',
    maxWidth: 540,
    margin: '0 auto',
    boxSizing: 'border-box',
    width: '100%',
  },

  cityRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  cidadeBtn: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    color: '#8b5b49',
    padding: '9px 12px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 850,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(117,76,56,0.06)',
  },

  successPill: {
    background: '#edf8ef',
    color: '#3f8f5b',
    border: '1px solid rgba(63,143,91,0.16)',
    padding: '8px 11px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  filterRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 2,
  },

  filterBtn: {
    flexShrink: 0,
    border: '1px solid rgba(130,82,62,0.08)',
    background: '#fff',
    color: '#8f7769',
    borderRadius: 999,
    padding: '10px 13px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(117,76,56,0.05)',
  },

  filterBtnActive: {
    background: '#c66b4d',
    color: '#fff',
    borderColor: '#c66b4d',
  },

  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '2px 2px 0',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 950,
    margin: 0,
    color: '#2d2521',
    letterSpacing: -0.4,
  },

  sectionSub: {
    margin: '3px 0 0',
    fontSize: 12,
    color: '#94857a',
    fontWeight: 650,
  },

  emptyFeed: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '34px 18px',
    textAlign: 'center',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  emptyText: {
    margin: 0,
    fontSize: 15,
    color: '#4b3d36',
    fontWeight: 850,
  },

  emptyHint: {
    margin: 0,
    fontSize: 12,
    color: '#94857a',
    fontWeight: 650,
  },

  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
};

const sc: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.06)',
    borderRadius: 22,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 10px 24px rgba(57,37,28,0.06)',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  authorWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },

  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #c6714e, #8f4635)',
    color: '#fff',
    fontSize: 18,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  authorInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flex: 1,
  },

  authorName: {
    color: '#232428',
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: -0.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  authorMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexWrap: 'wrap',
  },

  authorMeta: {
    color: '#6f7178',
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    paddingTop: 2,
  },

  postTime: {
    color: '#6f7178',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  interestCompactInline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 8px',
    borderRadius: 999,
    background: '#fff7f2',
    border: '1px solid rgba(211,87,32,0.10)',
    maxWidth: '100%',
  },

  interestCompactIcon: {
    display: 'flex',
    alignItems: 'center',
    color: '#d35720',
    flexShrink: 0,
  },

  interestCompactText: {
    color: '#7a6b63',
    fontSize: 11.5,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },

  matchPanel: {
    minHeight: 112,
    borderRadius: 18,
    background: 'linear-gradient(90deg, #fff7f2 0%, #fffaf8 58%, #fff6f1 100%)',
    border: '1px solid rgba(210,111,73,0.10)',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateColumns: '68px 1px minmax(0, 1fr)',
    alignItems: 'center',
    padding: '12px 10px',
    boxSizing: 'border-box',
  },

  dateArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    color: '#d35720',
  },

  dateIcon: {
    display: 'flex',
    color: '#d35720',
    marginBottom: 2,
  },

  dateLabel: {
    color: '#d35720',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  dateDay: {
    color: '#232428',
    fontSize: 26,
    lineHeight: 0.95,
    fontWeight: 700,
  },

  dateMonth: {
    color: '#70737b',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },

  divider: {
    width: 1,
    alignSelf: 'stretch',
    background: 'rgba(213,87,32,0.13)',
  },

  centerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '0 12px',
    minWidth: 0,
  },

  infoLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },

  infoIcon: {
    color: '#d35720',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  timeText: {
    color: '#232428',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },

  locationText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    color: '#6f7178',
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.2,
    minWidth: 0,
  },

  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  ownerChip: {
    background: '#fff1eb',
    color: '#b65b43',
    padding: '7px 11px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
  },

  confirmedChip: {
    background: '#edf8ef',
    color: '#3f8f5b',
    padding: '7px 11px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
  },

  warningChip: {
    background: '#fff0ec',
    color: '#c95441',
    padding: '7px 11px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
  },

  actionArea: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: 12,
  },

  leftStatus: {
    color: '#6f7178',
    fontSize: 12.5,
    fontWeight: 600,
    minWidth: 0,
  },

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  contactBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    padding: '13px 18px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #d85a20, #b04f38)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    boxShadow: '0 8px 16px rgba(191,82,42,0.18)',
    whiteSpace: 'nowrap',
  },

  ownerActions: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    alignItems: 'center',
  },

  editBtn: {
    border: '1px solid rgba(198,107,77,0.22)',
    background: '#fff4ec',
    color: '#a54f3d',
    borderRadius: 14,
    padding: '11px 12px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  },

  deleteBtn: {
    border: '1px solid rgba(201,84,65,0.18)',
    background: '#fff',
    color: '#c95441',
    borderRadius: 14,
    padding: '11px 12px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  },

  ownerActionMsg: {
    margin: '-4px 0 0',
    color: '#c95441',
    fontSize: 12,
    fontWeight: 700,
  },

  ownerPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    background: '#fff8f3',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 17,
    padding: 10,
  },

  interessBtn: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 13,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.1)',
    color: '#a54f3d',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },

  interessBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },

  mutedText: {
    color: '#9b8a7f',
    fontSize: 13,
    margin: 0,
    fontWeight: 600,
  },

  interessSelect: {
    width: '100%',
    padding: '12px',
    borderRadius: 13,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 14,
    boxSizing: 'border-box',
  },

  confirmarBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },

  confirmadaInfo: {
    fontSize: 13,
    color: '#3f8f5b',
    fontWeight: 700,
    textAlign: 'center',
    padding: '4px 0',
  },

  reportRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },

  reportBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#8b7c73',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },

  reportadoTxt: {
    fontSize: 12,
    color: '#3f8f5b',
    fontWeight: 700,
  },

  rankBtn: {
    background: '#fff4e8',
    border: '1px solid rgba(198,107,77,0.22)',
    color: '#a54f3d',
    borderRadius: 12,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

const cal: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 20,
    padding: '14px 10px',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: '0 2px',
  },

  navBtn: {
    background: '#f4ebe3',
    border: 'none',
    color: '#8b6657',
    width: 32,
    height: 32,
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 12,
  },

  monthLabel: {
    fontSize: 14,
    fontWeight: 900,
    color: '#2d2521',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 3,
  },

  dow: {
    fontSize: 11,
    fontWeight: 900,
    color: '#a29186',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },

  dayBtn: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: '1',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: '#b5a69d',
    fontSize: 13,
    padding: 0,
    gap: 1,
  },

  dayPast: {
    color: '#ded1c8',
  },

  dayToday: {
    color: '#c66b4d',
    boxShadow: 'inset 0 0 0 1px rgba(198,107,77,0.3)',
  },

  dayHas: {
    color: '#2d2521',
    fontWeight: 900,
    background: '#fff4ec',
  },

  daySel: {
    background: '#c66b4d',
    color: '#fff',
    fontWeight: 950,
  },

  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: '50%',
  },

  clearBtn: {
    marginTop: 10,
    width: '100%',
    background: '#f7eee7',
    border: 'none',
    color: '#8b6657',
    padding: '9px',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 900,
    boxSizing: 'border-box',
  },
};

const cm: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(44,30,24,0.42)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backdropFilter: 'blur(5px)',
  },

  sheet: {
    background: '#fffaf5',
    border: '1px solid rgba(130,82,62,0.12)',
    borderRadius: 24,
    padding: '24px 24px 32px',
    maxWidth: 400,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
    boxShadow: '0 18px 44px rgba(55,35,26,0.22)',
  },

  backBtn: {
    alignSelf: 'flex-start',
    background: '#f4ebe3',
    border: 'none',
    color: '#8b6657',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },

  icon: {
    fontSize: 52,
    lineHeight: 1,
  },

  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
    color: '#2d2521',
    textAlign: 'center',
  },

  sub: {
    margin: 0,
    fontSize: 14,
    color: '#8f7769',
    textAlign: 'center',
    lineHeight: 1.5,
    fontWeight: 650,
  },

  detectBtn: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    background: '#fff4ec',
    border: '1.5px solid rgba(198,107,77,0.35)',
    color: '#a54f3d',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
  },

  ouLabel: {
    margin: 0,
    fontSize: 12,
    color: '#a29186',
  },

  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 16,
    boxSizing: 'border-box',
    colorScheme: 'light',
  },

  erro: {
    margin: 0,
    fontSize: 13,
    color: '#c95441',
    textAlign: 'center',
    fontWeight: 800,
  },

  confirmBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 950,
    cursor: 'pointer',
  },
};

const bb: Record<string, React.CSSProperties> = {
  banner: {
    background: '#fff0ec',
    border: '1px solid rgba(201,84,65,0.2)',
    borderRadius: 18,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },

  title: {
    margin: '0 0 4px',
    fontSize: 14,
    fontWeight: 950,
    color: '#c95441',
  },

  msg: {
    margin: 0,
    fontSize: 13,
    color: '#7d6256',
    lineHeight: 1.45,
    fontWeight: 650,
  },

  sub: {
    margin: '6px 0 0',
    fontSize: 12,
    color: '#9b8a7f',
  },
};

const rg: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 10px 28px rgba(117,76,56,0.06)',
  },

  header: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '13px 14px',
    background: 'none',
    border: 'none',
    color: '#2d2521',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },

  furosText: {
    fontSize: 12,
    color: '#8f7769',
  },

  body: {
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
  },

  intro: {
    margin: 0,
    fontSize: 12.5,
    color: '#7d6a5f',
    lineHeight: 1.55,
    fontWeight: 650,
  },

  rules: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },

  ruleN: {
    fontSize: 13,
    fontWeight: 950,
    minWidth: 82,
  },

  ruleArrow: {
    color: '#b5a69d',
    fontSize: 13,
  },

  ruleConsequence: {
    fontSize: 12.5,
    color: '#55463f',
    fontWeight: 750,
  },

  note: {
    margin: 0,
    fontSize: 11,
    color: '#9b8a7f',
    lineHeight: 1.5,
    fontWeight: 650,
  },
};

const rm: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(44,30,24,0.42)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 16,
    backdropFilter: 'blur(5px)',
  },

  sheet: {
    background: '#fffaf5',
    border: '1px solid rgba(130,82,62,0.12)',
    borderRadius: '24px 24px 0 0',
    padding: '22px 18px 30px',
    maxWidth: 520,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 -16px 44px rgba(55,35,26,0.22)',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    color: '#2d2521',
    fontSize: 18,
    fontWeight: 950,
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: '#f4ebe3',
    color: '#8b6657',
    fontSize: 16,
    cursor: 'pointer',
  },

  sub: {
    margin: 0,
    color: '#8d7b70',
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 650,
  },

  hint: {
    margin: 0,
    color: '#9b8a7f',
    fontSize: 12,
    fontWeight: 700,
  },

  sel: {
    width: '100%',
    padding: '12px 13px',
    borderRadius: 13,
    background: '#fff',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 14,
    boxSizing: 'border-box',
    colorScheme: 'light',
  },

  woRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  woLabel: {
    color: '#55463f',
    fontSize: 13,
    fontWeight: 750,
  },

  setRow: {
    display: 'grid',
    gridTemplateColumns: '58px 1fr 20px 1fr',
    gap: 8,
    alignItems: 'center',
  },

  setLabel: {
    color: '#8f7769',
    fontSize: 12,
    fontWeight: 900,
  },

  setInp: {
    padding: '11px 12px',
    borderRadius: 12,
    border: '1px solid #eadfd6',
    background: '#fff',
    color: '#332a25',
    fontSize: 14,
    boxSizing: 'border-box',
  },

  err: {
    color: '#c95441',
    fontSize: 13,
    fontWeight: 800,
    margin: 0,
  },

  submitBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 15,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },
};
