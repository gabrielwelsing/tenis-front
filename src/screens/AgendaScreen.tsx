// =============================================================================
// AGENDA SCREEN — v2 + Reserva de Quadra + Nome Fixo
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';

interface Props {
  onBack:       () => void;
  emailUsuario: string;
  role:         'user' | 'aluno' | 'admin';
  username:     string;
  telefone?:    string | null;
}

interface Slot {
  id: number; admin_email: string; data: string; hora_inicio: string;
  hora_fim: string; tipo: string; vagas: number; observacao: string | null; status: string;
}

interface SlotDia {
  source: 'fixo' | 'manual'; fixo_id?: number; override_id?: number; slot_id?: number;
  hora_inicio: string; hora_fim: string; tipo: string; vagas: number;
  vagas_confirmadas: number; perto1h: boolean; status_manual?: string;
  observacao?: string | null; inscricoes?: Inscricao[];
  nome_fixo?: string | null;
}

interface Inscricao {
  id: number; admin_email: string; data: string; hora_inicio: string; hora_fim: string;
  email_aluno: string; nome_aluno: string; telefone_usuario: string | null;
  status: string; confirmado_admin: boolean; created_at: string; foto_url?: string | null;
}

interface HorarioFixo {
  id: number; admin_email: string; dia_semana: number;
  hora_inicio: string; hora_fim: string; ativo: boolean;
  nome?: string | null; email_vinculado?: string | null;
  valido_de?: string | null; valido_ate?: string | null;
}

interface AdminInfo { email: string; telefone: string | null; }

interface LocalQuadra {
  id: number; nome: string; endereco: string; observacao: string | null;
  socios_only: boolean; quadras: QuadraInfo[];
  responsavel_email?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
}
interface QuadraInfo { id: number; nome: string; preco_hora: number; }
interface SlotQuadra { hora_inicio: string; status: 'livre' | 'pendente' | 'confirmada' | 'fila_espera' | 'bloqueado'; }
interface ReservaQuadra {
  id: number; quadra_id: number; email_aluno: string | null; nome_reserva: string;
  whatsapp: string | null; data: string; hora_inicio: string; hora_fim: string;
  status: string; confirmado_admin: boolean; created_at: string;
}

interface UsuarioBusca {
  id: number; nome: string; email: string; telefone?: string | null; foto_url?: string | null;
}

interface ProximaAulaAdmin {
  key: string;
  origem: 'confirmada' | 'fixo';
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_aluno: string;
  email_aluno?: string | null;
  telefone_usuario?: string | null;
  foto_url?: string | null;
  inscricao_id?: number;
}

type AdminTab = 'agenda' | 'solicitacoes' | 'confirmadas' | 'historico' | 'fixos' | 'quadra_res' | 'quadra_gest';
type UserTab  = 'agenda' | 'minhas' | 'reservar';

const TIPOS = [
  { value: 'individual', label: 'Individual' },
  { value: 'coletivo',   label: 'Coletiva'   },
  { value: 'bloqueado',  label: 'Bloqueado'  },
];

const HORAS_INICIO = Array.from({ length: 33 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

const HORAS_FIM = Array.from({ length: 35 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

const COURT_SLOTS: string[] = Array.from({ length: 33 }, (_, i) => {
  const total = 7 * 60 + i * 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
});

const DIAS_QUAD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const SLOT_STATUS_LABEL: Record<string, string> = {
  livre: 'Livre', pendente: 'Pend.', confirmada: 'Ocup.', fila_espera: 'Fila', bloqueado: 'Bloq.',
};
const SLOT_STATUS_PAL: Record<string, { bg: string; color: string; border: string }> = {
  livre:       { bg: '#edf8ef', color: '#3f8f5b', border: '#bee0c8' },
  pendente:    { bg: '#fff4e8', color: '#b36a2f', border: '#f0d58a' },
  confirmada:  { bg: '#fff1eb', color: '#c66b4d', border: '#efc7b8' },
  fila_espera: { bg: '#fff8e6', color: '#b98718', border: '#f0d58a' },
  bloqueado:   { bg: '#f4ebe3', color: '#8d7b70', border: '#e5d8cf' },
};

function addCourtMin(time: string, mins: number): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  if (total > 23 * 60) return '23:00';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function courtTimeToMin(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function intervaloQuadraOcupado(slots: SlotQuadra[], inicio: string, fim: string): SlotQuadra | null {
  const iniMin = courtTimeToMin(inicio);
  const fimMin = courtTimeToMin(fim);

  return slots.find(sl => {
    const slotMin = courtTimeToMin(sl.hora_inicio);
    return slotMin >= iniMin && slotMin < fimMin && (sl.status === 'confirmada' || sl.status === 'bloqueado');
  }) ?? null;
}

function slotQuadraPermiteSolicitacao(status: SlotQuadra['status']): boolean {
  return status === 'livre' || status === 'pendente' || status === 'fila_espera';
}

function todayLocalStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowCourtMin(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function slotQuadraJaPassou(dataRef: string, horaInicio: string): boolean {
  const hoje = todayLocalStr();
  const dataOnly = dataRef.slice(0, 10);
  if (dataOnly < hoje) return true;
  if (dataOnly > hoje) return false;
  return courtTimeToMin(horaInicio) <= nowCourtMin();
}

function filtrarSlotsQuadraFuturos(slots: SlotQuadra[], dataRef: string): SlotQuadra[] {
  return slots.filter(sl => !slotQuadraJaPassou(dataRef, sl.hora_inicio));
}

function buildWaReservaQuadra(tel: string, params: {
  nomeResponsavel?: string | null;
  nomeQuadra: string;
  nomeLocal: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeReserva: string;
}) {
  const numero = '55' + tel.replace(/\D/g, '');
  const saudacao = params.nomeResponsavel ? `Olá, ${params.nomeResponsavel}!` : 'Olá!';
  const msg = encodeURIComponent(
    `${saudacao} Gostaria de solicitar a reserva da quadra ${params.nomeQuadra} (${params.nomeLocal}) no dia ${fmtDateBr(params.data)}, das ${fmt(params.horaInicio)} às ${fmt(params.horaFim)}. Nome: ${params.nomeReserva}.`
  );
  return 'https://wa.me/' + numero + '?text=' + msg;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d.length) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const TIPO_COLOR: Record<string, string> = {
  individual: '#c66b4d', coletivo: '#3f8f5b', coletiva: '#3f8f5b', bloqueado: '#8d7b70',
};
const TIPO_LABEL: Record<string, string> = {
  individual: 'Individual', coletivo: 'Coletiva', coletiva: 'Coletiva', bloqueado: 'Bloqueado',
};
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayStr() { return todayLocalStr(); }

function addDays(s: string, n: number) {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmt(t: string) { return t?.slice(0, 5) ?? ''; }

function fmtDateBr(s: string) {
  const dateOnly = s.slice(0, 10);
  const dt = new Date(dateOnly + 'T12:00:00');
  const [, m, d] = dateOnly.split('-');
  return `${DIAS[dt.getDay()]}, ${d}/${m}`;
}

function buildWaAdmin(tel: string, data: string, hi: string, hf: string, tipo: string) {
  const numero = '55' + tel.replace(/\D/g, '');
  const msg = encodeURIComponent(
    'Olá, gostaria de reservar uma aula ' + (TIPO_LABEL[tipo] ?? tipo) +
    ' no dia ' + fmtDateBr(data) + ' das ' + fmt(hi) + ' às ' + fmt(hf) + '.'
  );
  return 'https://wa.me/' + numero + '?text=' + msg;
}

function buildWaAluno(tel: string, nome: string) {
  const numero = '55' + tel.replace(/\D/g, '');
  const msg = encodeURIComponent('Olá ' + nome + ', sobre o seu horário na agenda!');
  return 'https://wa.me/' + numero + '?text=' + msg;
}

function filtrarSlotsPassados(slots: SlotDia[], data: string): SlotDia[] {
  if (data !== todayStr()) return slots;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return slots.filter(sl => {
    const [hh, mm] = sl.hora_inicio.slice(0, 5).split(':').map(Number);
    return hh * 60 + mm > nowMin;
  });
}

function inscricaoJaPassou(insc: Inscricao): boolean {
  const hoje = todayStr();
  const dataInscricao = insc.data.slice(0, 10);
  if (dataInscricao < hoje) return true;
  if (dataInscricao > hoje) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const horaBase = (insc.hora_fim || insc.hora_inicio).slice(0, 5);
  const [hh, mm] = horaBase.split(':').map(Number);
  return hh * 60 + mm <= nowMin;
}

function ordenarInscricoesAsc(a: Inscricao, b: Inscricao): number {
  const dataA = `${a.data.slice(0, 10)}T${fmt(a.hora_inicio)}:00`;
  const dataB = `${b.data.slice(0, 10)}T${fmt(b.hora_inicio)}:00`;
  return new Date(dataA).getTime() - new Date(dataB).getTime();
}

function ordenarInscricoesDesc(a: Inscricao, b: Inscricao): number {
  return ordenarInscricoesAsc(b, a);
}


function horarioFixoValidoNaData(h: HorarioFixo, dataRef: string): boolean {
  if (!h.ativo || !h.nome?.trim()) return false;
  const dataOnly = dataRef.slice(0, 10);
  const dt = new Date(dataOnly + 'T12:00:00');
  if (dt.getDay() !== h.dia_semana) return false;
  if (h.valido_de && dataOnly < String(h.valido_de).slice(0, 10)) return false;
  if (h.valido_ate && dataOnly > String(h.valido_ate).slice(0, 10)) return false;
  return true;
}

function horarioFixoJaPassou(dataRef: string, horaFim: string): boolean {
  const hoje = todayStr();
  const dataOnly = dataRef.slice(0, 10);
  if (dataOnly < hoje) return true;
  if (dataOnly > hoje) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [hh, mm] = horaFim.slice(0, 5).split(':').map(Number);
  return hh * 60 + mm <= nowMin;
}

function montarProximasAulasFixas(horarios: HorarioFixo[], dias = 30): ProximaAulaAdmin[] {
  const hoje = todayStr();
  const aulas: ProximaAulaAdmin[] = [];

  for (let i = 0; i <= dias; i++) {
    const dataRef = addDays(hoje, i);
    horarios.forEach(h => {
      if (!horarioFixoValidoNaData(h, dataRef)) return;
      if (horarioFixoJaPassou(dataRef, h.hora_fim)) return;
      aulas.push({
        key: `fixo-${h.id}-${dataRef}`,
        origem: 'fixo',
        data: dataRef,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        nome_aluno: h.nome?.trim() || 'Horário fixo',
        email_aluno: h.email_vinculado ?? null,
      });
    });
  }

  return aulas.sort((a, b) => {
    const da = `${a.data.slice(0, 10)}T${fmt(a.hora_inicio)}:00`;
    const db = `${b.data.slice(0, 10)}T${fmt(b.hora_inicio)}:00`;
    return new Date(da).getTime() - new Date(db).getTime();
  });
}


function montarAulasFixasNoDia(horarios: HorarioFixo[], dataRef: string, incluirPassadas = false): ProximaAulaAdmin[] {
  return horarios
    .filter(h => horarioFixoValidoNaData(h, dataRef))
    .filter(h => incluirPassadas || !horarioFixoJaPassou(dataRef, h.hora_fim))
    .map(h => ({
      key: `fixo-${h.id}-${dataRef}`,
      origem: 'fixo' as const,
      data: dataRef,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      nome_aluno: h.nome?.trim() || 'Horário fixo',
      email_aluno: h.email_vinculado ?? null,
    }))
    .sort((a, b) => fmt(a.hora_inicio).localeCompare(fmt(b.hora_inicio)));
}

function montarAulasFixasHistorico(horarios: HorarioFixo[], diasParaTras = 60): ProximaAulaAdmin[] {
  const hoje = todayStr();
  const aulas: ProximaAulaAdmin[] = [];

  for (let i = 0; i <= diasParaTras; i++) {
    const dataRef = addDays(hoje, -i);
    montarAulasFixasNoDia(horarios, dataRef, true).forEach(aula => {
      if (horarioFixoJaPassou(aula.data, aula.hora_fim)) aulas.push(aula);
    });
  }

  return aulas.sort((a, b) => {
    const da = `${a.data.slice(0, 10)}T${fmt(a.hora_inicio)}:00`;
    const db = `${b.data.slice(0, 10)}T${fmt(b.hora_inicio)}:00`;
    return new Date(db).getTime() - new Date(da).getTime();
  });
}

function ordenarAulasAdminAsc(a: ProximaAulaAdmin, b: ProximaAulaAdmin): number {
  const da = `${a.data.slice(0, 10)}T${fmt(a.hora_inicio)}:00`;
  const db = `${b.data.slice(0, 10)}T${fmt(b.hora_inicio)}:00`;
  return new Date(da).getTime() - new Date(db).getTime();
}

function ordenarAulasAdminDesc(a: ProximaAulaAdmin, b: ProximaAulaAdmin): number {
  return ordenarAulasAdminAsc(b, a);
}

function CalendarLineIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.9"/>
      <path d="M8 4v3.4M16 4v3.4M4.7 10h14.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  );
}

function ClockLineIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.9"/>
      <path d="M12 7.6v4.6l3 1.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NoteLineIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4.8h12v14.4H6V4.8Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
      <path d="M8.8 9h6.4M8.8 12h6.4M8.8 15h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  );
}

function UserOutlineIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4.8 20.2c1.35-4.1 4.05-6.15 7.2-6.15s5.85 2.05 7.2 6.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function WaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function DateNav({ data, setData }: { data: string; setData: (d: string) => void }) {
  const isToday  = data === todayStr();
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div style={dn.wrap}>
      <button style={dn.arrow} onClick={() => setData(addDays(data, -1))}>‹</button>
      <div style={{ position: 'relative' }}>
        <button style={dn.label} onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.click()}>
          <CalendarLineIcon size={15}/>
          <span>{isToday ? 'Hoje' : fmtDateBr(data)}</span>
        </button>
        <input ref={inputRef} type="date" value={data} onChange={e => e.target.value && setData(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2, colorScheme: 'light' }} />
      </div>
      <button style={dn.arrow} onClick={() => setData(addDays(data, 1))}>›</button>
    </div>
  );
}

function CalendarPicker({ data, setData }: { data: string; setData: (d: string) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div style={{ ...s.sectionIcon, cursor: 'pointer', position: 'relative' }}
      onClick={() => ref.current?.showPicker?.() ?? ref.current?.click()}>
      <CalendarLineIcon size={22}/>
      <input ref={ref} type="date" value={data} onChange={e => e.target.value && setData(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }} />
    </div>
  );
}

function avatarEl(nome: string, foto: string | null | undefined, size = 30) {
  if (foto) return <img src={foto} alt={nome} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#c6714e,#8f4635)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.fieldGroup}>
      <span style={s.label}>{label}</span>
      {children}
    </div>
  );
}

function InfoItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={sc.infoItem}>
      <span style={sc.infoIcon}>{icon}</span>
      <span style={sc.infoText}>{text}</span>
    </div>
  );
}

