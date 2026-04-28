// =============================================================================
// AGENDA SCREEN — Horários do Admin + inscrições dos alunos
// Admin: gerencia slots e confirma inscrições
// Aluno/User: busca horários por admin e se inscreve
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';

interface Props {
  onBack:       () => void;
  emailUsuario: string;
  role:         'user' | 'aluno' | 'admin';
  username:     string;
}

interface Inscricao {
  id:               number;
  slot_id:          number;
  email_aluno:      string;
  nome_aluno:       string;
  recorrencia:      string;
  confirmado_admin: boolean;
  status:           string;
  data?:            string;
  hora_inicio?:     string;
  hora_fim?:        string;
  tipo?:            string;
}

interface Slot {
  id:             number;
  admin_email:    string;
  data:           string;
  hora_inicio:    string;
  hora_fim:       string;
  tipo:           string;
  vagas:          number;
  vagas_ocupadas: number;
  periodicity:    string;
  observacao:     string | null;
  status:         string;
  inscricoes:     Inscricao[];
}

const TIPOS = [
  { value: 'individual', label: 'Individual' },
  { value: 'coletiva',   label: 'Coletiva'   },
  { value: 'bloqueado',  label: 'Bloqueado'  },
];
const PERIODICITY = [
  { value: 'unico',   label: 'Único'        },
  { value: 'semana',  label: 'Toda semana'  },
  { value: 'mes',     label: 'Todo mês'     },
  { value: '3meses',  label: '3 meses'      },
  { value: 'sempre',  label: 'Sempre'       },
];
const HORAS = Array.from({ length: 18 }, (_, i) => {
  const h = (i + 6).toString().padStart(2, '0');
  return `${h}:00`;
});

function fmt(t: string) { return t?.slice(0, 5) ?? ''; }

function todayStr() { return new Date().toISOString().split('T')[0]; }

