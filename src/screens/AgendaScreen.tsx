// =============================================================================
// AGENDA SCREEN
// Admin: cria/cancela slots, marca como ocupado
// User/Aluno: vê horários disponíveis e contata via WhatsApp
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';

interface Props {
  onBack:       () => void;
  emailUsuario: string;
  role:         'user' | 'aluno' | 'admin';
  username:     string;
}

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

interface AdminInfo {
  email:    string;
  telefone: string | null;
}

const TIPOS     = [{ value: 'individual', label: 'Individual' }, { value: 'coletiva', label: 'Coletiva' }, { value: 'bloqueado', label: 'Bloqueado' }];
const HORAS     = Array.from({ length: 28 }, (_, i) => { const h = Math.floor(i / 2) + 6; const m = i % 2 === 0 ? '00' : '30'; return `${h.toString().padStart(2, '0')}:${m}`; });
const TIPO_COLOR: Record<string, string> = { individual: '#4fc3f7', coletiva: '#81c784', bloqueado: '#757575' };
const TIPO_LABEL: Record<string, string> = { individual: 'Individual', coletiva: 'Coletiva', bloqueado: 'Bloqueado' };
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayStr() { return new Date().toISOString().split('T')[0]; }
function addDays(s: string, n: number) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }
function fmt(t: string) { return t?.slice(0, 5) ?? ''; }
function fmtDateBr(s: string) {
  const dateOnly = s.slice(0, 10);
  const dt = new Date(dateOnly + 'T12:00:00');
  const [, m, d] = dateOnly.split('-');
  return `${DIAS[dt.getDay()]}, ${d}/${m}`;
}

function buildWhatsAppUrl(telefone: string, slot: Slot): string {
  const numero = `55${telefone.replace(/\D/g, '')}`;
  const msg = encodeURIComponent(
    `Olá, gostaria de reservar uma aula ${TIPO_LABEL[slot.tipo] ?? slot.tipo} no dia ${fmtDateBr(slot.data)} no horário ${fmt(slot.hora_inicio)} às ${fmt(slot.hora_fim)}.`
  );
  return `https://wa.me/${numero}?text=${msg}`;
}

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