// =============================================================================
export default function AgendaScreen({ onBack, emailUsuario, role, username, telefone }: Props) {
  const isAdmin = role === 'admin';

  const [data,          setData]          = useState(todayStr());
  const [dataConfirmadas, setDataConfirmadas] = useState(todayStr());
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [adminInfo,     setAdminInfo]     = useState<AdminInfo | null>(null);
  const [adminTab,      setAdminTab]      = useState<AdminTab>('agenda');
  const [userTab,       setUserTab]       = useState<UserTab>('agenda');

  const [slots,            setSlots]            = useState<Slot[]>([]);
  const [slotsDia,         setSlotsDia]         = useState<SlotDia[]>([]);
  const [solicitacoes,     setSolicitacoes]     = useState<Inscricao[]>([]);
  const [horariosFixos,    setHorariosFixos]    = useState<HorarioFixo[]>([]);
  const [proximoEspera,    setProximoEspera]    = useState<Inscricao | null>(null);
  const [minhasInscricoes, setMinhasInscricoes] = useState<Inscricao[]>([]);

  const [showForm,         setShowForm]         = useState(false);
  const [form,             setForm]             = useState({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, observacao: '' });
  const [showFormFixo,     setShowFormFixo]     = useState(false);
  const [formFixo,         setFormFixo]         = useState({ dia_semana: 1, hora_inicio: '07:00', hora_fim: '08:00' });
  const [editandoOverride, setEditandoOverride] = useState<string | null>(null);
  const [formOverride,     setFormOverride]     = useState({ tipo: 'individual', vagas: 1 });

  // ── Nome fixo ──────────────────────────────────────────────────────────────
  const [editandoNomeFixoId, setEditandoNomeFixoId] = useState<number | null>(null);
  const [formNomeFixo,       setFormNomeFixo]       = useState({ nome: '', email_vinculado: '', valido_de: '', valido_ate: '' });
  const [sugestoesNomeFixo,  setSugestoesNomeFixo]  = useState<UsuarioBusca[]>([]);
  const [buscandoNomeFixo,   setBuscandoNomeFixo]   = useState(false);

  // ── Quadra ─────────────────────────────────────────────────────────────────
  const [locaisQuadra,      setLocaisQuadra]      = useState<LocalQuadra[]>([]);
  const [localQuadraId,     setLocalQuadraId]     = useState<number>(2);
  const [quadraId,          setQuadraId]          = useState<number>(6);
  const [dataQuadra,        setDataQuadra]        = useState(todayStr());
  const [slotsQuadra,       setSlotsQuadra]       = useState<SlotQuadra[]>([]);
  const [loadingSlots,      setLoadingSlots]      = useState(false);
  const [reservaHoraInicio, setReservaHoraInicio] = useState('');
  const [reservaHoraFim,    setReservaHoraFim]    = useState('');
  const [reservaNome,       setReservaNome]       = useState(username ?? '');
  const [reservaWhatsapp,   setReservaWhatsapp]   = useState(() => {
    if (!telefone) return '';
    const d = telefone.replace(/\D/g, '').slice(0, 11);
    if (d.length > 7) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return d;
  });
  const [reservaLoading, setReservaLoading] = useState(false);
  const [showReservaQuadraModal, setShowReservaQuadraModal] = useState(false);
  const [reservasAdmin,  setReservasAdmin]  = useState<ReservaQuadra[]>([]);
  const [dispConfig,     setDispConfig]     = useState<{ dias_semana: number[]; hi_text: string; hf_text: string } | null>(null);
  const [formDisp,       setFormDisp]       = useState({ dias_semana: [1,2,3,4,5,6], hi_text: '07:00', hf_text: '22:00' });
  const [formBloqueio,   setFormBloqueio]   = useState({ data: todayStr(), hi_text: '', hf_text: '', motivo: '' });
  const [bloqueios,      setBloqueios]      = useState<any[]>([]);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  useEffect(() => {
    fetch(API + '/agenda/admin-info').then(r => r.json()).then(setAdminInfo).catch(() => {});
  }, []);

  const loadSlotsDia = useCallback(async () => {
    if (!adminInfo?.email) return;
    setLoading(true);
    try {
      const url = API + '/agenda/dia?admin_email=' + encodeURIComponent(adminInfo.email) + '&data=' + data + '&role=' + role;
      const r = await fetch(url);
      const json = await r.json();
      setSlotsDia(Array.isArray(json) ? json : []);
    } catch { flash('err', 'Erro ao carregar horários.'); }
    setLoading(false);
  }, [adminInfo, data, role]);

  const loadSlots = useCallback(async () => {
    if (!adminInfo?.email) return;
    try {
      const rota = isAdmin ? 'slots/admin' : 'slots';
      const url = API + '/agenda/' + rota + '?admin_email=' + encodeURIComponent(adminInfo.email) + '&data=' + data;
      const r = await fetch(url);
      setSlots(await r.json());
    } catch { /* silent */ }
  }, [adminInfo, data, isAdmin]);

  const loadSolicitacoes = useCallback(async () => {
    if (!adminInfo?.email || !isAdmin) return;
    try {
      const url = API + '/agenda/solicitacoes?admin_email=' + encodeURIComponent(adminInfo.email) + '&incluir_historico=1';
      const r = await fetch(url);
      const json = await r.json();
      setSolicitacoes(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [adminInfo, isAdmin]);

  const loadHorariosFixos = useCallback(async () => {
    if (!adminInfo?.email || !isAdmin) return;
    try {
      const url = API + '/agenda/horarios-fixos?admin_email=' + encodeURIComponent(adminInfo.email);
      const r = await fetch(url);
      const json = await r.json();
      setHorariosFixos(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [adminInfo, isAdmin]);

  const loadMinhasInscricoes = useCallback(async () => {
    if (!adminInfo?.email || isAdmin) return;
    try {
      const url = API + '/agenda/minhas-inscricoes?email_aluno=' + encodeURIComponent(emailUsuario) + '&admin_email=' + encodeURIComponent(adminInfo.email);
      const r = await fetch(url);
      const json = await r.json();
      setMinhasInscricoes(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [adminInfo, emailUsuario, isAdmin]);

  useEffect(() => { loadSlotsDia(); loadSlots(); loadMinhasInscricoes(); }, [loadSlotsDia, loadSlots, loadMinhasInscricoes]);
  useEffect(() => { loadSolicitacoes(); loadHorariosFixos(); }, [loadSolicitacoes, loadHorariosFixos]);

  const loadLocaisQuadra = useCallback(async () => {
    try {
      const r = await fetch(`${API}/quadras/locais/todos`);
      const json = await r.json();
      setLocaisQuadra(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, []);

  const loadSlotsQuadra = useCallback(async () => {
    if (!quadraId) return;
    setLoadingSlots(true);
    try {
      const r = await fetch(`${API}/quadras/${quadraId}/slots?data=${dataQuadra}`);
      const json = await r.json();
      setSlotsQuadra(json.slots || []);
    } catch { setSlotsQuadra([]); }
    setLoadingSlots(false);
  }, [quadraId, dataQuadra]);

  const loadReservasAdmin = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch(`${API}/quadras/${quadraId}/reservas/admin`);
      const json = await r.json();
      setReservasAdmin(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [isAdmin, quadraId]);

  const loadDispConfig = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch(`${API}/quadras/${quadraId}/disponibilidade/config`);
      const json = await r.json();
      if (Array.isArray(json) && json.length > 0) {
        const row = json[0];
        const cfg = { dias_semana: row.dias_semana, hi_text: row.hi_text || '07:00', hf_text: row.hf_text || '22:00' };
        setDispConfig(cfg); setFormDisp(cfg);
      }
    } catch { /* silent */ }
  }, [isAdmin, quadraId]);

  const loadBloqueios = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch(`${API}/quadras/${quadraId}/bloqueios`);
      const json = await r.json();
      setBloqueios(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [isAdmin, quadraId]);

  useEffect(() => { loadLocaisQuadra(); }, []);
  useEffect(() => { loadSlotsQuadra(); }, [loadSlotsQuadra]);
  useEffect(() => {
    if (isAdmin) { loadReservasAdmin(); loadDispConfig(); loadBloqueios(); }
  }, [loadReservasAdmin, loadDispConfig, loadBloqueios]);
  useEffect(() => {
    const local = locaisQuadra.find(l => l.id === localQuadraId);
    if (local?.quadras.length) setQuadraId(local.quadras[0].id);
  }, [localQuadraId, locaisQuadra]);
  useEffect(() => {
    if (!reservaHoraInicio) return;
    const minFim = addCourtMin(reservaHoraInicio, 60);
    if (!reservaHoraFim || reservaHoraFim < minFim) setReservaHoraFim(minFim);
  }, [reservaHoraInicio]);

  useEffect(() => {
    const hoje = todayLocalStr();
    if (dataQuadra < hoje) setDataQuadra(hoje);
  }, [dataQuadra]);

  const setDataQuadraSegura = (novaData: string) => {
    const hoje = todayLocalStr();
    if (novaData < hoje) {
      setDataQuadra(hoje);
      return;
    }
    setDataQuadra(novaData);
  };

  useEffect(() => {
    const termo = formNomeFixo.nome.trim();

    if (!isAdmin || editandoNomeFixoId === null || termo.length < 2) {
      setSugestoesNomeFixo([]);
      setBuscandoNomeFixo(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setBuscandoNomeFixo(true);
      try {
        const r = await fetch(`${API}/auth/users/search?q=${encodeURIComponent(termo)}`);
        const json = await r.json();
        setSugestoesNomeFixo(Array.isArray(json) ? json : []);
      } catch {
        setSugestoesNomeFixo([]);
      }
      setBuscandoNomeFixo(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [formNomeFixo.nome, editandoNomeFixoId, isAdmin]);

  const selecionarUsuarioNomeFixo = (usuario: UsuarioBusca) => {
    setFormNomeFixo(f => ({ ...f, nome: usuario.nome, email_vinculado: usuario.email }));
    setSugestoesNomeFixo([]);
  };

  // ── Actions agenda ─────────────────────────────────────────────────────────
  const saveSlot = async () => {
    if (!adminInfo?.email) return;
    setLoading(true);
    try {
      const r = await fetch(API + '/agenda/slots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminInfo.email, data, ...form }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Horário criado!');
      setShowForm(false);
      setForm({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, observacao: '' });
      loadSlotsDia();
    } catch { flash('err', 'Erro ao salvar.'); }
    setLoading(false);
  };

  const deleteSlot = async (id: number) => {
    if (!confirm('Cancelar este horário?')) return;
    await fetch(API + '/agenda/slots/' + id, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo?.email }),
    });
    flash('ok', 'Horário cancelado.');
    loadSlotsDia();
  };

  const toggleOcupado = async (slot: Slot) => {
    const ocupado = slot.status !== 'ocupado';
    await fetch(API + '/agenda/slots/' + slot.id + '/ocupado', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo?.email, ocupado }),
    });
    flash('ok', ocupado ? 'Marcado como ocupado.' : 'Marcado como disponível.');
    loadSlotsDia();
  };

  const toggleOcupadoPorId = async (slotId: number, statusAtual: string) => {
    await toggleOcupado({ id: slotId, status: statusAtual } as Slot);
  };

  const solicitarReserva = async (slot: SlotDia) => {
    if (!adminInfo?.email) return;
    try {
      const r = await fetch(API + '/agenda/reservas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_email: adminInfo.email, data,
          hora_inicio: slot.hora_inicio, hora_fim: slot.hora_fim,
          email_aluno: emailUsuario, nome_aluno: username,
          telefone_usuario: telefone ?? null,
        }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Reserva solicitada! Aguarde a confirmação.');
      loadSlotsDia(); loadMinhasInscricoes();
    } catch { flash('err', 'Erro de conexão.'); }
  };

  const confirmarReserva = async (id: number) => {
    if (!adminInfo?.email) return;
    try {
      const r = await fetch(API + '/agenda/reservas/' + id + '/confirmar', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminInfo.email }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Reserva confirmada!');
      loadSolicitacoes(); loadSlotsDia();
    } catch { flash('err', 'Erro ao confirmar.'); }
  };

  const cancelarReserva = async (id: number) => {
    if (!adminInfo?.email) return;
    try {
      const r = await fetch(API + '/agenda/reservas/' + id + '/cancelar', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminInfo.email }),
      });
      const json = await r.json();
      flash('ok', 'Inscrição cancelada.');
      if (json.proximo_espera) {
        setProximoEspera(json.proximo_espera);
        setTimeout(() => setProximoEspera(null), 10000);
      }
      loadSolicitacoes(); loadSlotsDia();
    } catch { flash('err', 'Erro ao cancelar.'); }
  };

  const salvarOverride = async (slot: SlotDia) => {
    if (!adminInfo?.email) return;
    try {
      await fetch(API + '/agenda/slot-override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_email: adminInfo.email, data,
          hora_inicio: slot.hora_inicio, hora_fim: slot.hora_fim,
          tipo: formOverride.tipo, vagas: formOverride.vagas, status: 'ativo',
        }),
      });
      flash('ok', 'Configuração salva para este dia!');
      setEditandoOverride(null); loadSlotsDia();
    } catch { flash('err', 'Erro ao salvar.'); }
  };

  const cancelarSlotDia = async (slot: SlotDia) => {
    if (!confirm('Cancelar este horário apenas neste dia?')) return;
    if (!adminInfo?.email) return;
    try {
      await fetch(API + '/agenda/slot-override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_email: adminInfo.email, data,
          hora_inicio: slot.hora_inicio, hora_fim: slot.hora_fim,
          tipo: slot.tipo, vagas: slot.vagas, status: 'cancelado',
        }),
      });
      flash('ok', 'Horário cancelado para este dia.');
      loadSlotsDia();
    } catch { flash('err', 'Erro ao cancelar.'); }
  };

  const adicionarHorarioFixo = async () => {
    if (!adminInfo?.email) return;
    try {
      const r = await fetch(API + '/agenda/horarios-fixos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminInfo.email, ...formFixo }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Horário fixo adicionado!');
      setShowFormFixo(false);
      loadHorariosFixos(); loadSlotsDia();
    } catch { flash('err', 'Erro ao adicionar.'); }
  };

  const removerHorarioFixo = async (id: number) => {
    if (!confirm('Remover este horário fixo da grade permanentemente?')) return;
    if (!adminInfo?.email) return;
    await fetch(API + '/agenda/horarios-fixos/' + id, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo.email }),
    });
    flash('ok', 'Horário fixo removido.');
    loadHorariosFixos(); loadSlotsDia();
  };

  // ── Actions nome fixo ──────────────────────────────────────────────────────
  const salvarNomeFixo = async (id: number) => {
    if (!adminInfo?.email) return;
    try {
      await fetch(`${API}/agenda/horarios-fixos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminInfo.email, ...formNomeFixo }),
      });
      flash('ok', 'Nome fixado!');
      setEditandoNomeFixoId(null);
      setSugestoesNomeFixo([]);
      loadHorariosFixos(); loadSlotsDia();
    } catch { flash('err', 'Erro ao salvar.'); }
  };

  const removerNomeFixo = async (id: number) => {
    if (!adminInfo?.email) return;
    await fetch(`${API}/agenda/horarios-fixos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo.email, nome: null, email_vinculado: null, valido_de: null, valido_ate: null }),
    });
    flash('ok', 'Nome removido.');
    setSugestoesNomeFixo([]);
    loadHorariosFixos(); loadSlotsDia();
  };

  // ── Actions quadra ─────────────────────────────────────────────────────────
  const abrirModalReservaQuadra = (slot: SlotQuadra) => {
    if (slotQuadraJaPassou(dataQuadra, slot.hora_inicio)) {
      flash('err', 'Este horário já passou.');
      return;
    }

    if (!slotQuadraPermiteSolicitacao(slot.status)) {
      flash('err', 'Este horário não está disponível.');
      return;
    }

    const fimPadrao = addCourtMin(slot.hora_inicio, 60);
    const bloqueioPadrao = intervaloQuadraOcupado(slotsQuadra, slot.hora_inicio, fimPadrao);

    setReservaHoraInicio(slot.hora_inicio);
    setReservaHoraFim(fimPadrao);
    setShowReservaQuadraModal(true);

    if (bloqueioPadrao) {
      flash('err', `O horário mínimo de 1h passa por ${bloqueioPadrao.hora_inicio}, que já está ocupado.`);
    }
  };

  const fecharModalReservaQuadra = () => {
    if (reservaLoading) return;
    setShowReservaQuadraModal(false);
    setReservaHoraInicio('');
    setReservaHoraFim('');
  };

  const solicitarReservaQuadra = async () => {
    if (dataQuadra < todayLocalStr()) { flash('err', 'Não é possível reservar em data anterior a hoje.'); return; }
    if (!reservaHoraInicio || !reservaHoraFim) { flash('err', 'Selecione horário de início e fim.'); return; }
    if (slotQuadraJaPassou(dataQuadra, reservaHoraInicio)) { flash('err', 'Este horário já passou.'); return; }
    if (courtTimeToMin(reservaHoraFim) <= courtTimeToMin(reservaHoraInicio)) { flash('err', 'O horário final precisa ser maior que o início.'); return; }
    if (courtTimeToMin(reservaHoraFim) - courtTimeToMin(reservaHoraInicio) < 60) { flash('err', 'A reserva mínima é de 1 hora.'); return; }
    if (!reservaNome.trim()) { flash('err', 'Informe seu nome.'); return; }

    const digits = reservaWhatsapp.replace(/\D/g, '');
    if (digits.length < 10) { flash('err', 'WhatsApp inválido.'); return; }

    const localSel = locaisQuadra.find(l => l.id === localQuadraId);
    const quadraSel = localSel?.quadras.find(q => q.id === quadraId);
    const responsavelTelefone = localSel?.responsavel_telefone || adminInfo?.telefone || '';

    const bloqueio = intervaloQuadraOcupado(slotsQuadra, reservaHoraInicio, reservaHoraFim);
    if (bloqueio) {
      flash('err', `Esse intervalo passa por ${bloqueio.hora_inicio}, que já está ocupado. Escolha outro horário.`);
      return;
    }

    const conflito = minhasInscricoes.some(i =>
      i.status === 'confirmada' &&
      i.data.slice(0, 10) === dataQuadra &&
      fmt(i.hora_inicio) < reservaHoraFim &&
      fmt(i.hora_fim) > reservaHoraInicio
    );
    if (conflito) { flash('err', 'Você tem aula confirmada neste horário.'); return; }

    setReservaLoading(true);
    try {
      const r = await fetch(`${API}/quadras/reservas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quadra_id: quadraId, email_aluno: emailUsuario,
          nome_reserva: reservaNome.trim(), whatsapp: digits,
          data: dataQuadra, hora_inicio: reservaHoraInicio, hora_fim: reservaHoraFim,
        }),
      });

      const json = await r.json();
      if (!r.ok) { flash('err', json.error ?? 'Erro.'); return; }

      flash('ok', json.fila ? 'Você entrou na fila de espera!' : 'Solicitação enviada! Aguarde a confirmação.');

      if (responsavelTelefone) {
        window.open(
          buildWaReservaQuadra(responsavelTelefone, {
            nomeResponsavel: localSel?.responsavel_nome ?? (adminInfo?.telefone ? 'Carlão' : null),
            nomeQuadra: quadraSel?.nome ?? 'selecionada',
            nomeLocal: localSel?.nome ?? 'local selecionado',
            data: dataQuadra,
            horaInicio: reservaHoraInicio,
            horaFim: reservaHoraFim,
            nomeReserva: reservaNome.trim(),
          }),
          '_blank'
        );
      } else {
        flash('err', 'Solicitação criada, mas o responsável da quadra está sem WhatsApp cadastrado.');
      }

      setShowReservaQuadraModal(false);
      setReservaHoraInicio('');
      setReservaHoraFim('');
      loadSlotsQuadra();
    } catch {
      flash('err', 'Erro de conexão.');
    }

    setReservaLoading(false);
  };

  const confirmarReservaAdmin = async (id: number) => {
    try {
      const r = await fetch(`${API}/quadras/reservas/${id}/confirmar`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) { flash('err', 'Erro ao confirmar.'); return; }
      flash('ok', 'Reserva confirmada!');
      loadReservasAdmin(); loadSlotsQuadra();
    } catch { flash('err', 'Erro.'); }
  };

  const cancelarReservaAdmin = async (id: number) => {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      await fetch(`${API}/quadras/reservas/${id}/cancelar`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
      flash('ok', 'Reserva cancelada. Próximo da fila foi notificado.');
      loadReservasAdmin(); loadSlotsQuadra();
    } catch { flash('err', 'Erro.'); }
  };

  const salvarDisponibilidade = async () => {
    if (!formDisp.dias_semana.length) { flash('err', 'Selecione ao menos um dia.'); return; }
    try {
      const r = await fetch(`${API}/quadras/disponibilidade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quadra_id: quadraId, ...formDisp }),
      });
      if (!r.ok) { flash('err', 'Erro ao salvar.'); return; }
      flash('ok', 'Disponibilidade salva!');
      loadDispConfig(); loadSlotsQuadra();
    } catch { flash('err', 'Erro.'); }
  };

  const adicionarBloqueio = async () => {
    if (!formBloqueio.data || !formBloqueio.hi_text || !formBloqueio.hf_text) { flash('err', 'Preencha data e horários.'); return; }
    try {
      await fetch(`${API}/quadras/bloqueios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quadra_id: quadraId, ...formBloqueio }),
      });
      flash('ok', 'Bloqueio adicionado!');
      setFormBloqueio(f => ({ ...f, hi_text: '', hf_text: '', motivo: '' }));
      loadBloqueios(); loadSlotsQuadra();
    } catch { flash('err', 'Erro.'); }
  };

  const removerBloqueio = async (id: number) => {
    await fetch(`${API}/quadras/bloqueios/${id}`, { method: 'DELETE' });
    flash('ok', 'Bloqueio removido.');
    loadBloqueios(); loadSlotsQuadra();
  };

  // ── Renders ────────────────────────────────────────────────────────────────

  const renderSlotDiaCard = (slot: SlotDia) => {
    const hi            = slot.hora_inicio;
    const cor           = TIPO_COLOR[slot.tipo] ?? '#c66b4d';
    const isEditing     = editandoOverride === hi;
    const isBloqueado   = slot.tipo === 'bloqueado';
    const manualOcupado = slot.source === 'manual' && slot.status_manual === 'ocupado';
    const vagasDisp     = slot.vagas - slot.vagas_confirmadas;
    const estaOcupado   = !isBloqueado && !manualOcupado && vagasDisp <= 0;
    const minhaInscricao =
      slot.inscricoes?.find(i => i.email_aluno === emailUsuario && i.status !== 'cancelada') ??
      minhasInscricoes.find(i =>
        i.data.slice(0, 10) === data &&
        i.hora_inicio.slice(0, 5) === slot.hora_inicio.slice(0, 5) &&
        i.status !== 'cancelada'
      );
    const corBorda = isBloqueado || ((estaOcupado || manualOcupado) && !minhaInscricao) ? '#d4c5bb' : cor;

    const abrirWaAdmin = () => {
      if (adminInfo?.telefone) window.open(buildWaAdmin(adminInfo.telefone, data, slot.hora_inicio, slot.hora_fim, slot.tipo), '_blank');
    };

    return (
      <div key={hi} style={{ ...sc.card, borderLeft: '4px solid ' + corBorda }}>
        <div style={sc.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
            <span style={{ ...sc.badge, color: isBloqueado || estaOcupado ? '#8d7b70' : cor, background: (isBloqueado || estaOcupado ? '#8d7b70' : cor) + '16', borderColor: (isBloqueado || estaOcupado ? '#8d7b70' : cor) + '33' }}>
              {TIPO_LABEL[slot.tipo] ?? slot.tipo}
            </span>
            {(estaOcupado || manualOcupado) && !minhaInscricao && <span style={sc.ocupadoBadge}>Ocupado</span>}
            {isBloqueado && <span style={sc.ocupadoBadge}>Bloqueado</span>}
          </div>
          {isAdmin && !isEditing && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {slot.source === 'fixo' && (
                <>
                  <button style={sc.editBtn} onClick={() => { setEditandoOverride(hi); setFormOverride({ tipo: slot.tipo, vagas: slot.vagas }); }}>Editar dia</button>
                  <button style={sc.delBtn} onClick={() => cancelarSlotDia(slot)}>✕</button>
                </>
              )}
              {slot.source === 'manual' && (
                <>
                  {!isBloqueado && (
                    <button style={{ ...sc.ocupadoBtn, background: manualOcupado ? '#edf8ef' : '#fff4e8', color: manualOcupado ? '#3f8f5b' : '#b36a2f', borderColor: manualOcupado ? 'rgba(63,143,91,0.22)' : 'rgba(179,106,47,0.22)' }}
                      onClick={() => slot.slot_id && toggleOcupadoPorId(slot.slot_id, slot.status_manual ?? 'ativo')}>
                      {manualOcupado ? 'Liberar' : 'Ocupar'}
                    </button>
                  )}
                  <button style={sc.delBtn} onClick={() => slot.slot_id && deleteSlot(slot.slot_id)}>✕</button>
                </>
              )}
            </div>
          )}
        </div>

        {isAdmin && isEditing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0 4px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={s.label}>Tipo neste dia</span>
                <select style={s.select} value={formOverride.tipo} onChange={e => setFormOverride(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="individual">Individual</option>
                  <option value="coletivo">Coletiva</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
              {formOverride.tipo !== 'bloqueado' && (
                <div style={{ flex: 0.55 }}>
                  <span style={s.label}>Vagas</span>
                  <input style={s.input} type="number" min={1} max={10} value={formOverride.vagas}
                    onChange={e => setFormOverride(f => ({ ...f, vagas: Number(e.target.value) }))}/>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 13, fontWeight: 850, cursor: 'pointer' }} onClick={() => salvarOverride(slot)}>Salvar</button>
              <button style={{ flex: 0.6, padding: '10px 0', borderRadius: 12, border: '1px solid #eadfd6', background: '#fff', color: '#8f7769', fontSize: 13, cursor: 'pointer' }} onClick={() => setEditandoOverride(null)}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={sc.timeRow}>
          <ClockLineIcon size={18}/>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#2d2521' }}>{fmt(slot.hora_inicio)} – {fmt(slot.hora_fim)}</span>
          {!isBloqueado && (
            <span style={{ fontSize: 12, color: '#94857a', marginLeft: 4 }}>
              {slot.tipo === 'individual' ? '1 vaga' : slot.vagas_confirmadas + '/' + slot.vagas + ' vagas'}
            </span>
          )}
        </div>

        {slot.observacao && <InfoItem icon={<NoteLineIcon size={16}/>} text={slot.observacao}/>}

        {/* ── Nome fixado — visível só para admin ── */}
        {isAdmin && slot.nome_fixo && (
          <div style={{ background: '#fff8e6', border: '1px solid #f0d58a', borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>📌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#b98718' }}>{slot.nome_fixo}</div>
              <div style={{ fontSize: 11, color: '#94857a', fontWeight: 650 }}>Horário fixado</div>
            </div>
          </div>
        )}

        {isAdmin && slot.inscricoes && slot.inscricoes.length > 0 && (
          <div style={{ borderTop: '1px solid #f4ebe3', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 850, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Inscritos</span>
            {slot.inscricoes.map(insc => (
              <div key={insc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12, background: insc.status === 'confirmada' ? '#edf8ef' : insc.status === 'lista_espera' ? '#fff8e6' : '#fffaf7', border: '1px solid ' + (insc.status === 'confirmada' ? '#bee0c8' : insc.status === 'lista_espera' ? '#f0d58a' : '#eadfd6'), boxShadow: proximoEspera?.id === insc.id ? '0 0 0 2px #c66b4d' : 'none' }}>
                {avatarEl(insc.nome_aluno, insc.foto_url, 28)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{insc.nome_aluno}</div>
                  <div style={{ fontSize: 11, color: insc.status === 'confirmada' ? '#3f8f5b' : insc.status === 'lista_espera' ? '#b98718' : '#94857a', fontWeight: 700 }}>
                    {insc.status === 'confirmada' ? '✓ Confirmado' : insc.status === 'lista_espera' ? '⏳ Lista de espera' : '• Pendente'}
                    {proximoEspera?.id === insc.id ? ' ← próximo!' : ''}
                  </div>
                </div>
                {insc.telefone_usuario && (
                  <button onClick={() => window.open(buildWaAluno(insc.telefone_usuario!, insc.nome_aluno), '_blank')} style={{ width: 28, height: 28, borderRadius: '50%', background: '#edf8ef', border: '1px solid #bee0c8', color: '#3f8f5b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <WaIcon/>
                  </button>
                )}
                {insc.status !== 'confirmada' && insc.status !== 'cancelada' && (
                  <button style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => confirmarReserva(insc.id)}>✓</button>
                )}
                {insc.status !== 'cancelada' && (
                  <button style={sc.delBtn} onClick={() => cancelarReserva(insc.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isAdmin && !isBloqueado && !manualOcupado && (
          <div>
            {minhaInscricao ? (
              <div style={{ textAlign: 'center' as const, fontSize: 13, fontWeight: 700, padding: '10px 0', color: minhaInscricao.status === 'confirmada' ? '#3f8f5b' : minhaInscricao.status === 'lista_espera' ? '#b98718' : '#c66b4d' }}>
                {minhaInscricao.status === 'confirmada' ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>✓ Confirmado comigo</div>
                    <div style={{ fontSize: 11, color: '#3f8f5b', fontWeight: 600 }}>{minhaInscricao.nome_aluno}</div>
                  </>
                ) : minhaInscricao.status === 'lista_espera'
                  ? '⏳ Você está na lista de espera'
                  : '⏳ Solicitação enviada — aguardando confirmação'}
              </div>
            
            ) : estaOcupado ? (
              slot.source === 'fixo' ? (
                <button style={sc.reservarBtn} onClick={() => solicitarReserva(slot)}>
                  Entrar na lista de espera
                </button>
              ) : (
                <div style={sc.ocupadoInfo}>Ocupado</div>
              )
            ) : slot.perto1h ? (
            
              <button onClick={abrirWaAdmin} style={sc.waBtn}><WaIcon/> Entre em contato para informar interesse</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...sc.reservarBtn, flex: '0 0 65%' }} onClick={() => solicitarReserva(slot)}>Reservar</button>
                {adminInfo?.telefone && (
                  <button onClick={abrirWaAdmin} style={{ flex: '0 0 calc(35% - 8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: 'linear-gradient(135deg, #1b8f45, #146d35)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 10px 20px rgba(27,143,69,0.18)' }}>
                    <WaIcon/>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!isAdmin && (isBloqueado || manualOcupado) && (
          <div style={sc.ocupadoInfo}>{isBloqueado ? 'Horário bloqueado' : 'Ocupado'}</div>
        )}
      </div>
    );
  };

  const renderMinhasAulas = () => {
    if (minhasInscricoes.length === 0) {
      return (
        <div style={s.emptyFeed}>
          <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
          <p style={s.emptyText}>Nenhuma aula inscrita.</p>
          <p style={s.emptyHint}>Quando você reservar um horário, ele aparecerá aqui.</p>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {minhasInscricoes.map(insc => {
          const cor = insc.status === 'confirmada' ? '#3f8f5b' : insc.status === 'lista_espera' ? '#b98718' : '#c66b4d';
          const bg  = insc.status === 'confirmada' ? '#edf8ef' : insc.status === 'lista_espera' ? '#fff8e6' : '#fff1eb';
          const bd  = insc.status === 'confirmada' ? '#bee0c8' : insc.status === 'lista_espera' ? '#f0d58a' : '#efc7b8';
          return (
            <div key={insc.id} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)', borderLeft: '4px solid ' + cor }}>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 850, padding: '5px 10px', borderRadius: 999, background: bg, border: '1px solid ' + bd, color: cor }}>
                    {insc.status === 'confirmada' ? '✓ Confirmada' : insc.status === 'lista_espera' ? '⏳ Lista de espera' : '• Aguardando confirmação'}
                  </span>
                  <span style={{ fontSize: 11, color: '#94857a', fontWeight: 650 }}>{fmtDateBr(insc.data)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c66b4d' }}>
                  <ClockLineIcon size={17}/>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#2d2521' }}>{fmt(insc.hora_inicio)} – {fmt(insc.hora_fim)}</span>
                </div>
                {adminInfo?.telefone && (
                  <button onClick={() => window.open(buildWaAdmin(adminInfo.telefone!, insc.data, insc.hora_inicio, insc.hora_fim, 'individual'), '_blank')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 12, background: 'linear-gradient(135deg, #1b8f45, #146d35)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 850 }}>
                    <WaIcon/> Falar com o professor
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSolicitacoes = () => {
    const solicitacoesAtivas = solicitacoes.filter(i => i.status !== 'confirmada' && !inscricaoJaPassou(i));
    if (solicitacoesAtivas.length === 0) {
      return (
        <div style={s.emptyFeed}>
          <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
          <p style={s.emptyText}>Nenhuma solicitação ativa.</p>
          <p style={s.emptyHint}>Quando alguém reservar um horário, aparecerá aqui.</p>
        </div>
      );
    }
    const grupos: Record<string, Inscricao[]> = {};
    solicitacoesAtivas.forEach(i => {
      const key = i.data + '|' + i.hora_inicio;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(i);
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(grupos).map(([key, inscs]) => {
          const parts = key.split('|');
          const dt = parts[0]; const hi = parts[1]; const hf = inscs[0].hora_fim;
          return (
            <div key={key} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)' }}>
              <div style={{ padding: '12px 14px 10px', background: '#fffaf7', borderBottom: '1px solid #f4ebe3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 850, color: '#2d2521' }}>{fmtDateBr(dt)}</div>
                  <div style={{ fontSize: 12, color: '#94857a', marginTop: 2 }}>{fmt(hi)} – {fmt(hf)}</div>
                </div>
                <span style={{ fontSize: 12, color: '#8f7769', fontWeight: 700 }}>{inscs.length} pessoa{inscs.length > 1 ? 's' : ''}</span>
              </div>
              {inscs.map((insc, idx) => (
                <div key={insc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: idx < inscs.length - 1 ? '1px solid #f4ebe3' : 'none', background: proximoEspera?.id === insc.id ? '#fff8f0' : 'transparent' }}>
                  {avatarEl(insc.nome_aluno, insc.foto_url, 34)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 750, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{insc.nome_aluno}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: insc.status === 'confirmada' ? '#3f8f5b' : insc.status === 'lista_espera' ? '#b98718' : '#94857a' }}>
                      {insc.status === 'confirmada' ? '✓ Confirmado' : insc.status === 'lista_espera' ? '⏳ Lista de espera' : '• Pendente'}
                      {proximoEspera?.id === insc.id ? ' ← próximo!' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {insc.telefone_usuario && (
                      <button onClick={() => window.open(buildWaAluno(insc.telefone_usuario!, insc.nome_aluno), '_blank')} style={{ width: 30, height: 30, borderRadius: '50%', background: '#edf8ef', border: '1px solid #bee0c8', color: '#3f8f5b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <WaIcon/>
                      </button>
                    )}
                    {insc.status !== 'confirmada' && insc.status !== 'cancelada' && (
                      <button style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 11, fontWeight: 850, cursor: 'pointer' }} onClick={() => confirmarReserva(insc.id)}>Confirmar</button>
                    )}
                    {insc.status !== 'cancelada' && (
                      <button style={sc.delBtn} onClick={() => cancelarReserva(insc.id)}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderHorariosFixos = () => {
    const porDia: Record<number, HorarioFixo[]> = {};
    horariosFixos.forEach(h => {
      if (!porDia[h.dia_semana]) porDia[h.dia_semana] = [];
      porDia[h.dia_semana].push(h);
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button style={{ ...s.newBtn, width: '100%' }} onClick={() => setShowFormFixo(v => !v)}>
          {showFormFixo ? 'Fechar' : '+ Adicionar horário fixo'}
        </button>
        {showFormFixo && (
          <div style={s.formCard}>
            <div style={s.formTitle}>Novo Horário Fixo</div>
            <FieldGroup label="Dia da semana">
              <select style={s.select} value={formFixo.dia_semana} onChange={e => setFormFixo(f => ({ ...f, dia_semana: Number(e.target.value) }))}>
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </FieldGroup>
            <div style={s.formRow}>
              <FieldGroup label="Início">
                <select style={s.select} value={formFixo.hora_inicio} onChange={e => setFormFixo(f => ({ ...f, hora_inicio: e.target.value }))}>
                  {HORAS_INICIO.map(h => <option key={h}>{h}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Fim">
                <select style={s.select} value={formFixo.hora_fim} onChange={e => setFormFixo(f => ({ ...f, hora_fim: e.target.value }))}>
                  {HORAS_FIM.map(h => <option key={h}>{h}</option>)}
                </select>
              </FieldGroup>
            </div>
            <button style={s.publishBtn} onClick={adicionarHorarioFixo}>Adicionar</button>
          </div>
        )}
        {horariosFixos.length === 0 && <div style={s.emptyFeed}><p style={s.emptyText}>Nenhum horário fixo cadastrado.</p></div>}
        {Object.entries(porDia).sort(([a], [b]) => Number(a) - Number(b)).map(([dia, horas]) => (
          <div key={dia} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)' }}>
            <div style={{ padding: '10px 14px', background: '#fffaf7', borderBottom: '1px solid #f4ebe3' }}>
              <span style={{ fontSize: 13, fontWeight: 850, color: '#b65b43' }}>{DIAS[Number(dia)]}</span>
            </div>
            {horas.map((h, idx) => (
              <div key={h.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: (idx < horas.length - 1 || editandoNomeFixoId === h.id) ? '1px solid #f4ebe3' : 'none' }}>
                  <ClockLineIcon size={16}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#2d2521' }}>{fmt(h.hora_inicio)} – {fmt(h.hora_fim)}</span>
                    {h.nome && (
                      <div style={{ fontSize: 11, color: '#b98718', fontWeight: 750, marginTop: 2 }}>
                        📌 {h.nome}
                        {h.valido_de ? ` · ${fmtDateBr(String(h.valido_de))} – ${h.valido_ate ? fmtDateBr(String(h.valido_ate)) : '...'}` : ''}
                      </div>
                    )}
                  </div>
                  <button
                    style={{ padding: '5px 9px', borderRadius: 10, border: '1px solid rgba(198,107,77,0.3)', background: '#fff1eb', color: '#b65b43', fontSize: 11, fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                    onClick={() => {
                      setSugestoesNomeFixo([]);
                      if (editandoNomeFixoId === h.id) { setEditandoNomeFixoId(null); return; }
                      setEditandoNomeFixoId(h.id);
                      setFormNomeFixo({
                        nome: h.nome || '',
                        email_vinculado: h.email_vinculado || '',
                        valido_de:  h.valido_de  ? String(h.valido_de).slice(0, 10)  : '',
                        valido_ate: h.valido_ate ? String(h.valido_ate).slice(0, 10) : '',
                      });
                    }}>
                    {editandoNomeFixoId === h.id ? 'Fechar' : h.nome ? 'Editar' : '+ Nome'}
                  </button>
                  <button style={sc.delBtn} onClick={() => removerHorarioFixo(h.id)}>✕</button>
                </div>

                {editandoNomeFixoId === h.id && (
                  <div style={{ padding: '10px 14px 14px', background: '#fffaf7', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: idx < horas.length - 1 ? '1px solid #f4ebe3' : 'none' }}>
                    <div style={s.formRow}>
                      <FieldGroup label="Nome(s)">
                        <div style={{ position: 'relative' }}>
                          <input style={s.input} placeholder="Ex: Nath, Gisely" value={formNomeFixo.nome}
                            onChange={e => setFormNomeFixo(f => ({ ...f, nome: e.target.value }))}/>
                          {(sugestoesNomeFixo.length > 0 || buscandoNomeFixo) && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, background: '#fff', border: '1px solid #eadfd6', borderRadius: 14, boxShadow: '0 14px 30px rgba(57,37,28,0.14)', overflow: 'hidden' }}>
                              {buscandoNomeFixo && sugestoesNomeFixo.length === 0 && (
                                <div style={{ padding: '10px 12px', fontSize: 12, color: '#94857a', fontWeight: 700 }}>Buscando...</div>
                              )}
                              {sugestoesNomeFixo.map(usuario => (
                                <button
                                  key={usuario.id}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => selecionarUsuarioNomeFixo(usuario)}
                                  style={{ width: '100%', padding: '10px 12px', border: 'none', borderBottom: '1px solid #f4ebe3', background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 9 }}
                                >
                                  {avatarEl(usuario.nome, usuario.foto_url, 28)}
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 850, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{usuario.nome}</div>
                                    <div style={{ fontSize: 11, fontWeight: 650, color: '#94857a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{usuario.email}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FieldGroup>
                      <FieldGroup label="Email (opcional)">
                        <input style={s.input} placeholder="aluno@email.com" value={formNomeFixo.email_vinculado}
                          onChange={e => setFormNomeFixo(f => ({ ...f, email_vinculado: e.target.value }))}/>
                      </FieldGroup>
                    </div>
                    <div style={s.formRow}>
                      <FieldGroup label="Válido de">
                        <input style={s.input} type="date" value={formNomeFixo.valido_de}
                          onChange={e => setFormNomeFixo(f => ({ ...f, valido_de: e.target.value }))}/>
                      </FieldGroup>
                      <FieldGroup label="Até">
                        <input style={s.input} type="date" value={formNomeFixo.valido_ate}
                          onChange={e => setFormNomeFixo(f => ({ ...f, valido_ate: e.target.value }))}/>
                      </FieldGroup>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 13, fontWeight: 850, cursor: 'pointer' }}
                        onClick={() => salvarNomeFixo(h.id)}>
                        Salvar
                      </button>
                      {h.nome && (
                        <button style={{ flex: 0.6, padding: '10px 0', borderRadius: 12, border: '1px solid rgba(201,84,65,0.22)', background: '#fff0ec', color: '#c95441', fontSize: 13, cursor: 'pointer' }}
                          onClick={() => removerNomeFixo(h.id)}>
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderReservarQuadra = () => {
    const localSel = locaisQuadra.find(l => l.id === localQuadraId);
    const isACTO   = localSel?.socios_only === true;
    const slotsQuadraVisiveis = filtrarSlotsQuadraFuturos(slotsQuadra, dataQuadra);

    // Fallback visual: 07h–20h tudo livre, caso ACTO não tenha slots configurados
    const actoSlotsBase: SlotQuadra[] = slotsQuadra.length > 0
      ? slotsQuadra
      : Array.from({ length: 14 }, (_, i) => ({
          hora_inicio: `${String(7 + i).padStart(2, '0')}:00`,
          status: 'livre' as const,
        }));
    const actoSlots = filtrarSlotsQuadraFuturos(actoSlotsBase, dataQuadra);

    const periodos = [
      { label: 'Manhã', icon: '🌅', de: 0,  ate: 12 },
      { label: 'Tarde', icon: '☀️', de: 12, ate: 18 },
      { label: 'Noite', icon: '🌙', de: 18, ate: 24 },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FieldGroup label="Escolha o local">
          <select style={s.select} value={localQuadraId} onChange={e => setLocalQuadraId(Number(e.target.value))}>
            {locaisQuadra.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </FieldGroup>

        {isACTO ? (
          <>
            {/* Info do local */}
            {localSel && (
              <div style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3, boxShadow: '0 8px 20px rgba(117,76,56,0.06)' }}>
                <span style={{ fontSize: 13, fontWeight: 850, color: '#2d2521' }}>📍 {localSel.nome}</span>
                <span style={{ fontSize: 12, color: '#94857a', fontWeight: 650 }}>{localSel.endereco}</span>
                {localSel.observacao && <span style={{ fontSize: 11, color: '#b5a69d', fontWeight: 600 }}>{localSel.observacao}</span>}
              </div>
            )}

            {/* Seletor de quadra */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 850, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 10 }}>
                Escolha a Quadra
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {localSel?.quadras.map(q => (
                  <button key={q.id} onClick={() => setQuadraId(q.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 850,
                      cursor: 'pointer', border: '1px solid',
                      background:  quadraId === q.id ? '#c66b4d' : '#fff',
                      color:       quadraId === q.id ? '#fff'    : '#8f7769',
                      borderColor: quadraId === q.id ? '#c66b4d' : '#eadfd6',
                      boxShadow:   quadraId === q.id ? '0 4px 12px rgba(198,107,77,0.22)' : 'none',
                    }}>
                    {q.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Navegação de data */}
            <div style={s.sectionHead}>
              <CalendarPicker data={dataQuadra} setData={setDataQuadraSegura}/>
              <div style={s.sectionInfo}>
                <h2 style={s.sectionTitle}>{fmtDateBr(dataQuadra)}</h2>
                <DateNav data={dataQuadra} setData={setDataQuadraSegura}/>
              </div>
            </div>

            {/* Grid de horários */}
            {loadingSlots ? (
              <div style={s.loadingBox}><div style={s.loadingDot}/><p style={s.loadingTxt}>Carregando...</p></div>
            ) : actoSlots.length === 0 ? (
              <div style={s.emptyFeed}>
                <div style={s.emptyIcon}><CalendarLineIcon size={28}/></div>
                <p style={s.emptyText}>Nenhum horário disponível em {fmtDateBr(dataQuadra)}.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {periodos.map(({ label, icon, de, ate }) => {
                  const slots = actoSlots.filter(sl => {
                    const h = parseInt(sl.hora_inicio.split(':')[0], 10);
                    return h >= de && h < ate;
                  });
                  if (!slots.length) return null;
                  return (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 850, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {icon} {label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                        {slots.map(sl => {
                          const pal = SLOT_STATUS_PAL[sl.status] ?? SLOT_STATUS_PAL.bloqueado;
                          const podeSolicitar = slotQuadraPermiteSolicitacao(sl.status);
                          return (
                            <button
                              key={sl.hora_inicio}
                              type="button"
                              onClick={() => podeSolicitar ? abrirModalReservaQuadra(sl) : flash('err', 'Este horário não está disponível.')}
                              style={{
                                padding: '9px 12px',
                                borderRadius: 14,
                                textAlign: 'center' as const,
                                background: pal.bg,
                                color: pal.color,
                                border: `1px solid ${pal.border}`,
                                minWidth: 70,
                                cursor: podeSolicitar ? 'pointer' : 'not-allowed',
                                fontFamily: 'inherit',
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 800 }}>{sl.hora_inicio}</div>
                              <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>{SLOT_STATUS_LABEL[sl.status] ?? sl.status}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: '#8f7769', fontWeight: 750 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: '#edf8ef', border: '1px solid #bee0c8', display: 'inline-block' }}/>
                Livre
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: '#f4ebe3', border: '1px solid #e5d8cf', display: 'inline-block' }}/>
                Ocupado
              </span>
            </div>

            {/* Info reserva */}
            <div style={{ background: '#fff1eb', border: '1px solid rgba(198,107,77,0.2)', borderRadius: 16, padding: '12px 14px', fontSize: 12, color: '#b65b43', fontWeight: 700, textAlign: 'center' as const }}>
              Toque em um horário disponível para solicitar a reserva.
            </div>
          </>
        ) : (
          <>
            {localSel && (
              <div style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 8px 20px rgba(117,76,56,0.06)' }}>
                <span style={{ fontSize: 13, fontWeight: 850, color: '#2d2521' }}>{localSel.nome}</span>
                <span style={{ fontSize: 12, color: '#94857a', fontWeight: 650 }}>{localSel.endereco}</span>
                {localSel.observacao && <span style={{ fontSize: 11, color: '#b5a69d' }}>{localSel.observacao}</span>}
              </div>
            )}
            <div style={s.sectionHead}>
              <CalendarPicker data={dataQuadra} setData={setDataQuadraSegura}/>
              <div style={s.sectionInfo}>
                <h2 style={s.sectionTitle}>Horários</h2>
                <DateNav data={dataQuadra} setData={setDataQuadraSegura}/>
              </div>
            </div>
            {loadingSlots ? (
              <div style={s.loadingBox}><div style={s.loadingDot}/><p style={s.loadingTxt}>Carregando...</p></div>
            ) : slotsQuadraVisiveis.length === 0 ? (
              <div style={s.emptyFeed}>
                <div style={s.emptyIcon}><CalendarLineIcon size={28}/></div>
                <p style={s.emptyText}>Nenhum horário disponível em {fmtDateBr(dataQuadra)}.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {slotsQuadraVisiveis.map(slot => {
                    const pal = SLOT_STATUS_PAL[slot.status] ?? SLOT_STATUS_PAL.bloqueado;
                    return (
                      <button
                        key={slot.hora_inicio}
                        type="button"
                        onClick={() => slotQuadraPermiteSolicitacao(slot.status) ? abrirModalReservaQuadra(slot) : flash('err', 'Este horário não está disponível.')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: 12,
                          textAlign: 'center',
                          background: pal.bg,
                          border: `1px solid ${pal.border}`,
                          color: pal.color,
                          cursor: slotQuadraPermiteSolicitacao(slot.status) ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{slot.hora_inicio}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2 }}>{SLOT_STATUS_LABEL[slot.status] ?? slot.status}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(SLOT_STATUS_LABEL).map(([key, label]) => {
                    const pal = SLOT_STATUS_PAL[key];
                    return (
                      <span key={key} style={{ fontSize: 10, fontWeight: 750, padding: '3px 8px', borderRadius: 999, background: pal.bg, color: pal.color, border: `1px solid ${pal.border}` }}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ background: '#fffaf7', border: '1px solid #f4ebe3', borderRadius: 16, padding: '12px 14px', fontSize: 12, color: '#8f7769', fontWeight: 700, textAlign: 'center' as const }}>
              Toque em um horário livre para solicitar a reserva.
            </div>
          </>
        )}
      </div>
    );
  };


  const renderReservasAdminQuadra = () => {
    const porOrdemSolicitacao = (a: ReservaQuadra, b: ReservaQuadra) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    const pendentes   = reservasAdmin.filter(r => r.status === 'pendente').sort(porOrdemSolicitacao);
    const fila        = reservasAdmin.filter(r => r.status === 'fila_espera').sort(porOrdemSolicitacao);
    const confirmadas = reservasAdmin.filter(r => r.status === 'confirmada').sort(porOrdemSolicitacao);

    const renderCard = (r: ReservaQuadra) => {
      const sCor = r.status === 'confirmada' ? '#3f8f5b' : r.status === 'fila_espera' ? '#b98718' : '#b36a2f';
      const sBg  = r.status === 'confirmada' ? '#edf8ef' : r.status === 'fila_espera' ? '#fff8e6' : '#fff4e8';
      const sBd  = r.status === 'confirmada' ? '#bee0c8' : r.status === 'fila_espera' ? '#f0d58a' : '#f0d5b0';
      const sLbl = r.status === 'confirmada' ? '✓ Confirmada' : r.status === 'fila_espera' ? '⏳ Fila' : '• Pendente';
      return (
        <div key={r.id} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 10px 24px rgba(57,37,28,0.06)', borderLeft: `4px solid ${sCor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 850, color: '#2d2521' }}>{r.nome_reserva}</span>
            <span style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, fontWeight: 850, background: sBg, color: sCor, border: `1px solid ${sBd}` }}>{sLbl}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c66b4d' }}>
            <ClockLineIcon size={16}/>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#2d2521' }}>{fmtDateBr(r.data)} · {fmt(r.hora_inicio)} – {fmt(r.hora_fim)}</span>
          </div>
          {r.whatsapp && (
            <button onClick={() => window.open(`https://wa.me/55${r.whatsapp!.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${r.nome_reserva}, sobre sua reserva de quadra!`)}`, '_blank')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 0', borderRadius: 12, background: 'linear-gradient(135deg,#1b8f45,#146d35)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 850 }}>
              <WaIcon/> {r.whatsapp}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {r.status !== 'confirmada' && (
              <button style={{ flex: 1, padding: '10px 0', borderRadius: 13, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}
                onClick={() => confirmarReservaAdmin(r.id)}>Confirmar</button>
            )}
            <button style={{ flex: 1, padding: '10px 0', borderRadius: 13, border: '1px solid rgba(201,84,65,0.22)', background: '#fff0ec', color: '#c95441', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}
              onClick={() => cancelarReservaAdmin(r.id)}>Cancelar</button>
          </div>
        </div>
      );
    };

    if (reservasAdmin.length === 0) {
      return (
        <div style={s.emptyFeed}>
          <div style={s.emptyIcon}><CalendarLineIcon size={28}/></div>
          <p style={s.emptyText}>Nenhuma reserva de quadra.</p>
          <p style={s.emptyHint}>As solicitações aparecerão aqui quando chegarem.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pendentes.length > 0 && (<>
          <div style={{ fontSize: 11, fontWeight: 950, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Aguardando aprovação ({pendentes.length})</div>
          {pendentes.map(renderCard)}
        </>)}
        {fila.length > 0 && (<>
          <div style={{ fontSize: 11, fontWeight: 950, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 4 }}>Fila de espera ({fila.length})</div>
          {fila.map(renderCard)}
        </>)}
        {confirmadas.length > 0 && (<>
          <div style={{ fontSize: 11, fontWeight: 950, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 4 }}>Confirmadas ({confirmadas.length})</div>
          {confirmadas.map(renderCard)}
        </>)}
      </div>
    );
  };

  const renderGestaoQuadra = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={s.formCard}>
        <div style={s.formTitle}>Disponibilidade da Quadra</div>
        {dispConfig && (
          <div style={{ fontSize: 12, color: '#94857a', fontWeight: 650, padding: '8px 10px', background: '#fffaf7', borderRadius: 12, border: '1px solid #f4ebe3' }}>
            Atual: {DIAS_QUAD.filter((_, i) => dispConfig.dias_semana.includes(i)).join(', ')} · {dispConfig.hi_text} – {dispConfig.hf_text}
          </div>
        )}
        <div>
          <span style={s.label}>Dias da semana</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {DIAS_QUAD.map((d, i) => (
              <button key={i} type="button"
                onClick={() => setFormDisp(f => ({ ...f, dias_semana: f.dias_semana.includes(i) ? f.dias_semana.filter(x => x !== i) : [...f.dias_semana, i] }))}
                style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid', fontSize: 12, fontWeight: 850, cursor: 'pointer', background: formDisp.dias_semana.includes(i) ? '#c66b4d' : '#fff', color: formDisp.dias_semana.includes(i) ? '#fff' : '#8f7769', borderColor: formDisp.dias_semana.includes(i) ? '#c66b4d' : '#eadfd6' }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div style={s.formRow}>
          <FieldGroup label="Abre">
            <select style={s.select} value={formDisp.hi_text} onChange={e => setFormDisp(f => ({ ...f, hi_text: e.target.value }))}>
              {COURT_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Fecha">
            <select style={s.select} value={formDisp.hf_text} onChange={e => setFormDisp(f => ({ ...f, hf_text: e.target.value }))}>
              {COURT_SLOTS.filter(t => t > formDisp.hi_text).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
        </div>
        <button style={s.publishBtn} onClick={salvarDisponibilidade}>Salvar disponibilidade</button>
      </div>
      <div style={s.formCard}>
        <div style={s.formTitle}>Bloquear Horário</div>
        <FieldGroup label="Data">
          <input style={s.input} type="date" value={formBloqueio.data} onChange={e => setFormBloqueio(f => ({ ...f, data: e.target.value }))}/>
        </FieldGroup>
        <div style={s.formRow}>
          <FieldGroup label="De">
            <select style={s.select} value={formBloqueio.hi_text} onChange={e => setFormBloqueio(f => ({ ...f, hi_text: e.target.value }))}>
              <option value="">Selecionar</option>
              {COURT_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Até">
            <select style={s.select} value={formBloqueio.hf_text} onChange={e => setFormBloqueio(f => ({ ...f, hf_text: e.target.value }))}>
              <option value="">Selecionar</option>
              {COURT_SLOTS.filter(t => !formBloqueio.hi_text || t > formBloqueio.hi_text).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
        </div>
        <FieldGroup label="Motivo (opcional)">
          <input style={s.input} value={formBloqueio.motivo} onChange={e => setFormBloqueio(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Manutenção"/>
        </FieldGroup>
        <button style={s.publishBtn} onClick={adicionarBloqueio}>Bloquear</button>
      </div>
      {bloqueios.length > 0 && (<>
        <div style={{ fontSize: 11, fontWeight: 950, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Bloqueios ativos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bloqueios.map((b: any) => (
            <div key={b.id} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 16, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 16px rgba(57,37,28,0.04)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#2d2521' }}>{fmtDateBr(b.data)} · {b.hi_text || b.hora_inicio + 'h'} – {b.hf_text || b.hora_fim + 'h'}</div>
                {b.motivo && <div style={{ fontSize: 11, color: '#94857a', marginTop: 2 }}>{b.motivo}</div>}
              </div>
              <button style={sc.delBtn} onClick={() => removerBloqueio(b.id)}>✕</button>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  const slotsVisiveis = filtrarSlotsPassados(slotsDia, data);
  const aulasConfirmadas = solicitacoes.filter(i => i.status === 'confirmada');
  const aulasConfirmadasFuturas   = aulasConfirmadas.filter(i => !inscricaoJaPassou(i)).sort(ordenarInscricoesAsc);
  const aulasConfirmadasHistorico = aulasConfirmadas.filter(inscricaoJaPassou).sort(ordenarInscricoesDesc);

  const aulasConfirmadasFuturasDoDia = aulasConfirmadasFuturas.filter(insc =>
    insc.data.slice(0, 10) === dataConfirmadas
  );

  const aulasConfirmadasAdmin: ProximaAulaAdmin[] = aulasConfirmadasFuturasDoDia.map(insc => ({
    key: `confirmada-${insc.id}`,
    origem: 'confirmada',
    data: insc.data,
    hora_inicio: insc.hora_inicio,
    hora_fim: insc.hora_fim,
    nome_aluno: insc.nome_aluno,
    email_aluno: insc.email_aluno,
    telefone_usuario: insc.telefone_usuario,
    foto_url: insc.foto_url,
    inscricao_id: insc.id,
  }));

  const aulasFixasDoDia = montarAulasFixasNoDia(horariosFixos, dataConfirmadas).filter(fixa =>
    !aulasConfirmadasFuturasDoDia.some(insc =>
      insc.data.slice(0, 10) === fixa.data.slice(0, 10) &&
      fmt(insc.hora_inicio) === fmt(fixa.hora_inicio) &&
      (
        insc.nome_aluno.trim().toLowerCase() === fixa.nome_aluno.trim().toLowerCase() ||
        (!!fixa.email_aluno && insc.email_aluno.trim().toLowerCase() === fixa.email_aluno.trim().toLowerCase())
      )
    )
  );

  const proximasAulasAdmin = [...aulasConfirmadasAdmin, ...aulasFixasDoDia].sort(ordenarAulasAdminAsc);

  const aulasConfirmadasHistoricoAdmin: ProximaAulaAdmin[] = aulasConfirmadasHistorico.map(insc => ({
    key: `historico-confirmada-${insc.id}`,
    origem: 'confirmada',
    data: insc.data,
    hora_inicio: insc.hora_inicio,
    hora_fim: insc.hora_fim,
    nome_aluno: insc.nome_aluno,
    email_aluno: insc.email_aluno,
    telefone_usuario: insc.telefone_usuario,
    foto_url: insc.foto_url,
    inscricao_id: insc.id,
  }));

  const aulasFixasHistorico = montarAulasFixasHistorico(horariosFixos).filter(fixa =>
    !aulasConfirmadasHistorico.some(insc =>
      insc.data.slice(0, 10) === fixa.data.slice(0, 10) &&
      fmt(insc.hora_inicio) === fmt(fixa.hora_inicio) &&
      (
        insc.nome_aluno.trim().toLowerCase() === fixa.nome_aluno.trim().toLowerCase() ||
        (!!fixa.email_aluno && insc.email_aluno.trim().toLowerCase() === fixa.email_aluno.trim().toLowerCase())
      )
    )
  );

  const aulasHistoricoAdmin = [...aulasConfirmadasHistoricoAdmin, ...aulasFixasHistorico]
    .sort(ordenarAulasAdminDesc)
    .slice(0, 80);
  const localQuadraAdminSel = locaisQuadra.find(l => l.id === localQuadraId);
  const quadraAdminSel = localQuadraAdminSel?.quadras.find(q => q.id === quadraId);

  return (
    <div style={s.page}>
      <div style={s.bgGlow1}/> <div style={s.bgGlow2}/>

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>‹</button>
        <div style={s.headerCenter}>
          <span style={s.headerTitle}>Agenda</span>
          <span style={s.headerSub}>{adminInfo ? 'Prof. Carlão' : 'Carregando professor...'}</span>
        </div>
        <div style={s.headerIcon}><UserOutlineIcon size={20}/></div>
      </div>

      {msg && (
        <div style={{ ...s.toast, background: msg.type === 'ok' ? 'rgba(63,143,91,0.96)' : 'rgba(201,84,65,0.96)' }}>
          {msg.text}
        </div>
      )}

      {showReservaQuadraModal && (() => {
        const localSel = locaisQuadra.find(l => l.id === localQuadraId);
        const quadraSel = localSel?.quadras.find(q => q.id === quadraId);
        const minFim = reservaHoraInicio ? addCourtMin(reservaHoraInicio, 60) : '';
        const opcoesFim = COURT_SLOTS.filter(t => !reservaHoraInicio || t >= minFim);
        const bloqueio = reservaHoraInicio && reservaHoraFim
          ? intervaloQuadraOcupado(slotsQuadra, reservaHoraInicio, reservaHoraFim)
          : null;

        return (
          <div
            style={rq.overlay}
            onClick={e => {
              if (e.target === e.currentTarget) fecharModalReservaQuadra();
            }}
          >
            <div style={rq.sheet}>
              <div style={rq.topBar}>
                <div>
                  <h3 style={rq.title}>Solicitar reserva</h3>
                  <p style={rq.subtitle}>{localSel?.nome ?? 'Local'} · {quadraSel?.nome ?? 'Quadra'}</p>
                </div>
                <button type="button" style={rq.closeBtn} onClick={fecharModalReservaQuadra}>✕</button>
              </div>

              <div style={rq.infoBox}>
                <span style={rq.infoLabel}>Data</span>
                <strong style={rq.infoValue}>{fmtDateBr(dataQuadra)}</strong>
              </div>

              <div style={s.formRow}>
                <FieldGroup label="Das">
                  <input style={{ ...s.input, opacity: 0.75 }} value={reservaHoraInicio} readOnly />
                </FieldGroup>
                <FieldGroup label="Até">
                  <select style={s.select} value={reservaHoraFim} onChange={e => setReservaHoraFim(e.target.value)}>
                    {opcoesFim.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FieldGroup>
              </div>

              {bloqueio && (
                <div style={rq.errorBox}>
                  Esse intervalo passa por {bloqueio.hora_inicio}, que já está ocupado. Escolha outro horário final.
                </div>
              )}

              <FieldGroup label="Seu nome">
                <input style={s.input} value={reservaNome} onChange={e => setReservaNome(e.target.value)} placeholder="Como prefere ser chamado" />
              </FieldGroup>

              <FieldGroup label="WhatsApp">
                <input
                  style={s.input}
                  type="tel"
                  inputMode="numeric"
                  value={reservaWhatsapp}
                  onChange={e => setReservaWhatsapp(maskPhone(e.target.value))}
                  placeholder="(33) 99999-0000"
                />
              </FieldGroup>

              <p style={rq.hint}>
                A solicitação será enviada para aprovação no app{(localSel?.responsavel_nome ?? (adminInfo?.telefone ? 'Carlão' : null)) ? ` e o WhatsApp abrirá para ${localSel?.responsavel_nome ?? 'Carlão'}` : ''}.
              </p>

              <button
                type="button"
                style={{ ...s.publishBtn, opacity: reservaLoading || !!bloqueio ? 0.6 : 1 }}
                onClick={solicitarReservaQuadra}
                disabled={reservaLoading || !!bloqueio}
              >
                {reservaLoading ? 'Enviando...' : 'Solicitar reserva e abrir WhatsApp'}
              </button>
            </div>
          </div>
        );
      })()}

      {isAdmin && (
        <div style={s.tabSelectBar}>
          <div style={s.tabSelectBox}>
            <span style={s.tabSelectLabel}>Área da agenda</span>
            <select
              style={s.tabSelect}
              value={adminTab}
              onChange={e => setAdminTab(e.target.value as AdminTab)}
            >
              <option value="agenda">Agenda</option>
              <option value="solicitacoes">Solicitações</option>
              <option value="confirmadas">Confirmadas</option>
              <option value="historico">Histórico</option>
              <option value="fixos">Horários Fixos</option>
              <option value="quadra_res">Reservas Quadra</option>
              <option value="quadra_gest">Gestão Quadra</option>
            </select>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div style={s.tabSelectBar}>
          <div style={s.tabSelectBox}>
            <span style={s.tabSelectLabel}>Área da agenda</span>
            <select
              style={s.tabSelect}
              value={userTab}
              onChange={e => setUserTab(e.target.value as UserTab)}
            >
              <option value="agenda">Agenda</option>
              <option value="minhas">Minhas Aulas{minhasInscricoes.length > 0 ? ' (' + minhasInscricoes.length + ')' : ''}</option>
              <option value="reservar">Reservar Quadra</option>
            </select>
          </div>
        </div>
      )}

      <div style={s.scrollBody}>
        <div style={s.inner}>

          {isAdmin && adminTab === 'agenda' && (
            <>
              <section style={s.heroCard}>
                <div style={s.heroText}>
                  <span style={s.heroKicker}>GESTÃO DE HORÁRIOS</span>
                  <h1 style={s.heroTitle}>Organize seus horários</h1>
                  <p style={s.heroSub}>Crie, edite ou cancele horários para este dia.</p>
                </div>
              </section>
              <section style={s.section}>
                <div style={s.sectionHead}>
                  <CalendarPicker data={data} setData={setData}/>
                  <div style={s.sectionInfo}>
                    <h2 style={s.sectionTitle}>Meus horários</h2>
                    <DateNav data={data} setData={setData}/>
                  </div>
                  <button onClick={() => setShowForm(v => !v)} style={s.newBtn}>{showForm ? 'Fechar' : '+ Novo'}</button>
                </div>
                {showForm && (
                  <div style={s.formCard}>
                    <div style={s.formTop}>
                      <div><div style={s.formTitle}>Novo horário</div><div style={s.formSub}>{fmtDateBr(data)}</div></div>
                      <span style={s.formPill}>{TIPO_LABEL[form.tipo] ?? form.tipo}</span>
                    </div>
                    <div style={s.formRow}>
                      <FieldGroup label="Início">
                        <select style={s.select} value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                          {HORAS_INICIO.map(h => <option key={h}>{h}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup label="Fim">
                        <select style={s.select} value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))}>
                          {HORAS_FIM.map(h => <option key={h}>{h}</option>)}
                        </select>
                      </FieldGroup>
                    </div>
                    <div style={s.formRow}>
                      <FieldGroup label="Tipo">
                        <select style={s.select} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </FieldGroup>
                      {form.tipo !== 'bloqueado' && (
                        <FieldGroup label="Vagas">
                          <input style={s.input} type="number" min={1} max={20} value={form.vagas} onChange={e => setForm(f => ({ ...f, vagas: Number(e.target.value) }))}/>
                        </FieldGroup>
                      )}
                    </div>
                    <FieldGroup label="Observação">
                      <textarea style={s.textarea} rows={2} placeholder="Informações para o aluno (opcional)…" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}/>
                    </FieldGroup>
                    <button style={{ ...s.publishBtn, opacity: loading ? 0.6 : 1 }} onClick={saveSlot} disabled={loading}>
                      {loading ? 'Salvando…' : 'Salvar horário'}
                    </button>
                  </div>
                )}
                {loading && <div style={s.loadingBox}><div style={s.loadingDot}/><p style={s.loadingTxt}>Carregando horários…</p></div>}
                {!loading && slotsVisiveis.length === 0 && (
                  <div style={s.emptyFeed}>
                    <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
                    <p style={s.emptyText}>Nenhum horário em {fmtDateBr(data)}.</p>
                    <p style={s.emptyHint}>Clique em "+ Novo" para adicionar.</p>
                  </div>
                )}
                {!loading && slotsVisiveis.length > 0 && (
                  <div style={s.slotList}>{slotsVisiveis.map(sl => renderSlotDiaCard(sl))}</div>
                )}
              </section>
            </>
          )}

          {isAdmin && adminTab === 'solicitacoes' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><UserOutlineIcon size={20}/></div>
                <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Solicitações</h2><span style={{ fontSize: 12, color: '#94857a' }}>Gerencie quem quer aula</span></div>
              </div>
              {renderSolicitacoes()}
            </section>
          )}

          {isAdmin && adminTab === 'confirmadas' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><ClockLineIcon size={20}/></div>
                <div style={s.sectionInfo}>
                  <h2 style={s.sectionTitle}>Aulas Confirmadas</h2>
                  <span style={{ fontSize: 12, color: '#94857a' }}>Aulas do dia selecionado</span>
                  <DateNav data={dataConfirmadas} setData={setDataConfirmadas}/>
                </div>
                <CalendarPicker data={dataConfirmadas} setData={setDataConfirmadas}/>
              </div>
              {proximasAulasAdmin.length === 0 ? (
                <div style={s.emptyFeed}>
                  <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
                  <p style={s.emptyText}>Nenhuma aula em {fmtDateBr(dataConfirmadas)}.</p>
                  <p style={s.emptyHint}>Use as setas ou o calendário para consultar outro dia.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {proximasAulasAdmin.map(aula => (
                    <div key={aula.key} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)', borderLeft: '4px solid ' + (aula.origem === 'fixo' ? '#b98718' : '#3f8f5b') }}>
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 850, padding: '5px 10px', borderRadius: 999, background: aula.origem === 'fixo' ? '#fff8e6' : '#edf8ef', border: '1px solid ' + (aula.origem === 'fixo' ? '#f0d58a' : '#bee0c8'), color: aula.origem === 'fixo' ? '#b98718' : '#3f8f5b' }}>
                            {aula.origem === 'fixo' ? '📌 Horário fixo' : '✓ Confirmada'}
                          </span>
                          <span style={{ fontSize: 11, color: '#94857a', fontWeight: 650 }}>{fmtDateBr(aula.data)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c66b4d' }}>
                          <ClockLineIcon size={17}/>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#2d2521' }}>{fmt(aula.hora_inicio)} – {fmt(aula.hora_fim)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {avatarEl(aula.nome_aluno, aula.foto_url, 30)}
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{aula.nome_aluno}</span>
                            {aula.email_aluno && (
                              <span style={{ fontSize: 11, color: '#94857a', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{aula.email_aluno}</span>
                            )}
                          </div>
                        </div>
                        {aula.telefone_usuario && (
                          <button onClick={() => window.open(buildWaAluno(aula.telefone_usuario!, aula.nome_aluno), '_blank')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 12, background: 'linear-gradient(135deg, #1b8f45, #146d35)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 850 }}>
                            <WaIcon/> WhatsApp do aluno
                          </button>
                        )}
                        {aula.origem === 'confirmada' && aula.inscricao_id && (
                          <button style={{ padding: '9px 0', borderRadius: 12, border: '1px solid rgba(201,84,65,0.22)', background: '#fff0ec', color: '#c95441', fontSize: 12, fontWeight: 850, cursor: 'pointer' }} onClick={() => cancelarReserva(aula.inscricao_id!)}>
                            Cancelar aula
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {isAdmin && adminTab === 'historico' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><ClockLineIcon size={20}/></div>
                <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Histórico</h2><span style={{ fontSize: 12, color: '#94857a' }}>Aulas e horários fixos que já passaram</span></div>
              </div>
              {aulasHistoricoAdmin.length === 0 ? (
                <div style={s.emptyFeed}>
                  <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
                  <p style={s.emptyText}>Nenhuma aula no histórico.</p>
                  <p style={s.emptyHint}>As aulas passadas aparecerão aqui.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aulasHistoricoAdmin.map(aula => (
                    <div key={aula.key} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)', borderLeft: '4px solid #8d7b70', opacity: 0.92 }}>
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 850, padding: '5px 10px', borderRadius: 999, background: '#f1e9e4', border: '1px solid #e5d8cf', color: '#8d7b70' }}>
                            {aula.origem === 'fixo' ? '📌 Fixo passado' : 'Histórico'}
                          </span>
                          <span style={{ fontSize: 11, color: '#94857a', fontWeight: 650 }}>{fmtDateBr(aula.data)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8d7b70' }}>
                          <ClockLineIcon size={17}/>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#2d2521' }}>{fmt(aula.hora_inicio)} – {fmt(aula.hora_fim)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {avatarEl(aula.nome_aluno, aula.foto_url, 30)}
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{aula.nome_aluno}</span>
                            {aula.email_aluno && (
                              <span style={{ fontSize: 11, color: '#94857a', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{aula.email_aluno}</span>
                            )}
                          </div>
                        </div>
                        {aula.telefone_usuario && (
                          <button onClick={() => window.open(buildWaAluno(aula.telefone_usuario!, aula.nome_aluno), '_blank')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 12, background: '#edf8ef', color: '#3f8f5b', border: '1px solid #bee0c8', cursor: 'pointer', fontSize: 13, fontWeight: 850 }}>
                            <WaIcon/> WhatsApp do aluno
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {isAdmin && adminTab === 'fixos' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><ClockLineIcon size={20}/></div>
                <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Horários Fixos</h2><span style={{ fontSize: 12, color: '#94857a' }}>Recorrência semanal</span></div>
              </div>
              {renderHorariosFixos()}
            </section>
          )}

          {isAdmin && adminTab === 'quadra_res' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><CalendarLineIcon size={20}/></div>
                <div style={s.sectionInfo}>
                  <h2 style={s.sectionTitle}>Reservas de Quadra</h2>
                  <span style={{ fontSize: 12, color: '#94857a' }}>
                    {localQuadraAdminSel?.nome ?? 'Selecione um local'}{quadraAdminSel ? ' — ' + quadraAdminSel.nome : ''}
                  </span>
                </div>
              </div>

              <div style={s.formCard}>
                <div style={s.formTitle}>Filtrar reservas</div>
                <div style={s.formRow}>
                  <FieldGroup label="Local">
                    <select style={s.select} value={localQuadraId} onChange={e => setLocalQuadraId(Number(e.target.value))}>
                      {locaisQuadra.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Quadra">
                    <select style={s.select} value={quadraId} onChange={e => setQuadraId(Number(e.target.value))}>
                      {(localQuadraAdminSel?.quadras ?? []).map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
                    </select>
                  </FieldGroup>
                </div>
              </div>

              {renderReservasAdminQuadra()}
            </section>
          )}

          {isAdmin && adminTab === 'quadra_gest' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><CalendarLineIcon size={20}/></div>
                <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Gestão da Quadra</h2><span style={{ fontSize: 12, color: '#94857a' }}>Disponibilidade e bloqueios</span></div>
              </div>
              {renderGestaoQuadra()}
            </section>
          )}

          {!isAdmin && userTab === 'agenda' && (
            <>
              <section style={s.heroCard}>
                <div style={s.heroText}>
                  <span style={s.heroKicker}>AGENDA DO PROFESSOR</span>
                  <h1 style={s.heroTitle}>Escolha um horário disponível</h1>
                  <p style={s.heroSub}>Veja a disponibilidade e solicite sua reserva.</p>
                </div>
              </section>
              <section style={s.section}>
                <div style={s.sectionHead}>
                  <CalendarPicker data={data} setData={setData}/>
                  <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Horários disponíveis</h2><DateNav data={data} setData={setData}/></div>
                </div>
                {loading && <div style={s.loadingBox}><div style={s.loadingDot}/><p style={s.loadingTxt}>Carregando horários…</p></div>}
                {!loading && slotsVisiveis.length === 0 && (
                  <div style={s.emptyFeed}>
                    <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
                    <p style={s.emptyText}>Nenhum horário em {fmtDateBr(data)}.</p>
                    <p style={s.emptyHint}>Tente outro dia.</p>
                  </div>
                )}
                {!loading && slotsVisiveis.length > 0 && (
                  <div style={s.slotList}>{slotsVisiveis.map(sl => renderSlotDiaCard(sl))}</div>
                )}
              </section>
            </>
          )}

          {!isAdmin && userTab === 'minhas' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><ClockLineIcon size={20}/></div>
                <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Minhas Aulas</h2><span style={{ fontSize: 12, color: '#94857a' }}>Aulas inscritas e confirmadas</span></div>
              </div>
              {renderMinhasAulas()}
            </section>
          )}

          {!isAdmin && userTab === 'reservar' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><CalendarLineIcon size={20}/></div>
                <div style={s.sectionInfo}><h2 style={s.sectionTitle}>Reservar Quadra</h2><span style={{ fontSize: 12, color: '#94857a' }}>Solicite seu horário</span></div>
              </div>
              {renderReservarQuadra()}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

// =============================================================================
const s: Record<string, React.CSSProperties> = {
  page: { position: 'fixed', inset: 0, background: '#fbf7f1', color: '#2d2521', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', overflow: 'hidden' },
  bgGlow1: { position: 'absolute', top: -110, right: -90, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(191,102,72,0.16) 0%, transparent 68%)', pointerEvents: 'none', zIndex: 0 },
  bgGlow2: { position: 'absolute', bottom: -130, left: -100, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(116,80,58,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  header: { position: 'relative', zIndex: 5, display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', gap: 10, padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px', background: '#fbf7f1', flexShrink: 0 },
  backBtn: { width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#f3e8de', color: '#7a5142', fontSize: 30, lineHeight: 1, cursor: 'pointer' },
  headerCenter: { minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 22, fontWeight: 950, color: '#2d2521', letterSpacing: -0.7 },
  headerSub: { fontSize: 12, fontWeight: 650, color: '#94857a' },
  headerIcon: { width: 42, height: 42, borderRadius: '50%', background: '#f3e8de', color: '#7a5142', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'fixed', top: 78, left: '50%', transform: 'translateX(-50%)', padding: '11px 18px', borderRadius: 999, color: '#fff', fontSize: 13, fontWeight: 800, zIndex: 100, boxShadow: '0 10px 28px rgba(70,45,34,0.22)', whiteSpace: 'nowrap' },
  tabBar: { display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 10px', background: '#fbf7f1', flexShrink: 0, zIndex: 4, position: 'relative' },
  tabBtn: { flex: '0 0 auto', padding: '9px 14px', background: '#fff', border: '1px solid rgba(130,82,62,0.08)', color: '#8f7769', fontSize: 12, fontWeight: 900, cursor: 'pointer', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(117,76,56,0.05)' },
  tabActive: { background: '#c66b4d', color: '#fff', borderColor: '#c66b4d', boxShadow: '0 8px 18px rgba(198,107,77,0.18)' },
  tabSelectBar: { padding: '0 14px 10px', background: '#fbf7f1', flexShrink: 0, zIndex: 4, position: 'relative' },
  tabSelectBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 18, padding: '10px 12px', boxShadow: '0 8px 20px rgba(117,76,56,0.06)' },
  tabSelectLabel: { flexShrink: 0, fontSize: 11, fontWeight: 900, color: '#8f7769', textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  tabSelect: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: '#fffaf7', color: '#2d2521', fontSize: 14, fontWeight: 850, borderRadius: 13, padding: '11px 12px', fontFamily: 'inherit', colorScheme: 'light' as React.CSSProperties['colorScheme'] },
  scrollBody: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'], position: 'relative', zIndex: 2 },
  inner: { display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 16px 36px', maxWidth: 540, margin: '0 auto', boxSizing: 'border-box', width: '100%' },
  heroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, minHeight: 132, background: 'linear-gradient(135deg, #c66b4d, #8f4635)', boxShadow: '0 16px 34px rgba(134,72,50,0.20)', padding: '20px 18px', boxSizing: 'border-box' },
  heroText: { position: 'relative', zIndex: 2, maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 7 },
  heroKicker: { color: 'rgba(255,245,235,0.82)', fontSize: 10, fontWeight: 900, letterSpacing: 1.3 },
  heroTitle: { color: '#fff8ef', fontSize: 22, fontWeight: 950, lineHeight: 1.08, letterSpacing: -0.7, margin: 0 },
  heroSub: { color: 'rgba(255,248,239,0.86)', fontSize: 12.5, fontWeight: 650, lineHeight: 1.38, margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionHead: { display: 'grid', gridTemplateColumns: '42px 1fr auto', alignItems: 'flex-start', gap: 10, padding: '2px 2px 0' },
  sectionIcon: { width: 42, height: 42, borderRadius: 15, background: '#fff', border: '1px solid rgba(130,82,62,0.08)', color: '#c66b4d', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(117,76,56,0.06)' },
  sectionInfo: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 950, margin: 0, color: '#2d2521', letterSpacing: -0.4 },
  newBtn: { flexShrink: 0, padding: '10px 13px', borderRadius: 14, background: 'linear-gradient(135deg, #c66b4d, #934836)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(147,72,54,0.18)', whiteSpace: 'nowrap' },
  formCard: { display: 'flex', flexDirection: 'column', gap: 14, background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 22, padding: '16px 14px 18px', boxShadow: '0 10px 28px rgba(117,76,56,0.07)' },
  formTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  formTitle: { fontSize: 17, fontWeight: 950, color: '#2d2521', letterSpacing: -0.3 },
  formSub: { marginTop: 3, fontSize: 12, fontWeight: 700, color: '#94857a' },
  formPill: { padding: '7px 10px', borderRadius: 999, background: '#fff1eb', color: '#b65b43', fontSize: 11, fontWeight: 850, whiteSpace: 'nowrap' },
  formRow: { display: 'flex', gap: 10 },
  fieldGroup: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 850, color: '#8f7769', letterSpacing: 0.6, textTransform: 'uppercase' as const },
  select: { width: '100%', padding: '13px 14px', borderRadius: 14, background: '#fffaf7', border: '1px solid #eadfd6', color: '#332a25', fontSize: 15, fontWeight: 650, boxSizing: 'border-box', colorScheme: 'light' as React.CSSProperties['colorScheme'] },
  input: { width: '100%', padding: '13px 14px', borderRadius: 14, background: '#fffaf7', border: '1px solid #eadfd6', color: '#332a25', fontSize: 15, fontWeight: 650, boxSizing: 'border-box', colorScheme: 'light' as React.CSSProperties['colorScheme'] },
  textarea: { width: '100%', padding: '13px 14px', borderRadius: 14, background: '#fffaf7', border: '1px solid #eadfd6', color: '#332a25', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', resize: 'vertical' as const, fontFamily: 'inherit', colorScheme: 'light' as React.CSSProperties['colorScheme'] },
  publishBtn: { padding: '15px', borderRadius: 16, background: 'linear-gradient(135deg, #c66b4d, #934836)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 950, cursor: 'pointer', boxShadow: '0 12px 24px rgba(147,72,54,0.22)' },
  loadingBox: { background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 22, padding: '24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 10px 28px rgba(117,76,56,0.07)' },
  loadingDot: { width: 10, height: 10, borderRadius: '50%', background: '#c66b4d' },
  loadingTxt: { margin: 0, color: '#94857a', fontSize: 13, fontWeight: 800 },
  emptyFeed: { background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '34px 18px', textAlign: 'center', boxShadow: '0 10px 28px rgba(117,76,56,0.07)' },
  emptyIcon: { width: 58, height: 58, borderRadius: '50%', background: '#fff1eb', color: '#c66b4d', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText: { margin: 0, fontSize: 15, color: '#4b3d36', fontWeight: 850 },
  emptyHint: { margin: 0, fontSize: 12, color: '#94857a', fontWeight: 650 },
  slotList: { display: 'flex', flexDirection: 'column', gap: 12 },
};

const sc: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)', padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { fontSize: 12, fontWeight: 850, padding: '5px 10px', borderRadius: 999, border: '1px solid', letterSpacing: 0.1 },
  ocupadoBadge: { fontSize: 11, fontWeight: 850, padding: '5px 10px', borderRadius: 999, background: '#f1e9e4', border: '1px solid #e5d8cf', color: '#8d7b70' },
  editBtn: { padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(198,107,77,0.3)', background: '#fff1eb', color: '#b65b43', fontSize: 11, fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' },
  ocupadoBtn: { padding: '6px 10px', borderRadius: 999, border: '1px solid', fontSize: 11, fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' },
  delBtn: { width: 30, height: 30, borderRadius: '50%', background: '#fff4f0', border: '1px solid rgba(201,84,65,0.16)', color: '#c95441', fontSize: 15, cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  timeRow: { display: 'flex', alignItems: 'center', gap: 8, color: '#c66b4d' },
  infoItem: { display: 'flex', alignItems: 'center', gap: 9, color: '#8f7769' },
  infoIcon: { color: '#c66b4d', display: 'flex', alignItems: 'center', flexShrink: 0 },
  infoText: { color: '#6f625b', fontSize: 13, fontWeight: 650, lineHeight: 1.35 },
  reservarBtn: { width: '100%', padding: '13px 0', borderRadius: 16, background: 'linear-gradient(135deg, #c66b4d, #934836)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(147,72,54,0.18)' },
  waBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px 14px', borderRadius: 999, background: 'linear-gradient(135deg, #1b8f45, #146d35)', color: '#fff', fontSize: 13, fontWeight: 850, border: 'none', cursor: 'pointer', boxShadow: '0 8px 16px rgba(27,143,69,0.18)', width: '100%' },
  ocupadoInfo: { textAlign: 'center', fontSize: 12.5, color: '#8f7769', fontWeight: 750, padding: '6px 0' },
  okBtn: { padding: '10px 0', borderRadius: 13, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 12, fontWeight: 850, cursor: 'pointer' },
  disputeBtn: { padding: '10px 0', borderRadius: 13, border: '1px solid rgba(201,84,65,0.22)', background: '#fff0ec', color: '#c95441', fontSize: 12, fontWeight: 850, cursor: 'pointer' },
  okBtnSm: { width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 14, cursor: 'pointer', flexShrink: 0 },
};

const rq: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 120,
    background: 'rgba(44,30,24,0.42)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
    backdropFilter: 'blur(5px)',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    background: '#fffaf5',
    border: '1px solid rgba(130,82,62,0.12)',
    borderRadius: 26,
    padding: 16,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 13,
    boxShadow: '0 24px 70px rgba(44,36,31,0.30)',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    margin: 0,
    color: '#2d2521',
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: -0.35,
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#8f7769',
    fontSize: 12,
    fontWeight: 700,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: 'none',
    background: '#f7eee7',
    color: '#9a5a45',
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
  },
  infoBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 16,
    padding: '12px 13px',
  },
  infoLabel: {
    color: '#8f7769',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  infoValue: {
    color: '#2d2521',
    fontSize: 13,
    fontWeight: 900,
  },
  errorBox: {
    background: '#fff0ec',
    border: '1px solid rgba(201,84,65,0.22)',
    color: '#c95441',
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  hint: {
    margin: 0,
    color: '#8f7769',
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.45,
    textAlign: 'center',
  },
};

const dn: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  arrow: { width: 30, height: 30, borderRadius: 10, border: 'none', background: '#f4ebe3', color: '#8b6657', cursor: 'pointer', fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid rgba(130,82,62,0.08)', color: '#8b5b49', padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 20px rgba(117,76,56,0.05)' },
};