function addDays(s: string, n: number) {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDateBr(s: string) {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const [y, m, d] = s.split('-');
  const dt = new Date(s + 'T12:00:00');
  return `${dias[dt.getDay()]} ${d}/${m}/${y}`;
}

const tipoColor: Record<string, string> = {
  individual: '#0097a7',
  coletiva:   '#388e3c',
  bloqueado:  '#555',
};
const tipoLabel: Record<string, string> = {
  individual: 'Individual',
  coletiva:   'Coletiva',
  bloqueado:  'Bloqueado',
};

export default function AgendaScreen({ onBack, emailUsuario, role, username }: Props) {
  const isAdmin = role === 'admin';

  // Common state
  const [data, setData] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin state
  const [tab, setTab]               = useState<'horarios' | 'confirmacoes'>('horarios');
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [confirmacoes, setConfirmacoes] = useState<Inscricao[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({
    hora_inicio: '07:00',
    hora_fim:    '08:00',
    tipo:        'individual',
    vagas:       1,
    periodicity: 'unico',
    observacao:  '',
  });

  // Student state
  const [adminEmail, setAdminEmail]           = useState(() => localStorage.getItem('tenis_agenda_admin') ?? '');
  const [adminEmailInput, setAdminEmailInput] = useState(() => localStorage.getItem('tenis_agenda_admin') ?? '');
  const [studentSlots, setStudentSlots]       = useState<Slot[]>([]);
  const [myInscricoes, setMyInscricoes]       = useState<Record<number, Inscricao>>({});
  const [bookingSlot, setBookingSlot]         = useState<Slot | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  // ─── Admin: load slots ──────────────────────────────────────────────────────
  const loadAdminSlots = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots/admin?admin_email=${encodeURIComponent(emailUsuario)}&data=${data}`);
      setSlots(await r.json());
    } catch { flash('err', 'Erro ao carregar horários.'); }
    setLoading(false);
  }, [isAdmin, emailUsuario, data]);

  // ─── Admin: load confirmações pendentes ─────────────────────────────────────
  const loadConfirmacoes = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch(`${API}/agenda/confirmacoes?admin_email=${encodeURIComponent(emailUsuario)}`);
      setConfirmacoes(await r.json());
    } catch { /* silent */ }
  }, [isAdmin, emailUsuario]);

  useEffect(() => { loadAdminSlots(); loadConfirmacoes(); }, [loadAdminSlots, loadConfirmacoes]);

  // ─── Student: load slots ────────────────────────────────────────────────────
  const loadStudentSlots = useCallback(async () => {
    if (isAdmin || !adminEmail) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots?admin_email=${encodeURIComponent(adminEmail)}&data=${data}`);
      const rows: Slot[] = await r.json();
      setStudentSlots(rows);
      const map: Record<number, Inscricao> = {};
      rows.forEach(sl => {
        const mine = sl.inscricoes?.find(i => i.email_aluno === emailUsuario && i.status !== 'cancelada');
        if (mine) map[sl.id] = mine;
      });
      setMyInscricoes(map);
    } catch { flash('err', 'Erro ao carregar horários.'); }
    setLoading(false);
  }, [isAdmin, adminEmail, data, emailUsuario]);

  useEffect(() => { loadStudentSlots(); }, [loadStudentSlots]);

  // ─── Admin: criar/atualizar slot ────────────────────────────────────────────
  const saveSlot = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ admin_email: emailUsuario, data, ...form }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Horário salvo!');
      setShowForm(false);
      setForm({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, periodicity: 'unico', observacao: '' });
      loadAdminSlots();
    } catch { flash('err', 'Erro ao salvar.'); }
    setLoading(false);
  };

  // ─── Admin: deletar slot ────────────────────────────────────────────────────
  const deleteSlot = async (id: number) => {
    if (!confirm('Remover este horário?')) return;
    await fetch(`${API}/agenda/slots/${id}`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ admin_email: emailUsuario }),
    });
    loadAdminSlots();
  };

  // ─── Admin: confirmar/rejeitar inscrição ────────────────────────────────────
  const confirmar = async (id: number, ok: boolean) => {
    await fetch(`${API}/agenda/inscricoes/${id}/confirmar`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirmar: ok }),
    });
    flash('ok', ok ? 'Inscrição confirmada!' : 'Inscrição rejeitada.');
    loadConfirmacoes();
    loadAdminSlots();
  };

  // ─── Student: inscrever ──────────────────────────────────────────────────────
  const inscrever = async (slotId: number) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots/${slotId}/inscrever`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email_aluno: emailUsuario, nome_aluno: username }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Inscrição realizada! Aguardando confirmação.');
      setBookingSlot(null);
      loadStudentSlots();
    } catch { flash('err', 'Erro ao se inscrever.'); }
    setLoading(false);
  };

  // ─── Student: cancelar inscrição ─────────────────────────────────────────────
  const cancelarInscricao = async (inscId: number) => {
    if (!confirm('Cancelar sua inscrição?')) return;
    await fetch(`${API}/agenda/inscricoes/${inscId}`, { method: 'DELETE' });
    flash('ok', 'Inscrição cancelada.');
    loadStudentSlots();
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────
  const DateNav = () => (
    <div style={s.dateNav}>
      <button style={s.arrowBtn} onClick={() => setData(d => addDays(d, -1))}>{'‹'}</button>
      <button style={s.dateLabel} onClick={() => setData(todayStr())}>
        {data === todayStr() ? 'Hoje' : fmtDateBr(data)}
      </button>
      <button style={s.arrowBtn} onClick={() => setData(d => addDays(d, 1))}>{'›'}</button>
    </div>
  );

  // ─── Admin view ──────────────────────────────────────────────────────────────
  const renderAdmin = () => (
    <>
      <div style={s.tabs}>
        <button style={{ ...s.tabBtn, ...(tab === 'horarios' ? s.tabActive : {}) }} onClick={() => setTab('horarios')}>
          Horários
        </button>
        <button style={{ ...s.tabBtn, ...(tab === 'confirmacoes' ? s.tabActive : {}) }} onClick={() => setTab('confirmacoes')}>
          Confirmações
          {confirmacoes.length > 0 && <span style={s.badge}>{confirmacoes.length}</span>}
        </button>
      </div>

      {tab === 'horarios' && (
        <>
          <DateNav />

          {loading && <div style={s.loadingText}>Carregando...</div>}

          {!loading && slots.length === 0 && (
            <div style={s.emptyState}>Nenhum horário configurado para este dia.</div>
          )}

          {slots.map(sl => (
            <div key={sl.id} style={{ ...s.slotCard, borderLeft: `4px solid ${tipoColor[sl.tipo] ?? '#555'}` }}>
              <div style={s.slotRow}>
                <span style={s.slotTime}>{fmt(sl.hora_inicio)} – {fmt(sl.hora_fim)}</span>
                <span style={{ ...s.slotTipo, background: tipoColor[sl.tipo] ?? '#555' }}>
                  {tipoLabel[sl.tipo] ?? sl.tipo}
                </span>
                <button style={s.deleteBtn} onClick={() => deleteSlot(sl.id)}>✕</button>
              </div>

              {sl.tipo !== 'bloqueado' && (
                <div style={s.slotVagas}>
                  {sl.vagas_ocupadas}/{sl.vagas} vaga{sl.vagas > 1 ? 's' : ''}
                  {sl.periodicity !== 'unico' && <span style={s.periodLabel}> · {PERIODICITY.find(p => p.value === sl.periodicity)?.label}</span>}
                </div>
              )}

              {sl.observacao && <div style={s.slotObs}>{sl.observacao}</div>}

              {sl.inscricoes?.filter(i => i.status !== 'cancelada').map(i => (
                <div key={i.id} style={s.inscricaoRow}>
                  <span style={s.inscNome}>{i.nome_aluno}</span>
                  <span style={{ ...s.inscStatus, color: i.status === 'confirmada' ? '#4caf50' : i.status === 'cancelada' ? '#f44336' : '#ffa726' }}>
                    {i.status === 'confirmada' ? 'Confirmado' : i.status === 'cancelada' ? 'Cancelado' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          ))}

          <button style={s.addBtn} onClick={() => setShowForm(v => !v)}>
            {showForm ? '– Fechar formulário' : '+ Novo Horário'}
          </button>

          {showForm && (
            <div style={s.formCard}>
              <div style={s.formTitle}>Novo Horário — {fmtDateBr(data)}</div>

              <div style={s.formRow}>
                <div style={s.formGroup}>
                  <label style={s.label}>Início</label>
                  <select style={s.select} value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                    {HORAS.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Fim</label>
                  <select style={s.select} value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))}>
                    {HORAS.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div style={s.formRow}>
                <div style={s.formGroup}>
                  <label style={s.label}>Tipo</label>
                  <select style={s.select} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {form.tipo !== 'bloqueado' && (
                  <div style={s.formGroup}>
                    <label style={s.label}>Vagas</label>
                    <input style={s.input} type="number" min={1} max={20} value={form.vagas}
                      onChange={e => setForm(f => ({ ...f, vagas: Number(e.target.value) }))} />
                  </div>
                )}
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Periodicidade</label>
                <select style={s.select} value={form.periodicity} onChange={e => setForm(f => ({ ...f, periodicity: e.target.value }))}>
                  {PERIODICITY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Observação</label>
                <textarea style={s.textarea} rows={3} placeholder="Informações para o aluno (opcional)..."
                  value={form.observacao}
                  onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>

              <button style={{ ...s.saveBtn, opacity: loading ? 0.6 : 1 }} onClick={saveSlot} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Horário'}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'confirmacoes' && (
        <>
          {confirmacoes.length === 0 && (
            <div style={s.emptyState}>Nenhuma inscrição pendente.</div>
          )}
          {confirmacoes.map(i => (
            <div key={i.id} style={s.confirmCard}>
              <div style={s.confirmName}>{i.nome_aluno}</div>
              <div style={s.confirmDetail}>
                {i.data ? fmtDateBr(i.data) : ''} · {fmt(i.hora_inicio ?? '')} – {fmt(i.hora_fim ?? '')}
              </div>
              <div style={s.confirmDetail}>{tipoLabel[i.tipo ?? ''] ?? i.tipo} · {i.email_aluno}</div>
              <div style={s.confirmBtns}>
                <button style={s.confirmOkBtn}  onClick={() => confirmar(i.id, true)}>Confirmar</button>
                <button style={s.confirmNoBtn}  onClick={() => confirmar(i.id, false)}>Rejeitar</button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );

  // ─── Student view ─────────────────────────────────────────────────────────────
  const renderStudent = () => (
    <>
      <div style={s.adminSearchRow}>
        <input
          style={s.adminInput}
          placeholder="E-mail do admin (ex: prof@exemplo.com)"
          value={adminEmailInput}
          onChange={e => setAdminEmailInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyAdmin(); }}
        />
        <button style={s.searchBtn} onClick={applyAdmin}>Buscar</button>
      </div>

      {adminEmail && (
        <>
          <DateNav />

          {loading && <div style={s.loadingText}>Carregando...</div>}

          {!loading && studentSlots.length === 0 && (
            <div style={s.emptyState}>Nenhum horário disponível para este dia.</div>
          )}

          {studentSlots.map(sl => {
            const minha = myInscricoes[sl.id];
            const vagas_livres = sl.vagas - sl.vagas_ocupadas;
            return (
              <div key={sl.id} style={{ ...s.slotCard, borderLeft: `4px solid ${tipoColor[sl.tipo] ?? '#0097a7'}` }}>
                <div style={s.slotRow}>
                  <span style={s.slotTime}>{fmt(sl.hora_inicio)} – {fmt(sl.hora_fim)}</span>
                  <span style={{ ...s.slotTipo, background: tipoColor[sl.tipo] ?? '#0097a7' }}>
                    {tipoLabel[sl.tipo] ?? sl.tipo}
                  </span>
                </div>

                <div style={s.slotVagas}>{vagas_livres} vaga{vagas_livres !== 1 ? 's' : ''} disponível{vagas_livres !== 1 ? 'is' : ''}</div>

                {sl.observacao && <div style={s.slotObs}>{sl.observacao}</div>}

                {minha ? (
                  <div style={s.statusRow}>
                    <span style={{
                      ...s.statusPill,
                      background: minha.status === 'confirmada' ? 'rgba(76,175,80,0.15)' : 'rgba(255,167,38,0.15)',
                      color:      minha.status === 'confirmada' ? '#4caf50' : '#ffa726',
                      border:     `1px solid ${minha.status === 'confirmada' ? '#4caf50' : '#ffa726'}`,
                    }}>
                      {minha.status === 'confirmada' ? '✓ Confirmado' : '⏳ Aguardando confirmação'}
                    </span>
                    <button style={s.cancelSmallBtn} onClick={() => cancelarInscricao(minha.id)}>Cancelar</button>
                  </div>
                ) : (
                  <button
                    style={{ ...s.reservarBtn, opacity: vagas_livres <= 0 ? 0.4 : 1 }}
                    disabled={vagas_livres <= 0 || loading}
                    onClick={() => inscrever(sl.id)}
                  >
                    {vagas_livres <= 0 ? 'Sem vagas' : 'Reservar'}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );

  const applyAdmin = () => {
    const v = adminEmailInput.trim().toLowerCase();
    if (!v) return;
    setAdminEmail(v);
    localStorage.setItem('tenis_agenda_admin', v);
  };

  return (
    <div style={s.page}>
      <div style={s.bgGlow} />

      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹ Voltar</button>
        <h2 style={s.title}>Agenda</h2>
        <div style={{ width: 64 }} />
      </div>

      {msg && (
        <div style={{ ...s.toast, background: msg.type === 'ok' ? 'rgba(76,175,80,0.9)' : 'rgba(244,67,54,0.9)' }}>
          {msg.text}
        </div>
      )}

      <div style={s.body}>
        {isAdmin ? renderAdmin() : renderStudent()}
      </div>

      {bookingSlot && (
        <div style={s.overlay} onClick={() => setBookingSlot(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Confirmar reserva</div>
            <div style={s.modalInfo}>
              {fmt(bookingSlot.hora_inicio)} – {fmt(bookingSlot.hora_fim)} · {fmtDateBr(data)}
            </div>
            <div style={s.modalInfo}>{bookingSlot.observacao}</div>
            <div style={s.modalBtns}>
              <button style={s.confirmOkBtn} onClick={() => inscrever(bookingSlot.id)} disabled={loading}>
                {loading ? 'Aguarde...' : 'Confirmar'}
              </button>
              <button style={s.confirmNoBtn} onClick={() => setBookingSlot(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'fixed', inset: 0, background: '#0a0a0f',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute', top: '-20%', right: '-20%',
    width: '60vw', height: '60vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
    borderBottom: '1px solid rgba(0,229,255,0.1)',
    background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(8px)',
    position: 'relative', zIndex: 10,
  },
  backBtn: {
    background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
    color: '#00e5ff', padding: '8px 14px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 64,
  },
  title: {
    color: '#fff', fontSize: 18, fontWeight: 800, margin: 0,
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '16px 16px 40px',
    maxWidth: 540, width: '100%', margin: '0 auto',
    boxSizing: 'border-box',
  },
  toast: {
    position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 10, color: '#fff',
    fontSize: 13, fontWeight: 600, zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  tabs: {
    display: 'flex', gap: 8, marginBottom: 16,
    background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4,
  },
  tabBtn: {
    flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.5)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabActive: { background: 'rgba(0,229,255,0.12)', color: '#00e5ff' },
  badge: {
    background: '#ff4444', color: '#fff',
    borderRadius: 10, fontSize: 11, fontWeight: 800,
    padding: '2px 7px', lineHeight: 1.4,
  },
  dateNav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, background: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: '8px 12px',
  },
  arrowBtn: {
    background: 'none', border: 'none', color: '#00e5ff',
    fontSize: 24, cursor: 'pointer', padding: '0 8px', lineHeight: 1,
  },
  dateLabel: {
    background: 'none', border: 'none', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  loadingText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20, fontSize: 14 },
  emptyState: {
    color: 'rgba(255,255,255,0.3)', textAlign: 'center',
    padding: '32px 16px', fontSize: 14,
  },
  slotCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '14px 14px 12px',
    marginBottom: 10,
  },
  slotRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
  },
  slotTime: { color: '#fff', fontSize: 16, fontWeight: 800, flex: 1 },
  slotTipo: {
    fontSize: 11, fontWeight: 700, padding: '3px 10px',
    borderRadius: 20, color: '#fff', textTransform: 'capitalize',
  },
  deleteBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
    fontSize: 16, cursor: 'pointer', padding: '0 4px',
  },
  slotVagas: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 },
  slotObs: {
    color: 'rgba(0,229,255,0.7)', fontSize: 12, marginTop: 4,
    fontStyle: 'italic', lineHeight: 1.4,
  },
  periodLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  inscricaoRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, padding: '6px 10px',
    background: 'rgba(255,255,255,0.04)', borderRadius: 8,
  },
  inscNome: { color: '#fff', fontSize: 13, fontWeight: 600 },
  inscStatus: { fontSize: 11, fontWeight: 700 },
  addBtn: {
    width: '100%', padding: '14px 0', borderRadius: 14, marginTop: 4,
    background: 'rgba(0,229,255,0.08)', border: '1px dashed rgba(0,229,255,0.3)',
    color: '#00e5ff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  formCard: {
    background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)',
    borderRadius: 16, padding: 16, marginTop: 10,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  formTitle: { color: '#00e5ff', fontSize: 14, fontWeight: 700 },
  formRow: { display: 'flex', gap: 10 },
  formGroup: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  select: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, color: '#fff', padding: '10px 12px', fontSize: 14,
    width: '100%',
  },
  input: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, color: '#fff', padding: '10px 12px', fontSize: 14,
    width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, color: '#fff', padding: '10px 12px', fontSize: 14,
    width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
  },
  saveBtn: {
    width: '100%', padding: '14px 0', borderRadius: 12,
    background: 'linear-gradient(135deg, #006064, #0097a7)',
    border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,151,167,0.4)',
  },
  confirmCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px', marginBottom: 10,
  },
  confirmName:   { color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 },
  confirmDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
  confirmBtns:   { display: 'flex', gap: 10, marginTop: 10 },
  confirmOkBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
    background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  confirmNoBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
    background: 'rgba(244,67,54,0.15)', color: '#f44336', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', borderWidth: 1, borderStyle: 'solid', borderColor: '#f44336',
  },
  adminSearchRow: {
    display: 'flex', gap: 10, marginBottom: 16,
  },
  adminInput: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12, color: '#fff', padding: '12px 14px', fontSize: 13,
    boxSizing: 'border-box',
  },
  searchBtn: {
    background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)',
    color: '#00e5ff', borderRadius: 12, padding: '12px 16px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  statusRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
  },
  statusPill: {
    flex: 1, textAlign: 'center', padding: '7px 12px',
    borderRadius: 20, fontSize: 12, fontWeight: 700,
  },
  cancelSmallBtn: {
    background: 'none', border: '1px solid rgba(244,67,54,0.4)',
    color: '#f44336', borderRadius: 8, padding: '6px 10px',
    fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  reservarBtn: {
    width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #006064, #0097a7)',
    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    marginTop: 8, boxShadow: '0 2px 12px rgba(0,151,167,0.3)',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 16,
  },
  modal: {
    background: '#141420', border: '1px solid rgba(0,229,255,0.2)',
    borderRadius: 18, padding: 24, width: '100%', maxWidth: 360,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 800 },
  modalInfo:  { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  modalBtns:  { display: 'flex', gap: 10, marginTop: 4 },
};
