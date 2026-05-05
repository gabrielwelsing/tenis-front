// =============================================================================
// AGENDA SCREEN — v2
// Admin: horários fixos + manuais, solicitações, gestão de template
// User/Aluno: reservar horários, ver disponibilidade
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

// Interface legada (slots manuais — mantida)
interface Slot {
  id:          number;
  admin_email: string;
  data:        string;
  hora_inicio: string;
  hora_fim:    string;
  tipo:        string;
  vagas:       number;
  observacao:  string | null;
  status:      string;
}

// Slot unificado retornado pela nova rota /agenda/dia
interface SlotDia {
  source:            'fixo' | 'manual';
  fixo_id?:          number;
  override_id?:      number;
  slot_id?:          number;
  hora_inicio:       string;
  hora_fim:          string;
  tipo:              string;
  vagas:             number;
  vagas_confirmadas: number;
  perto1h:           boolean;
  status_manual?:    string;
  observacao?:       string | null;
  inscricoes?:       Inscricao[];
}

interface Inscricao {
  id:               number;
  admin_email:      string;
  data:             string;
  hora_inicio:      string;
  hora_fim:         string;
  email_aluno:      string;
  nome_aluno:       string;
  telefone_usuario: string | null;
  status:           string;
  confirmado_admin: boolean;
  created_at:       string;
  foto_url?:        string | null;
}

interface HorarioFixo {
  id:          number;
  admin_email: string;
  dia_semana:  number;
  hora_inicio: string;
  hora_fim:    string;
  ativo:       boolean;
}

interface AdminInfo {
  email:    string;
  telefone: string | null;
}

type AdminTab = 'agenda' | 'solicitacoes' | 'fixos';

const TIPOS = [
  { value: 'individual', label: 'Individual' },
  { value: 'coletivo',   label: 'Coletiva'   },
  { value: 'bloqueado',  label: 'Bloqueado'  },
];

const HORAS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

const TIPO_COLOR: Record<string, string> = {
  individual: '#c66b4d',
  coletivo:   '#3f8f5b',
  coletiva:   '#3f8f5b',
  bloqueado:  '#8d7b70',
};

const TIPO_LABEL: Record<string, string> = {
  individual: 'Individual',
  coletivo:   'Coletiva',
  coletiva:   'Coletiva',
  bloqueado:  'Bloqueado',
};

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayStr() { return new Date().toISOString().split('T')[0]; }

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

function buildWaAdmin(telefone: string, data: string, hi: string, hf: string, tipo: string) {
  const numero = `55${telefone.replace(/\D/g, '')}`;
  const msg = encodeURIComponent(
    `Olá, gostaria de reservar uma aula ${TIPO_LABEL[tipo] ?? tipo} no dia ${fmtDateBr(data)} das ${fmt(hi)} às ${fmt(hf)}.`
  );
  return `https://wa.me/${numero}?text=${msg}`;
}

