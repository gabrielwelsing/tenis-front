// =============================================================================
// AGENDA SCREEN — visual alinhado com MuralScreen
// Admin: gerencia slots, observações e confirma inscrições
// Aluno/User: escolhe professor, vê horários e se inscreve
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

const TIPOS      = [{ value: 'individual', label: 'Individual' }, { value: 'coletiva', label: 'Coletiva' }, { value: 'bloqueado', label: 'Bloqueado' }];
const PERIODICITY = [{ value: 'unico', label: 'Único' }, { value: 'semana', label: 'Toda semana' }, { value: 'mes', label: 'Todo mês' }, { value: '3meses', label: '3 meses' }, { value: 'sempre', label: 'Sempre' }];
const HORAS      = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);

const TIPO_COLOR: Record<string, string> = { individual: '#4fc3f7', coletiva: '#81c784', bloqueado: '#757575' };
const TIPO_LABEL: Record<string, string> = { individual: 'Individual', coletiva: 'Coletiva', bloqueado: 'Bloqueado' };

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function todayStr() { return new Date().toISOString().split('T')[0]; }
function addDays(s: string, n: number) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }
function fmtDateBr(s: string) { const dt = new Date(s + 'T12:00:00'); const [, m, d] = s.split('-'); return `${DIAS[dt.getDay()]}, ${d}/${m}`; }
function fmt(t: string) { return t?.slice(0, 5) ?? ''; }

// ─── Modal para escolher o professor ─────────────────────────────────────────
function AdminPickerModal({ onConfirm, onBack }: { onConfirm: (e: string) => void; onBack: () => void }) {
  const [input, setInput] = useState('');
  const [erro, setErro]   = useState('');
  const handle = () => {
    const v = input.trim().toLowerCase();
    if (!v || !v.includes('@')) { setErro('Digite um e-mail válido.'); return; }
    onConfirm(v);
  };
  return (
    <div style={pm.overlay}>
      <div style={pm.sheet}>
        <button onClick={onBack} style={pm.backBtn}>← Voltar</button>
        <div style={{ fontSize: 52, lineHeight: 1 }}>📅</div>
        <h2 style={pm.title}>Qual é o seu professor?</h2>
        <p style={pm.sub}>Digite o e-mail do professor para ver os horários disponíveis.</p>
        <input style={pm.input} placeholder="prof@exemplo.com" type="email" inputMode="email"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()} autoFocus autoCapitalize="none" />
        {erro && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{erro}</p>}
        <button onClick={handle} style={pm.confirmBtn} disabled={!input.trim()}>Ver Agenda →</button>
      </div>
    </div>
  );
}

// ─── DateNav ─────────────────────────────────────────────────────────────────
function DateNav({ data, setData }: { data: string; setData: (d: string) => void }) {
  const isToday = data === todayStr();
  return (
    <div style={dn.wrap}>
      <button style={dn.arrow} onClick={() => setData(addDays(data, -1))}>‹</button>
      <button style={dn.label} onClick={() => setData(todayStr())}>
        {isToday ? 'Hoje' : fmtDateBr(data)}
      </button>
      <button style={dn.arrow} onClick={() => setData(addDays(data, 1))}>›</button>
    </div>
  );
}