export default function AgendaScreen({ onBack, emailUsuario, role, username }: Props) {
  const isAdmin = role === 'admin';

  const [data, setData]         = useState(todayStr());
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [slots, setSlots]       = useState<Slot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, observacao: '' });

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  // Busca info do admin automaticamente
  useEffect(() => {
    fetch(`${API}/agenda/admin-info`)
      .then(r => r.json())
      .then(setAdminInfo)
      .catch(() => {});
  }, []);

  const loadSlots = useCallback(async () => {
    if (!adminInfo?.email) return;
    setLoading(true);
    try {
      const rota = isAdmin ? 'slots/admin' : 'slots';
      const r = await fetch(`${API}/agenda/${rota}?admin_email=${encodeURIComponent(adminInfo.email)}&data=${data}`);
      setSlots(await r.json());
    } catch { flash('err', 'Erro ao carregar horários.'); }
    setLoading(false);
  }, [adminInfo, data, isAdmin]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const saveSlot = async () => {
    if (!adminInfo?.email) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/agenda/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_email: adminInfo.email, data, ...form }),
      });
      if (!r.ok) { const e = await r.json(); flash('err', e.error ?? 'Erro.'); return; }
      flash('ok', 'Horário criado!');
      setShowForm(false);
      setForm({ hora_inicio: '07:00', hora_fim: '08:00', tipo: 'individual', vagas: 1, observacao: '' });
      loadSlots();
    } catch { flash('err', 'Erro ao salvar.'); }
    setLoading(false);
  };

  const deleteSlot = async (id: number) => {
    if (!confirm('Cancelar este horário?')) return;
    await fetch(`${API}/agenda/slots/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo?.email }),
    });
    flash('ok', 'Horário cancelado.');
    loadSlots();
  };

  const toggleOcupado = async (slot: Slot) => {
    const ocupado = slot.status !== 'ocupado';
    await fetch(`${API}/agenda/slots/${slot.id}/ocupado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: adminInfo?.email, ocupado }),
    });
    flash('ok', ocupado ? 'Marcado como ocupado.' : 'Marcado como disponível.');
    loadSlots();
  };

  return (
    <div style={s.page}>

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <div style={s.headerCenter}>
          <span style={s.headerTitle}>Agenda</span>
          {adminInfo && <span style={s.profTag}>👨‍🏫 Prof. Carlão</span>}
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

          <section style={s.section}>
            <div style={s.sectionHead}>
              <span style={s.sectionIcon}>📅</span>
              <div style={{ flex: 1 }}>
                <h2 style={s.sectionTitle}>{isAdmin ? 'Meus Horários' : 'Horários Disponíveis'}</h2>
                <DateNav data={data} setData={setData} />
              </div>
              {isAdmin && (
                <button onClick={() => setShowForm(v => !v)} style={s.minimizeBtn}>
                  {showForm ? '▲ Fechar' : '+ Novo'}
                </button>
              )}
            </div>

            {/* Formulário admin */}
            {isAdmin && showForm && (
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

                <FieldGroup label="Observação">
                  <textarea style={s.textarea} rows={2} placeholder="Informações para o aluno (opcional)…"
                    value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
                </FieldGroup>

                <button style={{ ...s.publishBtn, opacity: loading ? 0.6 : 1 }} onClick={saveSlot} disabled={loading}>
                  {loading ? 'Salvando…' : '💾 Salvar Horário'}
                </button>
              </div>
            )}

            {loading && <p style={s.loadingTxt}>Carregando…</p>}

            {!loading && slots.length === 0 && (
              <div style={s.emptyFeed}>
                <span style={{ fontSize: 36 }}>📭</span>
                <p style={s.emptyText}>Nenhum horário em {fmtDateBr(data)}.</p>
                <p style={s.emptyHint}>{isAdmin ? 'Clique em "+ Novo" para adicionar.' : 'Tente outro dia.'}</p>
              </div>
            )}

            {slots.map(sl => (
              <SlotCard
                key={sl.id}
                slot={sl}
                isAdmin={isAdmin}
                adminTelefone={adminInfo?.telefone ?? null}
                onDelete={() => deleteSlot(sl.id)}
                onToggleOcupado={() => toggleOcupado(sl)}
              />
            ))}
          </section>

        </div>
      </div>
    </div>
  );
}