function buildWaAluno(telefone: string, nome: string) {
  const numero = `55${telefone.replace(/\D/g, '')}`;
  const msg = encodeURIComponent(`Olá ${nome}, sobre o seu horário na agenda!`);
  return `https://wa.me/${numero}?text=${msg}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
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
  const isToday = data === todayStr();
  return (
    <div style={dn.wrap}>
      <button style={dn.arrow} onClick={() => setData(addDays(data, -1))}>‹</button>
      <button style={dn.label} onClick={() => setData(todayStr())}>
        <CalendarLineIcon size={15}/>
        <span>{isToday ? 'Hoje' : fmtDateBr(data)}</span>
      </button>
      <button style={dn.arrow} onClick={() => setData(addDays(data, 1))}>›</button>
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

  const [data,       setData]       = useState(todayStr());
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [adminInfo,  setAdminInfo]  = useState<AdminInfo | null>(null);
  const [adminTab,   setAdminTab]   = useState<AdminTab>('agenda');

  // Legado
  const [slots,     setSlots]     = useState<Slot[]>([]);

  // Novos
  const [slotsDia,      setSlotsDia]      = useState<SlotDia[]>([]);
  const [solicitacoes,  setSolicitacoes]  = useState<Inscricao[]>([]);
  const [horariosFixos, setHorariosFixos] = useState<HorarioFixo[]>([]);
  const [proximoEspera, setProximoEspera] = useState<Inscricao | null>(null);

  // Form slot manual (existente)
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, observacao: '' });

  // Form horário fixo
  const [showFormFixo, setShowFormFixo] = useState(false);
  const [formFixo, setFormFixo] = useState({ dia_semana: 1, hora_inicio: '07:00', hora_fim: '08:00' });

  // Override inline
  const [editandoOverride, setEditandoOverride] = useState<string | null>(null);
  const [formOverride, setFormOverride] = useState({ tipo: 'individual', vagas: 1 });

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  useEffect(() => {
    fetch(`${API}/agenda/admin-info`)
      .then(r => r.json()).then(setAdminInfo).catch(() => {});
  }, []);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadSlotsDia = useCallback(async () => {
    if (!adminInfo?.email) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/dia?admin_email=${encodeURIComponent(adminInfo.email)}&data=${data}&role=${role}`);
      const json = await r.json();
      setSlotsDia(Array.isArray(json) ? json : []);
    } catch { flash('err', 'Erro ao carregar horários.'); }
    setLoading(false);
  }, [adminInfo, data, role]);

  // Legado (mantido)
  const loadSlots = useCallback(async () => {
    if (!adminInfo?.email) return;
    try {
      const rota = isAdmin ? 'slots/admin' : 'slots';
      const r = await fetch(`${API}/agenda/${rota}?admin_email=${encodeURIComponent(adminInfo.email)}&data=${data}`);
      setSlots(await r.json());
    } catch { /* silent */ }
  }, [adminInfo, data, isAdmin]);

  const loadSolicitacoes = useCallback(async () => {
    if (!adminInfo?.email || !isAdmin) return;
    try {
      const r = await fetch(`${API}/agenda/solicitacoes?admin_email=${encodeURIComponent(adminInfo.email)}`);
      const json = await r.json();
      setSolicitacoes(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [adminInfo, isAdmin]);

  const loadHorariosFixos = useCallback(async () => {
    if (!adminInfo?.email || !isAdmin) return;
    try {
      const r = await fetch(`${API}/agenda/horarios-fixos?admin_email=${encodeURIComponent(adminInfo.email)}`);
      const json = await r.json();
      setHorariosFixos(Array.isArray(json) ? json : []);
    } catch { /* silent */ }
  }, [adminInfo, isAdmin]);

  useEffect(() => { loadSlotsDia(); loadSlots(); }, [loadSlotsDia, loadSlots]);
  useEffect(() => { loadSolicitacoes(); loadHorariosFixos(); }, [loadSolicitacoes, loadHorariosFixos]);

  // ── Actions existentes (mantidos) ─────────────────────────────────────────

  const saveSlot = async () => {
    if (!adminInfo?.email) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots`, {
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
    await fetch(`${API}/agenda/slots/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo?.email }),
    });
    flash('ok', 'Horário cancelado.');
    loadSlotsDia();
  };

  const toggleOcupado = async (slot: Slot) => {
    const ocupado = slot.status !== 'ocupado';
    await fetch(`${API}/agenda/slots/${slot.id}/ocupado`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo?.email, ocupado }),
    });
    flash('ok', ocupado ? 'Marcado como ocupado.' : 'Marcado como disponível.');
    loadSlotsDia();
  };

  const toggleOcupadoPorId = async (slotId: number, statusAtual: string) => {
    const legacySlot = { id: slotId, status: statusAtual } as Slot;
    await toggleOcupado(legacySlot);
  };

  // ── Novas actions ─────────────────────────────────────────────────────────

  const solicitarReserva = async (slot: SlotDia) => {
    if (!adminInfo?.email) return;
    try {
      const r = await fetch(`${API}/agenda/reservas`, {
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
      loadSlotsDia();
    } catch { flash('err', 'Erro de conexão.'); }
  };

  const confirmarReserva = async (id: number) => {
    if (!adminInfo?.email) return;
    try {
      const r = await fetch(`${API}/agenda/reservas/${id}/confirmar`, {
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
      const r = await fetch(`${API}/agenda/reservas/${id}/cancelar`, {
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
      await fetch(`${API}/agenda/slot-override`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_email: adminInfo.email, data,
          hora_inicio: slot.hora_inicio, hora_fim: slot.hora_fim,
          tipo: formOverride.tipo, vagas: formOverride.vagas, status: 'ativo',
        }),
      });
      flash('ok', 'Configuração salva para este dia!');
      setEditandoOverride(null);
      loadSlotsDia();
    } catch { flash('err', 'Erro ao salvar.'); }
  };

  const cancelarSlotDia = async (slot: SlotDia) => {
    if (!confirm('Cancelar este horário apenas neste dia?')) return;
    if (!adminInfo?.email) return;
    try {
      await fetch(`${API}/agenda/slot-override`, {
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
      const r = await fetch(`${API}/agenda/horarios-fixos`, {
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
    await fetch(`${API}/agenda/horarios-fixos/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo.email }),
    });
    flash('ok', 'Horário fixo removido.');
    loadHorariosFixos(); loadSlotsDia();
  };

  // ── Render: card de slot do dia ───────────────────────────────────────────

  const renderSlotDiaCard = (slot: SlotDia) => {
    const hi             = slot.hora_inicio;
    const cor            = TIPO_COLOR[slot.tipo] ?? '#c66b4d';
    const isEditing      = editandoOverride === hi;
    const isBloqueado    = slot.tipo === 'bloqueado';
    const manualOcupado  = slot.source === 'manual' && slot.status_manual === 'ocupado';
    const vagasDisp      = slot.vagas - slot.vagas_confirmadas;
    const estaOcupado    = !isBloqueado && !manualOcupado && vagasDisp <= 0;
    const minhaInscricao = slot.inscricoes?.find(i => i.email_aluno === emailUsuario && i.status !== 'cancelada');
    const corBorda       = isBloqueado || estaOcupado || manualOcupado ? '#d4c5bb' : cor;

    return (
      <div key={hi} style={{ ...sc.card, borderLeft: `4px solid ${corBorda}` }}>
        {/* Cabeçalho */}
        <div style={sc.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ ...sc.badge, color: isBloqueado || estaOcupado ? '#8d7b70' : cor, background: `${isBloqueado || estaOcupado ? '#8d7b70' : cor}16`, borderColor: `${isBloqueado || estaOcupado ? '#8d7b70' : cor}33` }}>
              {TIPO_LABEL[slot.tipo] ?? slot.tipo}
            </span>
            {slot.source === 'fixo' && <span style={sc.fixoBadge}>Fixo</span>}
            {(estaOcupado || manualOcupado) && <span style={sc.ocupadoBadge}>Ocupado</span>}
            {isBloqueado && <span style={sc.ocupadoBadge}>Bloqueado</span>}
          </div>

          {isAdmin && !isEditing && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {slot.source === 'fixo' && (
                <>
                  <button style={sc.editBtn} onClick={() => { setEditandoOverride(hi); setFormOverride({ tipo: slot.tipo, vagas: slot.vagas }); }}>
                    Editar dia
                  </button>
                  <button style={sc.delBtn} onClick={() => cancelarSlotDia(slot)}>✕</button>
                </>
              )}
              {slot.source === 'manual' && (
                <>
                  {!isBloqueado && (
                    <button
                      style={{ ...sc.ocupadoBtn, background: manualOcupado ? '#edf8ef' : '#fff4e8', color: manualOcupado ? '#3f8f5b' : '#b36a2f', borderColor: manualOcupado ? 'rgba(63,143,91,0.22)' : 'rgba(179,106,47,0.22)' }}
                      onClick={() => slot.slot_id && toggleOcupadoPorId(slot.slot_id, slot.status_manual ?? 'ativo')}
                    >
                      {manualOcupado ? 'Liberar' : 'Ocupar'}
                    </button>
                  )}
                  <button style={sc.delBtn} onClick={() => slot.slot_id && deleteSlot(slot.slot_id)}>✕</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Form override inline */}
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
                    onChange={e => setFormOverride(f => ({ ...f, vagas: Number(e.target.value) }))} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 13, fontWeight: 850, cursor: 'pointer' }} onClick={() => salvarOverride(slot)}>Salvar</button>
              <button style={{ flex: 0.6, padding: '10px 0', borderRadius: 12, border: '1px solid #eadfd6', background: '#fff', color: '#8f7769', fontSize: 13, cursor: 'pointer' }} onClick={() => setEditandoOverride(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Horário */}
        <div style={sc.timeRow}>
          <ClockLineIcon size={18}/>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#2d2521' }}>{fmt(slot.hora_inicio)} – {fmt(slot.hora_fim)}</span>
          {!isBloqueado && (
            <span style={{ fontSize: 12, color: '#94857a', marginLeft: 4 }}>
              {slot.tipo === 'individual' ? '1 vaga' : `${slot.vagas_confirmadas}/${slot.vagas} vagas`}
            </span>
          )}
        </div>

        {slot.observacao && <InfoItem icon={<NoteLineIcon size={16}/>} text={slot.observacao}/>}

        {/* Inscritos (admin) */}
        {isAdmin && slot.inscricoes && slot.inscricoes.length > 0 && (
          <div style={{ borderTop: '1px solid #f4ebe3', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 850, color: '#8f7769', textTransform: 'uppercase', letterSpacing: 0.5 }}>Inscritos</span>
            {slot.inscricoes.map(insc => (
              <div key={insc.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12,
                background: insc.status === 'confirmada' ? '#edf8ef' : insc.status === 'lista_espera' ? '#fff8e6' : '#fffaf7',
                border: `1px solid ${insc.status === 'confirmada' ? '#bee0c8' : insc.status === 'lista_espera' ? '#f0d58a' : '#eadfd6'}`,
                boxShadow: proximoEspera?.id === insc.id ? '0 0 0 2px #c66b4d' : 'none',
              }}>
                {avatarEl(insc.nome_aluno, insc.foto_url, 28)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{insc.nome_aluno}</div>
                  <div style={{ fontSize: 11, color: insc.status === 'confirmada' ? '#3f8f5b' : insc.status === 'lista_espera' ? '#b98718' : '#94857a', fontWeight: 700 }}>
                    {insc.status === 'confirmada' ? '✓ Confirmado' : insc.status === 'lista_espera' ? '⏳ Lista de espera' : '• Pendente'}
                    {proximoEspera?.id === insc.id ? ' ← próximo!' : ''}
                  </div>
                </div>
                {insc.telefone_usuario && (
                  <a href={buildWaAluno(insc.telefone_usuario, insc.nome_aluno)} target="_blank" rel="noopener noreferrer"
                    style={{ width: 28, height: 28, borderRadius: '50%', background: '#edf8ef', border: '1px solid #bee0c8', color: '#3f8f5b', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
                    <WaIcon/>
                  </a>
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

        {/* Ações usuário/aluno */}
        {!isAdmin && !isBloqueado && !manualOcupado && (
          <>
            {minhaInscricao ? (
              <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 750, padding: '10px 0',
                color: minhaInscricao.status === 'confirmada' ? '#3f8f5b' : minhaInscricao.status === 'lista_espera' ? '#b98718' : '#c66b4d' }}>
                {minhaInscricao.status === 'confirmada' ? '✓ Reserva confirmada!' :
                 minhaInscricao.status === 'lista_espera' ? '⏳ Você está na lista de espera' :
                 '⏳ Solicitação enviada — aguardando confirmação'}
              </div>
            ) : estaOcupado ? (
              <div style={sc.ocupadoInfo}>Este horário está ocupado</div>
            ) : slot.perto1h ? (
              adminInfo?.telefone ? (
                <a href={buildWaAdmin(adminInfo.telefone, data, slot.hora_inicio, slot.hora_fim, slot.tipo)}
                  target="_blank" rel="noopener noreferrer" style={sc.waBtn}>
                  <WaIcon/> Entre em contato para informar interesse
                </a>
              ) : null
            ) : (
              <button style={sc.reservarBtn} onClick={() => solicitarReserva(slot)}>Reservar</button>
            )}
          </>
        )}

        {!isAdmin && (isBloqueado || manualOcupado) && (
          <div style={sc.ocupadoInfo}>{isBloqueado ? 'Horário bloqueado' : 'Este horário está ocupado'}</div>
        )}
      </div>
    );
  };

  // ── Render: aba Solicitações ──────────────────────────────────────────────

  const renderSolicitacoes = () => {
    if (solicitacoes.length === 0) {
      return (
        <div style={s.emptyFeed}>
          <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
          <p style={s.emptyText}>Nenhuma solicitação ativa.</p>
          <p style={s.emptyHint}>Quando alguém reservar um horário, aparecerá aqui.</p>
        </div>
      );
    }

    const grupos: Record<string, Inscricao[]> = {};
    solicitacoes.forEach(i => {
      const key = `${i.data}|${i.hora_inicio}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(i);
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(grupos).map(([key, inscs]) => {
          const [dt, hi] = key.split('|');
          const hf = inscs[0].hora_fim;
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
                <div key={insc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  borderBottom: idx < inscs.length - 1 ? '1px solid #f4ebe3' : 'none',
                  background: proximoEspera?.id === insc.id ? '#fff8f0' : 'transparent',
                }}>
                  {avatarEl(insc.nome_aluno, insc.foto_url, 34)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 750, color: '#2d2521', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{insc.nome_aluno}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: insc.status === 'confirmada' ? '#3f8f5b' : insc.status === 'lista_espera' ? '#b98718' : '#94857a' }}>
                      {insc.status === 'confirmada' ? '✓ Confirmado' : insc.status === 'lista_espera' ? '⏳ Lista de espera' : '• Pendente'}
                      {proximoEspera?.id === insc.id ? ' ← próximo!' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {insc.telefone_usuario && (
                      <a href={buildWaAluno(insc.telefone_usuario, insc.nome_aluno)} target="_blank" rel="noopener noreferrer"
                        style={{ width: 30, height: 30, borderRadius: '50%', background: '#edf8ef', border: '1px solid #bee0c8', color: '#3f8f5b', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <WaIcon/>
                      </a>
                    )}
                    {insc.status !== 'confirmada' && insc.status !== 'cancelada' && (
                      <button style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}
                        onClick={() => confirmarReserva(insc.id)}>
                        Confirmar
                      </button>
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

  // ── Render: aba Horários Fixos ────────────────────────────────────────────

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
                  {HORAS.map(h => <option key={h}>{h}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Fim">
                <select style={s.select} value={formFixo.hora_fim} onChange={e => setFormFixo(f => ({ ...f, hora_fim: e.target.value }))}>
                  {HORAS.map(h => <option key={h}>{h}</option>)}
                </select>
              </FieldGroup>
            </div>
            <button style={s.publishBtn} onClick={adicionarHorarioFixo}>Adicionar</button>
          </div>
        )}

        {horariosFixos.length === 0 && (
          <div style={s.emptyFeed}>
            <p style={s.emptyText}>Nenhum horário fixo cadastrado.</p>
          </div>
        )}

        {Object.entries(porDia).sort(([a], [b]) => Number(a) - Number(b)).map(([dia, horas]) => (
          <div key={dia} style={{ background: '#fff', border: '1px solid rgba(130,82,62,0.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57,37,28,0.06)' }}>
            <div style={{ padding: '10px 14px', background: '#fffaf7', borderBottom: '1px solid #f4ebe3' }}>
              <span style={{ fontSize: 13, fontWeight: 850, color: '#b65b43' }}>{DIAS[Number(dia)]}</span>
            </div>
            {horas.map((h, idx) => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: idx < horas.length - 1 ? '1px solid #f4ebe3' : 'none' }}>
                <ClockLineIcon size={16}/>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#2d2521' }}>{fmt(h.hora_inicio)} – {fmt(h.hora_fim)}</span>
                <button style={sc.delBtn} onClick={() => removerHorarioFixo(h.id)}>✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.bgGlow1}/>
      <div style={s.bgGlow2}/>

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

      {isAdmin && (
        <div style={s.tabBar}>
          {([
            { key: 'agenda',       label: 'Agenda'         },
            { key: 'solicitacoes', label: 'Solicitações'   },
            { key: 'fixos',        label: 'Horários Fixos' },
          ] as { key: AdminTab; label: string }[]).map(t => (
            <button key={t.key} style={{ ...s.tabBtn, ...(adminTab === t.key ? s.tabActive : {}) }} onClick={() => setAdminTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={s.scrollBody}>
        <div style={s.inner}>

          {(!isAdmin || adminTab === 'agenda') && (
            <>
              <section style={s.heroCard}>
                <div style={s.heroText}>
                  <span style={s.heroKicker}>{isAdmin ? 'GESTÃO DE HORÁRIOS' : 'AGENDA DO PROFESSOR'}</span>
                  <h1 style={s.heroTitle}>{isAdmin ? 'Organize seus horários' : 'Escolha um horário disponível'}</h1>
                  <p style={s.heroSub}>
                    {isAdmin ? 'Crie, edite ou cancele horários para este dia.' : 'Veja a disponibilidade e solicite sua reserva.'}
                  </p>
                </div>
              </section>

              <section style={s.section}>
                <div style={s.sectionHead}>
                  <div style={s.sectionIcon}><CalendarLineIcon size={22}/></div>
                  <div style={s.sectionInfo}>
                    <h2 style={s.sectionTitle}>{isAdmin ? 'Meus horários' : 'Horários disponíveis'}</h2>
                    <DateNav data={data} setData={setData}/>
                  </div>
                  {isAdmin && (
                    <button onClick={() => setShowForm(v => !v)} style={s.newBtn}>{showForm ? 'Fechar' : '+ Novo'}</button>
                  )}
                </div>

                {isAdmin && showForm && (
                  <div style={s.formCard}>
                    <div style={s.formTop}>
                      <div>
                        <div style={s.formTitle}>Novo horário</div>
                        <div style={s.formSub}>{fmtDateBr(data)}</div>
                      </div>
                      <span style={s.formPill}>{TIPO_LABEL[form.tipo] ?? form.tipo}</span>
                    </div>
                    <div style={s.formRow}>
                      <FieldGroup label="Início">
                        <select style={s.select} value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                          {HORAS.map(h => <option key={h}>{h}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup label="Fim">
                        <select style={s.select} value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))}>
                          {HORAS.map(h => <option key={h}>{h}</option>)}
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
                          <input style={s.input} type="number" min={1} max={20} value={form.vagas}
                            onChange={e => setForm(f => ({ ...f, vagas: Number(e.target.value) }))}/>
                        </FieldGroup>
                      )}
                    </div>
                    <FieldGroup label="Observação">
                      <textarea style={s.textarea} rows={2} placeholder="Informações para o aluno (opcional)…"
                        value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}/>
                    </FieldGroup>
                    <button style={{ ...s.publishBtn, opacity: loading ? 0.6 : 1 }} onClick={saveSlot} disabled={loading}>
                      {loading ? 'Salvando…' : 'Salvar horário'}
                    </button>
                  </div>
                )}

                {loading && (
                  <div style={s.loadingBox}>
                    <div style={s.loadingDot}/>
                    <p style={s.loadingTxt}>Carregando horários…</p>
                  </div>
                )}

                {!loading && slotsDia.length === 0 && (
                  <div style={s.emptyFeed}>
                    <div style={s.emptyIcon}><CalendarLineIcon size={34}/></div>
                    <p style={s.emptyText}>Nenhum horário em {fmtDateBr(data)}.</p>
                    <p style={s.emptyHint}>{isAdmin ? 'Clique em "+ Novo" para adicionar.' : 'Tente outro dia.'}</p>
                  </div>
                )}

                {!loading && slotsDia.length > 0 && (
                  <div style={s.slotList}>{slotsDia.map(sl => renderSlotDiaCard(sl))}</div>
                )}
              </section>
            </>
          )}

          {isAdmin && adminTab === 'solicitacoes' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><UserOutlineIcon size={20}/></div>
                <div style={s.sectionInfo}>
                  <h2 style={s.sectionTitle}>Solicitações</h2>
                  <span style={{ fontSize: 12, color: '#94857a' }}>Gerencie quem quer aula</span>
                </div>
              </div>
              {renderSolicitacoes()}
            </section>
          )}

          {isAdmin && adminTab === 'fixos' && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <div style={s.sectionIcon}><ClockLineIcon size={20}/></div>
                <div style={s.sectionInfo}>
                  <h2 style={s.sectionTitle}>Horários Fixos</h2>
                  <span style={{ fontSize: 12, color: '#94857a' }}>Recorrência semanal</span>
                </div>
              </div>
              {renderHorariosFixos()}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Estilos
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
  fixoBadge: { fontSize: 10, fontWeight: 850, padding: '4px 8px', borderRadius: 999, background: '#f0f4ff', border: '1px solid #c7d2f5', color: '#5b72c4' },
  ocupadoBadge: { fontSize: 11, fontWeight: 850, padding: '5px 10px', borderRadius: 999, background: '#f1e9e4', border: '1px solid #e5d8cf', color: '#8d7b70' },
  editBtn: { padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(198,107,77,0.3)', background: '#fff1eb', color: '#b65b43', fontSize: 11, fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' },
  ocupadoBtn: { padding: '6px 10px', borderRadius: 999, border: '1px solid', fontSize: 11, fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' },
  delBtn: { width: 30, height: 30, borderRadius: '50%', background: '#fff4f0', border: '1px solid rgba(201,84,65,0.16)', color: '#c95441', fontSize: 15, cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  timeRow: { display: 'flex', alignItems: 'center', gap: 8, color: '#c66b4d' },
  infoItem: { display: 'flex', alignItems: 'center', gap: 9, color: '#8f7769' },
  infoIcon: { color: '#c66b4d', display: 'flex', alignItems: 'center', flexShrink: 0 },
  infoText: { color: '#6f625b', fontSize: 13, fontWeight: 650, lineHeight: 1.35 },
  reservarBtn: { width: '100%', padding: '13px 0', borderRadius: 16, background: 'linear-gradient(135deg, #c66b4d, #934836)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(147,72,54,0.18)' },
  waBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px 14px', borderRadius: 999, background: 'linear-gradient(135deg, #1b8f45, #146d35)', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none', boxShadow: '0 8px 16px rgba(27,143,69,0.18)' },
  ocupadoInfo: { textAlign: 'center', fontSize: 12.5, color: '#8f7769', fontWeight: 750, padding: '6px 0' },
  okBtn: { padding: '10px 0', borderRadius: 13, border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 12, fontWeight: 850, cursor: 'pointer' },
  disputeBtn: { padding: '10px 0', borderRadius: 13, border: '1px solid rgba(201,84,65,0.22)', background: '#fff0ec', color: '#c95441', fontSize: 12, fontWeight: 850, cursor: 'pointer' },
  okBtnSm: { width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#3f8f5b', color: '#fff', fontSize: 14, cursor: 'pointer', flexShrink: 0 },
};

const dn: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  arrow: { width: 30, height: 30, borderRadius: 10, border: 'none', background: '#f4ebe3', color: '#8b6657', cursor: 'pointer', fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid rgba(130,82,62,0.08)', color: '#8b5b49', padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 20px rgba(117,76,56,0.05)' },
};