// =============================================================================
export default function AgendaScreen({ onBack, emailUsuario, role, username }: Props) {
  const isAdmin = role === 'admin';

  const [data, setData]     = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin
  const [tab, setTab]           = useState<'horarios' | 'confirmacoes'>('horarios');
  const [slots, setSlots]       = useState<Slot[]>([]);
  const [confirmacoes, setConfirmacoes] = useState<Inscricao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, periodicity: 'unico', observacao: '' });

  // Aluno
  const [adminEmail, setAdminEmail]           = useState(() => localStorage.getItem('tenis_agenda_admin') ?? '');
  const [showPicker, setShowPicker]           = useState(!localStorage.getItem('tenis_agenda_admin') && !isAdmin);
  const [studentSlots, setStudentSlots]       = useState<Slot[]>([]);
  const [myInscricoes, setMyInscricoes]       = useState<Record<number, Inscricao>>({});

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  // Admin: carrega slots
  const loadAdminSlots = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots/admin?admin_email=${encodeURIComponent(emailUsuario)}&data=${data}`);
      setSlots(await r.json());
    } catch { flash('err', 'Erro ao carregar horários.'); }
    setLoading(false);
  }, [isAdmin, emailUsuario, data]);

  const loadConfirmacoes = useCallback(async () => {
    if (!isAdmin) return;
    try { const r = await fetch(`${API}/agenda/confirmacoes?admin_email=${encodeURIComponent(emailUsuario)}`); setConfirmacoes(await r.json()); } catch { /* silent */ }
  }, [isAdmin, emailUsuario]);

  useEffect(() => { loadAdminSlots(); loadConfirmacoes(); }, [loadAdminSlots, loadConfirmacoes]);

  // Aluno: carrega slots do professor
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

  const saveSlot = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_email: emailUsuario, data, ...form }) });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Horário salvo!');
      setShowForm(false);
      setForm({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, periodicity: 'unico', observacao: '' });
      loadAdminSlots();
    } catch { flash('err', 'Erro ao salvar.'); }
    setLoading(false);
  };

  const deleteSlot = async (id: number) => {
    if (!confirm('Remover este horário?')) return;
    await fetch(`${API}/agenda/slots/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_email: emailUsuario }) });
    loadAdminSlots();
  };

  const confirmar = async (id: number, ok: boolean) => {
    await fetch(`${API}/agenda/inscricoes/${id}/confirmar`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmar: ok }) });
    flash('ok', ok ? 'Inscrição confirmada!' : 'Inscrição rejeitada.');
    loadConfirmacoes(); loadAdminSlots();
  };

  const inscrever = async (slotId: number) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots/${slotId}/inscrever`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_aluno: emailUsuario, nome_aluno: username }) });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Inscrição realizada! Aguardando confirmação.');
      loadStudentSlots();
    } catch { flash('err', 'Erro ao se inscrever.'); }
    setLoading(false);
  };

  const cancelarInscricao = async (inscId: number) => {
    if (!confirm('Cancelar sua inscrição?')) return;
    await fetch(`${API}/agenda/inscricoes/${inscId}`, { method: 'DELETE' });
    flash('ok', 'Inscrição cancelada.');
    loadStudentSlots();
  };

  const handleConfirmAdmin = (email: string) => {
    localStorage.setItem('tenis_agenda_admin', email);
    setAdminEmail(email);
    setShowPicker(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const slotsToShow  = isAdmin ? slots : studentSlots;
  const pendingCount = confirmacoes.length;

  return (
    <div style={s.page}>

      {showPicker && <AdminPickerModal onConfirm={handleConfirmAdmin} onBack={onBack} />}

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <div style={s.headerCenter}>
          <span style={s.headerTitle}>Agenda</span>
          {!isAdmin && adminEmail && (
            <button onClick={() => setShowPicker(true)} style={s.profBtn}>
              👨‍🏫 {adminEmail.split('@')[0]}
            </button>
          )}
        </div>
        <span style={{ width: 70, flexShrink: 0 }} />
      </div>

      {msg && (
        <div style={{ ...s.toast, background: msg.type === 'ok' ? 'rgba(56,142,60,0.95)' : 'rgba(198,40,40,0.95)' }}>
          {msg.text}
        </div>
      )}

      <div style={s.scrollBody}>
        <div style={s.inner}>

          {/* ── ADMIN ─────────────────────────────────────────────── */}
          {isAdmin && (
            <>
              {/* Tabs */}
              <div style={s.tabRow}>
                <button style={{ ...s.tabBtn, ...(tab === 'horarios' ? s.tabActive : {}) }} onClick={() => setTab('horarios')}>
                  Meus Horários
                </button>
                <button style={{ ...s.tabBtn, ...(tab === 'confirmacoes' ? s.tabActive : {}) }} onClick={() => setTab('confirmacoes')}>
                  Confirmações {pendingCount > 0 && <span style={s.tabBadge}>{pendingCount}</span>}
                </button>
              </div>

              {tab === 'horarios' && (
                <section style={s.section}>
                  <div style={s.sectionHead}>
                    <span style={s.sectionIcon}>📅</span>
                    <div style={{ flex: 1 }}>
                      <h2 style={s.sectionTitle}>Horários do Dia</h2>
                      <DateNav data={data} setData={setData} />
                    </div>
                    <button onClick={() => setShowForm(v => !v)} style={s.minimizeBtn}>
                      {showForm ? '▲ Fechar' : '+ Novo'}
                    </button>
                  </div>

                  {showForm && (
                    <div style={s.formCard}>
                      <div style={s.formTitle}>Novo Horário — {fmtDateBr(data)}</div>

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
                              onChange={e => setForm(f => ({ ...f, vagas: Number(e.target.value) }))} />
                          </FieldGroup>
                        )}
                      </div>

                      <FieldGroup label="Periodicidade">
                        <select style={s.select} value={form.periodicity} onChange={e => setForm(f => ({ ...f, periodicity: e.target.value }))}>
                          {PERIODICITY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </FieldGroup>

                      <FieldGroup label="Observação">
                        <textarea style={s.textarea} rows={3} placeholder="Informações para o aluno (opcional)…"
                          value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
                      </FieldGroup>

                      <button style={{ ...s.publishBtn, opacity: loading ? 0.6 : 1 }} onClick={saveSlot} disabled={loading}>
                        {loading ? 'Salvando…' : '💾 Salvar Horário'}
                      </button>
                    </div>
                  )}

                  {loading && !showForm && <p style={s.loadingTxt}>Carregando…</p>}

                  {!loading && slotsToShow.length === 0 && (
                    <div style={s.emptyFeed}>
                      <span style={{ fontSize: 36 }}>📭</span>
                      <p style={s.emptyText}>Nenhum horário para {fmtDateBr(data)}.</p>
                      <p style={s.emptyHint}>Clique em "+ Novo" para adicionar.</p>
                    </div>
                  )}

                  {slotsToShow.map(sl => (
                    <SlotCard key={sl.id} slot={sl} isAdmin={true} onDelete={() => deleteSlot(sl.id)} />
                  ))}
                </section>
              )}

              {tab === 'confirmacoes' && (
                <section style={s.section}>
                  <div style={s.sectionHead}>
                    <span style={s.sectionIcon}>✅</span>
                    <div>
                      <h2 style={s.sectionTitle}>Confirmações Pendentes</h2>
                      <p style={s.sectionSub}>{pendingCount} inscrição{pendingCount !== 1 ? 'ões' : ''} aguardando</p>
                    </div>
                  </div>

                  {pendingCount === 0 && (
                    <div style={s.emptyFeed}>
                      <span style={{ fontSize: 36 }}>🎉</span>
                      <p style={s.emptyText}>Nenhuma inscrição pendente.</p>
                    </div>
                  )}

                  {confirmacoes.map(i => (
                    <div key={i.id} style={{ ...sc.card, boxShadow: 'inset 5px 0 0 0 #ffa726' }}>
                      <div style={sc.content}>
                        <div style={sc.header}>
                          <span style={sc.nome}>{i.nome_aluno}</span>
                          <span style={sc.tempo}>{i.email_aluno}</span>
                        </div>
                        <div style={sc.infoLine}>
                          📅 {i.data ? fmtDateBr(i.data) : '—'} &nbsp;·&nbsp;
                          🕐 {fmt(i.hora_inicio ?? '')} – {fmt(i.hora_fim ?? '')} &nbsp;·&nbsp;
                          {TIPO_LABEL[i.tipo ?? ''] ?? i.tipo}
                        </div>
                        <div style={sc.btnRow}>
                          <button style={sc.confirmBtn} onClick={() => confirmar(i.id, true)}>✓ Confirmar</button>
                          <button style={sc.rejectBtn}  onClick={() => confirmar(i.id, false)}>✕ Rejeitar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          {/* ── ALUNO ─────────────────────────────────────────────── */}
          {!isAdmin && adminEmail && (
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionIcon}>📅</span>
                <div style={{ flex: 1 }}>
                  <h2 style={s.sectionTitle}>Horários Disponíveis</h2>
                  <DateNav data={data} setData={setData} />
                </div>
              </div>

              {loading && <p style={s.loadingTxt}>Carregando…</p>}

              {!loading && slotsToShow.length === 0 && (
                <div style={s.emptyFeed}>
                  <span style={{ fontSize: 36 }}>📭</span>
                  <p style={s.emptyText}>Nenhum horário em {fmtDateBr(data)}.</p>
                  <p style={s.emptyHint}>Tente outro dia.</p>
                </div>
              )}

              {slotsToShow.map(sl => {
                const minha = myInscricoes[sl.id];
                return (
                  <SlotCard key={sl.id} slot={sl} isAdmin={false}
                    minhaInscricao={minha}
                    onInscrever={() => inscrever(sl.id)}
                    onCancelar={() => minha && cancelarInscricao(minha.id)}
                  />
                );
              })}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── SlotCard ────────────────────────────────────────────────────────────────
function SlotCard({ slot: sl, isAdmin, onDelete, minhaInscricao, onInscrever, onCancelar }: {
  slot: Slot;
  isAdmin: boolean;
  onDelete?: () => void;
  minhaInscricao?: Inscricao;
  onInscrever?: () => void;
  onCancelar?: () => void;
}) {
  const cor       = TIPO_COLOR[sl.tipo] ?? '#4fc3f7';
  const vagas_livres = sl.vagas - sl.vagas_ocupadas;
  const inscAtivas   = sl.inscricoes?.filter(i => i.status !== 'cancelada') ?? [];

  return (
    <div style={{ ...sc.card, boxShadow: `inset 5px 0 0 0 ${cor}` }}>
      <div style={sc.content}>
        <div style={sc.header}>
          <span style={{ ...sc.badge, color: cor, borderColor: `${cor}60`, background: `${cor}1a` }}>
            {TIPO_LABEL[sl.tipo] ?? sl.tipo}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sl.tipo !== 'bloqueado' && (
              <span style={sc.vagas}>{sl.vagas_ocupadas}/{sl.vagas} vagas</span>
            )}
            {isAdmin && onDelete && (
              <button style={sc.delBtn} onClick={onDelete}>✕</button>
            )}
          </div>
        </div>

        <div style={sc.infoList}>
          <InfoItem icon="🕐" text={`${fmt(sl.hora_inicio)} – ${fmt(sl.hora_fim)}`} />
          {sl.periodicity !== 'unico' && (
            <InfoItem icon="🔁" text={['semana','mes','3meses','sempre'].includes(sl.periodicity) ? { semana: 'Toda semana', mes: 'Todo mês', '3meses': 'A cada 3 meses', sempre: 'Recorrente' }[sl.periodicity] ?? sl.periodicity : sl.periodicity} />
          )}
          {sl.observacao && <InfoItem icon="📝" text={sl.observacao} />}
        </div>

        {/* Lista de inscritos (admin) */}
        {isAdmin && inscAtivas.length > 0 && (
          <div style={sc.inscList}>
            {inscAtivas.map(i => (
              <div key={i.id} style={sc.inscRow}>
                <span style={sc.inscNome}>{i.nome_aluno}</span>
                <span style={{
                  ...sc.inscStatus,
                  color: i.status === 'confirmada' ? '#81c784' : i.status === 'cancelada' ? '#e57373' : '#ffa726',
                }}>
                  {i.status === 'confirmada' ? '✓ Confirmado' : i.status === 'cancelada' ? 'Cancelado' : '⏳ Pendente'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Botão do aluno */}
        {!isAdmin && sl.tipo !== 'bloqueado' && (
          minhaInscricao ? (
            <div style={sc.statusRow}>
              <span style={{
                ...sc.statusPill,
                background: minhaInscricao.status === 'confirmada' ? 'rgba(129,199,132,0.15)' : 'rgba(255,167,38,0.15)',
                color:      minhaInscricao.status === 'confirmada' ? '#81c784' : '#ffa726',
                border:     `1px solid ${minhaInscricao.status === 'confirmada' ? '#81c784' : '#ffa726'}`,
              }}>
                {minhaInscricao.status === 'confirmada' ? '✓ Confirmado' : '⏳ Aguardando confirmação'}
              </span>
              <button style={sc.cancelSmall} onClick={onCancelar}>Cancelar</button>
            </div>
          ) : (
            <button style={{ ...sc.reservarBtn, opacity: vagas_livres <= 0 ? 0.4 : 1 }}
              disabled={vagas_livres <= 0} onClick={onInscrever}>
              {vagas_livres <= 0 ? 'Sem vagas' : 'Reservar esta aula'}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase' as const }}>{label}</span>
      {children}
    </div>
  );
}

function InfoItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{text}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:        { position: 'fixed', inset: 0, background: '#0d0d1a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header:      { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', gap: 12, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', flexShrink: 0, zIndex: 10 },
  backBtn:     { background: 'none', border: '1px solid rgba(255,255,255,0.22)', color: '#cce0ff', padding: '8px 14px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 600, flexShrink: 0 },
  headerCenter:{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.2 },
  profBtn:     { background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.3)', color: '#4fc3f7', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  toast:       { position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' },
  scrollBody:  { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] },
  inner:       { display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 16px 48px', maxWidth: 540, margin: '0 auto', boxSizing: 'border-box', width: '100%' },
  section:     { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHead: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  sectionIcon: { fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 },
  sectionTitle:{ fontSize: 20, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: -0.3 },
  sectionSub:  { margin: '3px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  tabRow:      { display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, gap: 4 },
  tabBtn:      { flex: 1, padding: '11px 8px', borderRadius: 11, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive:   { background: 'rgba(79,195,247,0.15)', color: '#4fc3f7' },
  tabBadge:    { background: '#ff4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 800, padding: '1px 7px' },
  minimizeBtn: { flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: 'rgba(79,195,247,0.12)', border: '1px solid rgba(79,195,247,0.3)', color: '#4fc3f7', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' },
  formCard:    { display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 22, padding: '20px 16px 24px' },
  formTitle:   { fontSize: 13, fontWeight: 700, color: '#4fc3f7', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  formRow:     { display: 'flex', gap: 10 },
  select:      { width: '100%', padding: '13px 14px', borderRadius: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  input:       { width: '100%', padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  textarea:    { width: '100%', padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  publishBtn:  { padding: '15px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #006064, #0097a7)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,151,167,0.35)', letterSpacing: 0.2 },
  loadingTxt:  { color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '20px 0', fontSize: 14 },
  emptyFeed:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px', textAlign: 'center' },
  emptyText:   { margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 600 },
  emptyHint:   { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.3)' },
};

const sc: Record<string, React.CSSProperties> = {
  card:       { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18 },
  content:    { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  badge:      { fontSize: 13, fontWeight: 800, padding: '5px 14px', borderRadius: 20, border: '1px solid', letterSpacing: 0.3 },
  vagas:      { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  delBtn:     { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer', padding: '0 4px' },
  infoList:   { display: 'flex', flexDirection: 'column', gap: 7 },
  inscList:   { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 },
  inscRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px' },
  inscNome:   { fontSize: 13, fontWeight: 600, color: '#fff' },
  inscStatus: { fontSize: 11, fontWeight: 700 },
  nome:       { fontSize: 15, fontWeight: 800, color: '#fff' },
  tempo:      { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  infoLine:   { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 },
  btnRow:     { display: 'flex', gap: 10 },
  confirmBtn: { flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  rejectBtn:  { flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid rgba(239,83,80,0.5)', background: 'rgba(239,83,80,0.1)', color: '#ef5350', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  statusRow:  { display: 'flex', alignItems: 'center', gap: 10 },
  statusPill: { flex: 1, textAlign: 'center', padding: '8px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  cancelSmall:{ background: 'none', border: '1px solid rgba(239,83,80,0.4)', color: '#ef5350', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' },
  reservarBtn:{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #006064, #0097a7)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 14px rgba(0,151,167,0.35)' },
};

const dn: Record<string, React.CSSProperties> = {
  wrap:  { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 },
  arrow: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#4fc3f7', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { background: 'rgba(79,195,247,0.08)', border: '1px solid rgba(79,195,247,0.25)', color: '#4fc3f7', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};

const pm: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,26,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet:      { background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '24px 24px 32px', maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' },
  backBtn:    { alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#cce0ff', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  title:      { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' },
  sub:        { margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 },
  input:      { width: '100%', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 16, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  confirmBtn: { width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, #006064, #0097a7)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' },
};