function SlotCard({ slot: sl, isAdmin, adminTelefone, onDelete, onToggleOcupado }: {
  slot: Slot;
  isAdmin: boolean;
  adminTelefone: string | null;
  onDelete: () => void;
  onToggleOcupado: () => void;
}) {
  const cor        = TIPO_COLOR[sl.tipo] ?? '#4fc3f7';
  const isOcupado  = sl.status === 'ocupado';
  const isBloqueado = sl.tipo === 'bloqueado';

  return (
    <div style={{ ...sc.card, boxShadow: `inset 5px 0 0 0 ${isOcupado ? '#757575' : cor}`, opacity: isOcupado && !isAdmin ? 0.5 : 1 }}>
      <div style={sc.content}>
        <div style={sc.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...sc.badge, color: isOcupado ? '#9e9e9e' : cor, borderColor: `${isOcupado ? '#9e9e9e' : cor}60`, background: `${isOcupado ? '#9e9e9e' : cor}1a` }}>
              {TIPO_LABEL[sl.tipo] ?? sl.tipo}
            </span>
            {isOcupado && <span style={sc.ocupadoBadge}>Ocupado</span>}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              {!isBloqueado && (
                <button
                  style={{ ...sc.ocupadoBtn, background: isOcupado ? 'rgba(129,199,132,0.15)' : 'rgba(255,167,38,0.15)', color: isOcupado ? '#81c784' : '#ffa726', border: `1px solid ${isOcupado ? '#81c784' : '#ffa726'}` }}
                  onClick={onToggleOcupado}
                >
                  {isOcupado ? '✓ Liberar' : '⊘ Ocupar'}
                </button>
              )}
              <button style={sc.delBtn} onClick={onDelete}>✕</button>
            </div>
          )}
        </div>

        <div style={sc.infoList}>
          <InfoItem icon="🕐" text={`${fmt(sl.hora_inicio)} – ${fmt(sl.hora_fim)}`} />
          {sl.observacao && <InfoItem icon="📝" text={sl.observacao} />}
        </div>

        {/* Botão WhatsApp para user/aluno */}
        {!isAdmin && !isBloqueado && !isOcupado && adminTelefone && (
          <a href={buildWhatsAppUrl(adminTelefone, sl)} target="_blank" rel="noopener noreferrer" style={sc.waBtn}>
            <WaIcon /> Reservar via WhatsApp
          </a>
        )}

        {!isAdmin && isOcupado && (
          <div style={sc.ocupadoInfo}>Este horário já está ocupado</div>
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

function WaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:         { position: 'fixed', inset: 0, background: '#0d0d1a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header:       { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', gap: 12, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', flexShrink: 0, zIndex: 10 },
  backBtn:      { background: 'none', border: '1px solid rgba(255,255,255,0.22)', color: '#cce0ff', padding: '8px 14px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 600, flexShrink: 0 },
  headerCenter: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  headerTitle:  { fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.2 },
  profTag:      { fontSize: 11, color: '#4fc3f7', fontWeight: 600 },
  toast:        { position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' },
  scrollBody:   { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] },
  inner:        { display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 16px 48px', maxWidth: 540, margin: '0 auto', boxSizing: 'border-box', width: '100%' },
  section:      { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHead:  { display: 'flex', alignItems: 'flex-start', gap: 12 },
  sectionIcon:  { fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: -0.3 },
  minimizeBtn:  { flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: 'rgba(79,195,247,0.12)', border: '1px solid rgba(79,195,247,0.3)', color: '#4fc3f7', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' },
  formCard:     { display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 22, padding: '20px 16px 24px' },
  formTitle:    { fontSize: 13, fontWeight: 700, color: '#4fc3f7', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  formRow:      { display: 'flex', gap: 10 },
  select:       { width: '100%', padding: '13px 14px', borderRadius: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  input:        { width: '100%', padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  textarea:     { width: '100%', padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' as const, fontFamily: 'inherit', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  publishBtn:   { padding: '15px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #006064, #0097a7)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,151,167,0.35)', letterSpacing: 0.2 },
  loadingTxt:   { color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '20px 0', fontSize: 14 },
  emptyFeed:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px', textAlign: 'center' },
  emptyText:    { margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 600 },
  emptyHint:    { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.3)' },
};

const sc: Record<string, React.CSSProperties> = {
  card:        { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18 },
  content:     { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  badge:       { fontSize: 13, fontWeight: 800, padding: '5px 14px', borderRadius: 20, border: '1px solid', letterSpacing: 0.3 },
  ocupadoBadge:{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(117,117,117,0.2)', border: '1px solid rgba(117,117,117,0.4)', color: '#9e9e9e' },
  ocupadoBtn:  { padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  delBtn:      { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer', padding: '0 4px' },
  infoList:    { display: 'flex', flexDirection: 'column', gap: 7 },
  waBtn:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 12px', borderRadius: 13, background: 'linear-gradient(135deg, #1b5e20, #388e3c)', color: '#fff', fontSize: 14, fontWeight: 800, textDecoration: 'none', boxShadow: '0 3px 14px rgba(56,142,60,0.35)' },
  ocupadoInfo: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600, padding: '6px 0' },
};

const dn: Record<string, React.CSSProperties> = {
  wrap:  { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 },
  arrow: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#4fc3f7', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { background: 'rgba(79,195,247,0.08)', border: '1px solid rgba(79,195,247,0.25)', color: '#4fc3f7', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};
