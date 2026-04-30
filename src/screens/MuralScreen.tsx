// =============================================================================
// MuralScreen — Mural de Treinos
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { getJogos, postJogo, deleteJogo, type JogoRecord } from '@services/apiService';

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
  dataFim?:         string;
  horarioInicio:    string;
  horarioFim:       string;
  local:            string;
  whatsapp:         string;
  publicadoEm:      number;
  emailPublicador?: string;
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

const CLASSES     = ['Iniciante', 'Classe 5', 'Classe 4', 'Classe 3', 'Classe 2', 'Classe 1'];
const LOCAIS      = ['Arena Bar (Prof. Carlos)', 'Automóvel Clube (ACTO)', 'Quadra Pública', 'Condomínio', 'Outro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES       = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const LS_CIDADE           = 'muralCidade';
const LS_PENALIDADES      = 'muralPenalidades';
const LS_FUROS_REPORTADOS = 'muralFurosReportados';

function getPenalidade(email: string): PenalidadeRecord {
  try { const data = JSON.parse(localStorage.getItem(LS_PENALIDADES) || '{}'); return data[email] ?? { furos: 0, banidoAte: null }; }
  catch { return { furos: 0, banidoAte: null }; }
}
function salvarPenalidade(email: string, p: PenalidadeRecord): void {
  try { const data = JSON.parse(localStorage.getItem(LS_PENALIDADES) || '{}'); data[email] = p; localStorage.setItem(LS_PENALIDADES, JSON.stringify(data)); }
  catch { /* ignore */ }
}
function addFuro(email: string): void {
  const p = getPenalidade(email); p.furos++;
  const MES = 30 * 24 * 60 * 60 * 1000;
  if (p.furos >= 7) p.banidoAte = -1;
  else if (p.furos >= 4) p.banidoAte = Date.now() + 2 * MES;
  else if (p.furos >= 3) p.banidoAte = Date.now() + MES;
  else p.banidoAte = null;
  salvarPenalidade(email, p);
}
function getBanStatus(email: string): { banido: boolean; mensagem: string; permanente: boolean } {
  const p = getPenalidade(email);
  if (!p.banidoAte) return { banido: false, mensagem: '', permanente: false };
  if (p.banidoAte === -1) return { banido: true, permanente: true, mensagem: 'Acesso permanentemente suspenso por reincidência de furos.' };
  if (Date.now() < p.banidoAte) { const dias = Math.ceil((p.banidoAte - Date.now()) / (1000 * 60 * 60 * 24)); return { banido: true, permanente: false, mensagem: `Publicação suspensa por ${dias} dia(s) — furos repetidos.` }; }
  return { banido: false, mensagem: '', permanente: false };
}
function getFurosReportados(): Record<string, number> { try { return JSON.parse(localStorage.getItem(LS_FUROS_REPORTADOS) || '{}'); } catch { return {}; } }
function reportarFuro(whatsapp: string, emailAlvo?: string): void {
  try { const data = getFurosReportados(); data[whatsapp] = (data[whatsapp] || 0) + 1; localStorage.setItem(LS_FUROS_REPORTADOS, JSON.stringify(data)); if (emailAlvo) addFuro(emailAlvo); }
  catch { /* ignore */ }
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
function fmtDataRange(jogo: Jogo): string {
  if (!jogo.dataFim || jogo.dataFim === jogo.dataInicio) return fmtData(jogo.dataInicio);
  return `${fmtData(jogo.dataInicio)} – ${fmtData(jogo.dataFim)}`;
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
function jogoIsOnDate(jogo: Jogo, dateStr: string): boolean { return dateStr >= jogo.dataInicio && dateStr <= (jogo.dataFim || jogo.dataInicio); }
function classeColor(classe: string): string {
  const map: Record<string, string> = { 'Iniciante': '#4fc3f7', 'Classe 5': '#81c784', 'Classe 4': '#aef359', 'Classe 3': '#ffb74d', 'Classe 2': '#ff8a65', 'Classe 1': '#ef5350' };
  return map[classe] ?? '#fff';
}
function buildWhatsAppUrl(jogo: Jogo): string {
  const numero = `55${jogo.whatsapp.replace(/\D/g, '')}`;
  const dataStr = !jogo.dataFim || jogo.dataFim === jogo.dataInicio ? fmtData(jogo.dataInicio) : `${fmtData(jogo.dataInicio)} a ${fmtData(jogo.dataFim)}`;
  const msg = encodeURIComponent(`Olá! Vi sua publicação no Mural de Treinos do Prof. Carlão. Quero jogar uma partida com você! Sou ${jogo.classe} e tenho disponibilidade de estar no ${jogo.local} (${jogo.cidade}), ${dataStr} entre ${jogo.horarioInicio.replace(':', 'h')} às ${jogo.horarioFim.replace(':', 'h')}. Bora?`);
  return `https://wa.me/${numero}?text=${msg}`;
}
function buildGCalUrl(jogo: Jogo): string {
  const dtStart = jogo.dataInicio.replace(/-/g, '') + 'T' + jogo.horarioInicio.replace(':', '') + '00';
  const dtEnd   = jogo.dataInicio.replace(/-/g, '') + 'T' + jogo.horarioFim.replace(':', '') + '00';
  const title   = encodeURIComponent(`Treino de Tênis — ${jogo.classe} @ ${jogo.local}`);
  const details = encodeURIComponent(`Treino combinado pelo Mural de Treinos (Tenis Coach Com Carlos).\nClasse: ${jogo.classe}\nLocal: ${jogo.local}, ${jogo.cidade}\nWhatsApp do parceiro: +55${jogo.whatsapp}`);
  const location = encodeURIComponent(`${jogo.local}, ${jogo.cidade}, MG`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
}
async function detectarCidade(): Promise<string> {
  if (!navigator.geolocation) throw new Error('Geolocalização não suportada.');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=pt-BR`, { headers: { 'User-Agent': 'TenisCoachComCarlos/1.0' } });
        const json = await res.json();
        const city = json.address?.city || json.address?.town || json.address?.village || '';
        if (city) resolve(city); else reject(new Error('Cidade não identificada.'));
      } catch { reject(new Error('Falha ao consultar localização.')); }
    }, () => reject(new Error('Permissão de localização negada.')), { timeout: 10000, maximumAge: 300_000 });
  });
}

function CityPickerModal({ onConfirm, onBack }: { onConfirm: (c: string) => void; onBack: () => void }) {
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const [erro, setErro] = useState('');
  const handleDetectar = async () => { setErro(''); setLoading(true); try { setInput(await detectarCidade()); } catch (e: unknown) { setErro(e instanceof Error ? e.message : 'Erro.'); } finally { setLoading(false); } };
  const handleConfirmar = () => { const c = input.trim(); if (!c) { setErro('Digite o nome da sua cidade.'); return; } onConfirm(c); };
  return (
    <div style={cm.overlay}>
      <div style={cm.sheet}>
        <button onClick={onBack} style={cm.backBtn}>← Voltar</button>
        <div style={cm.icon}>📍</div>
        <h2 style={cm.title}>Qual é a sua cidade?</h2>
        <p style={cm.sub}>O mural mostra apenas publicações da sua cidade.</p>
        <button onClick={handleDetectar} disabled={loading} style={{ ...cm.detectBtn, opacity: loading ? 0.6 : 1 }}>{loading ? '🔍 Detectando...' : '📡 Detectar minha localização'}</button>
        <p style={cm.ouLabel}>— ou digite manualmente —</p>
        <input style={cm.input} placeholder="Ex: Teófilo Otoni" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConfirmar()} autoFocus />
        {erro && <p style={cm.erro}>{erro}</p>}
        <button onClick={handleConfirmar} style={cm.confirmBtn} disabled={!input.trim()}>Acessar o Mural →</button>
      </div>
    </div>
  );
}

function BanBanner({ status }: { status: { mensagem: string; permanente: boolean } }) {
  return (
    <div style={bb.banner}>
      <span style={{ fontSize: 28 }}>{status.permanente ? '🚫' : '⏳'}</span>
      <div>
        <p style={bb.title}>{status.permanente ? 'Acesso suspenso permanentemente' : 'Publicação temporariamente suspensa'}</p>
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
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Seus furos: <strong style={{ color: furos >= 3 ? '#ff6b6b' : '#aef359' }}>{furos}</strong> {aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div style={rg.body}>
          <p style={rg.intro}>O Mural funciona pela confiança mútua. Cancele com antecedência se não puder treinar.</p>
          <div style={rg.rules}>
            {[{n:3,c:'suspensão de 1 mês',cor:'#ffb74d'},{n:4,c:'suspensão de 2 meses',cor:'#ff8a65'},{n:7,c:'banimento permanente',cor:'#ef5350'}].map(r => (
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

export default function MuralScreen({ onBack, emailUsuario, userId, username, telefone, localidade }: Props) {
  const [jogos, setJogos]               = useState<Jogo[]>([]);
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
  const [furosMap, setFurosMap]           = useState<Record<string, number>>(getFurosReportados);
  const [calAberto, setCalAberto]         = useState(false);
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [formAberto, setFormAberto]       = useState(true);
  const [classe, setClasse]               = useState('Iniciante');
  const [janelaData, setJanelaData]       = useState(false);
  const [dataInicio, setDataInicio]       = useState('');
  const [dataFim, setDataFim]             = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim]       = useState('');
  const [local, setLocal]                 = useState(LOCAIS[0]);
  const [localOutro, setLocalOutro]       = useState('');

  const [whatsapp, setWhatsapp] = useState(() => {
    if (!telefone) return '';
    const d = telefone.replace(/\D/g, '').slice(0, 11);
    if (d.length > 7) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return d;
  });

  const [erro, setErro]     = useState('');
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

  useEffect(() => { loadJogos(); }, [loadJogos]);

  const handleConfirmCity = useCallback((c: string) => {
    localStorage.setItem(LS_CIDADE, c); setCidade(c); setShowCity(false);
  }, []);

  const handlePublicar = async () => {
    setErro('');
    if (!dataInicio) { setErro('Escolha a data de início.'); return; }
    if (janelaData && !dataFim) { setErro('Escolha a data final.'); return; }
    if (janelaData && dataFim < dataInicio) { setErro('Data final deve ser após a inicial.'); return; }
    if (!horarioInicio) { setErro('Informe o horário de início.'); return; }
    if (!horarioFim)    { setErro('Informe o horário final.'); return; }
    if (horarioFim <= horarioInicio) { setErro('Horário final deve ser após o inicial.'); return; }
    if (local === 'Outro' && !localOutro.trim()) { setErro('Descreva o local.'); return; }
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) { setErro('WhatsApp inválido.'); return; }

    const novo: JogoRecord = {
      id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cidade, classe, dataInicio,
      dataFim: janelaData ? dataFim : null,
      horarioInicio, horarioFim,
      local: local === 'Outro' ? localOutro.trim() : local,
      whatsapp: digits, publicadoEm: Date.now(), emailPublicador: emailUsuario,
    };
    try {
      const salvo = await postJogo(novo);
      setJogos(prev => [salvo as Jogo, ...prev]);
      setSucesso(true);
      setDataInicio(''); setDataFim(''); setHorarioInicio(''); setHorarioFim(''); setLocalOutro('');
      setTimeout(() => setSucesso(false), 3000);
    } catch { setErro('Erro ao publicar. Tente novamente.'); }
  };

  const handleReportarFuro = useCallback((jogo: Jogo) => {
    if (!window.confirm(`Confirmar furo de ${jogo.whatsapp}?`)) return;
    reportarFuro(jogo.whatsapp, jogo.emailPublicador);
    setFurosMap(getFurosReportados());
  }, []);

  const handleInteressado = useCallback(async (jogoId: string) => {
    try {
      await fetch(`${API_BASE}/jogos/${jogoId}/interessado`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_usuario: emailUsuario, nome_usuario: username }),
      });
      setJogos(prev => prev.map(j => j.id === jogoId ? { ...j, interessados: (j.interessados ?? 0) + 1 } : j));
    } catch { /* silent */ }
  }, [emailUsuario, username]);

  const handleConfirmarSala = useCallback(async (jogoId: string, confirmado_com: string) => {
    await fetch(`${API_BASE}/jogos/${jogoId}/confirmar`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_publicador: emailUsuario, confirmado_com }),
    });
    setJogos(prev => prev.map(j => j.id === jogoId ? { ...j, status: 'confirmada', confirmado_com } : j));
  }, [emailUsuario]);

  const jogosAtivos   = jogos.filter(j => j.status !== 'encerrada' && !isExpired(j)).filter(j => !cidade || j.cidade.toLowerCase() === cidade.toLowerCase());
  const jogosExibidos = selectedDate ? jogosAtivos.filter(j => jogoIsOnDate(j, selectedDate)) : jogosAtivos;

  return (
    <div style={s.page}>
      {showCityPicker && <CityPickerModal onConfirm={handleConfirmCity} onBack={onBack} />}

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <div style={s.headerCenter}>
          <span style={s.headerTitle}>Mural de Treinos</span>
          {cidade && <button onClick={() => setShowCity(true)} style={s.cidadeBtn}>📍 {cidade}</button>}
        </div>
        <span style={s.headerSpacer} />
      </div>

      <div style={s.scrollBody}>
        <div style={s.inner}>
          <RegrasMural furos={penalidade.furos} />

          <section style={s.section}>
            <div style={s.sectionHead}>
              <span style={s.sectionIcon}>📢</span>
              <div style={{ flex: 1 }}>
                <h2 style={s.sectionTitle}>Publicar Disponibilidade</h2>
                <p style={s.sectionSub}>Encontre um parceiro em {cidade || 'sua cidade'}</p>
              </div>
              {!banStatus.banido && (
                <button onClick={() => setFormAberto(v => !v)} style={s.minimizeBtn}>{formAberto ? '▲ Minimizar' : '▼ Abrir'}</button>
              )}
            </div>

            {banStatus.banido ? <BanBanner status={banStatus} /> : formAberto && (
              <div style={s.formCard}>
                <FieldGroup label="Sua Classe">
                  <select value={classe} onChange={e => setClasse(e.target.value)} style={s.select}>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FieldGroup>
                <FieldGroup label="Disponibilidade de dias">
                  <div style={s.modeToggle}>
                    <button style={{ ...s.modeBtn, ...(janelaData ? {} : s.modeBtnActive) }} onClick={() => setJanelaData(false)}>Dia único</button>
                    <button style={{ ...s.modeBtn, ...(janelaData ? s.modeBtnActive : {}) }} onClick={() => setJanelaData(true)}>Janela de dias</button>
                  </div>
                </FieldGroup>
                <div style={s.row}>
                  <div style={s.col}>
                    <span style={s.subLabel}>{janelaData ? 'De' : 'Data'}</span>
                    <input type="date" value={dataInicio} min={hoje} onChange={e => setDataInicio(e.target.value)} style={s.input} />
                  </div>
                  {janelaData && (
                    <div style={s.col}>
                      <span style={s.subLabel}>Até</span>
                      <input type="date" value={dataFim} min={dataInicio || hoje} onChange={e => setDataFim(e.target.value)} style={s.input} />
                    </div>
                  )}
                </div>
                <FieldGroup label="Janela de horários">
                  <div style={s.timeStack}>
                    <div style={s.timeRow}><span style={s.timeLabel}>Das</span><input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} style={s.timeInput} /></div>
                    <div style={s.timeRow}><span style={s.timeLabel}>Às</span><input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} style={s.timeInput} /></div>
                  </div>
                </FieldGroup>
                <FieldGroup label="Local">
                  <select value={local} onChange={e => { setLocal(e.target.value); setLocalOutro(''); }} style={s.select}>
                    {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {local === 'Outro' && (
                    <input style={{ ...s.input, marginTop: 8 }} placeholder="Descreva o local..." type="text" value={localOutro} onChange={e => setLocalOutro(e.target.value)} autoCapitalize="words" />
                  )}
                </FieldGroup>
                <FieldGroup label="Seu WhatsApp">
                  <input type="tel" inputMode="numeric" placeholder="(33) 99999-0000" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} style={s.input} />
                </FieldGroup>
                {erro    && <p style={s.erro}>{erro}</p>}
                {sucesso && <p style={s.ok}>✅ Publicado! Aguardando parceiro…</p>}
                <button onClick={handlePublicar} style={s.publishBtn}>📢 Publicar Disponibilidade</button>
              </div>
            )}
          </section>

          <section style={s.section}>
            <div style={s.sectionHead}>
              <span style={s.sectionIcon}>🎾</span>
              <div style={{ flex: 1 }}>
                <h2 style={s.sectionTitle}>Parceiros Disponíveis</h2>
                <p style={s.sectionSub}>{jogosExibidos.length} publicaç{jogosExibidos.length === 1 ? 'ão' : 'ões'}{selectedDate ? ` em ${fmtData(selectedDate)}` : ` em ${cidade || '…'}`}</p>
              </div>
              <button onClick={() => { setCalAberto(v => !v); if (calAberto) setSelectedDate(null); }}
                style={{ ...s.minimizeBtn, color: calAberto ? '#4fc3f7' : 'rgba(255,255,255,0.6)', boxShadow: calAberto ? 'inset 0 0 0 1px rgba(79,195,247,0.4)' : 'none', background: calAberto ? 'rgba(79,195,247,0.12)' : 'rgba(255,255,255,0.07)' }}>
                📅
              </button>
            </div>

            {calAberto && <MiniCalendar jogos={jogosAtivos} selectedDate={selectedDate} onSelectDate={setSelectedDate} />}

            {loadingJogos ? (
              <div style={s.emptyFeed}><p style={s.emptyText}>Carregando mural...</p></div>
            ) : jogosExibidos.length === 0 ? (
              <div style={s.emptyFeed}>
                <span style={{ fontSize: 40 }}>🎾</span>
                <p style={s.emptyText}>{selectedDate ? `Nenhum parceiro em ${fmtData(selectedDate)}.` : `Nenhum parceiro disponível em ${cidade} ainda.`}</p>
                <p style={s.emptyHint}>{selectedDate ? 'Tente outra data.' : 'Seja o primeiro a publicar!'}</p>
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

// ─── JogoCard ────────────────────────────────────────────────────────────────
function JogoCard({ jogo, furosReportados, onReportarFuro, onInteressado, onConfirmarSala, emailUsuario, userId }: {
  jogo: Jogo;
  furosReportados: number;
  onReportarFuro: () => void;
  onInteressado: () => void;
  onConfirmarSala: (email: string) => void;
  emailUsuario: string;
  userId: number;
}) {
  const cor      = classeColor(jogo.classe);
  const waUrl    = buildWhatsAppUrl(jogo);
  const calUrl   = buildGCalUrl(jogo);
  const isOwner  = jogo.emailPublicador === emailUsuario;
  const isConfirmada = jogo.status === 'confirmada';

  const [reportado,       setReportado]      = useState(false);
  const [showResult,      setShowResult]      = useState(false);
  const [interessados,    setInteressados]    = useState<Interessado[]>([]);
  const [loadingInteress, setLoadingInteress] = useState(false);
  const [showInteress,    setShowInteress]    = useState(false);
  const [selectedEmail,   setSelectedEmail]   = useState('');
  const [confirmando,     setConfirmando]     = useState(false);

  const handleWaClick = () => { if (!isOwner) onInteressado(); };

  const loadInteressados = async () => {
    setLoadingInteress(true);
    try {
      const r = await fetch(`${API_BASE}/jogos/${jogo.id}/interessados?email_publicador=${encodeURIComponent(emailUsuario)}`);
      setInteressados(await r.json());
    } catch { /* silent */ }
    finally { setLoadingInteress(false); }
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

  const jaJogou = isExpired(jogo);

  return (
    <>
      {showResult && <ResultadoModal jogo={jogo} emailUsuario={emailUsuario} userId={userId} onClose={() => setShowResult(false)} />}

      <div style={{ ...sc.card, boxShadow: `inset 5px 0 0 0 ${isConfirmada ? '#81c784' : cor}` }}>
        <div style={sc.content}>
          <div style={sc.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...sc.classeBadge, color: cor, borderColor: `${cor}60`, background: `${cor}1a` }}>{jogo.classe}</span>
              {isConfirmada && <span style={sc.confirmadaBadge}>✓ Partida Confirmada</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {furosReportados >= 3 && <span style={sc.furoBadge}>⚠️ {furosReportados} furos</span>}
              {isOwner && <span style={sc.ownerBadge}>sua publicação</span>}
              <span style={sc.tempo}>{tempoRelativo(jogo.publicadoEm)}</span>
            </div>
          </div>

          <div style={sc.infoList}>
            <InfoItem icon="📅" text={fmtDataRange(jogo)} />
            <InfoItem icon="🕐" text={`${jogo.horarioInicio.replace(':', 'h')} – ${jogo.horarioFim.replace(':', 'h')}`} />
            <InfoItem icon="📍" text={jogo.local} />
            {(jogo.interessados ?? 0) > 0 && (
              <InfoItem icon="👥" text={`${jogo.interessados} interessado${(jogo.interessados ?? 0) > 1 ? 's' : ''} conversando`} />
            )}
          </div>

          {!isConfirmada && (
            <div style={sc.btnRow}>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" style={sc.waBtn} onClick={handleWaClick}>
                <WaIcon /> WhatsApp {!isOwner && (jogo.interessados ?? 0) > 0 ? `· ${jogo.interessados}` : ''}
              </a>
              <a href={calUrl} target="_blank" rel="noopener noreferrer" style={sc.calBtn}>📅 Agendar</a>
            </div>
          )}

          {isOwner && !isConfirmada && (jogo.interessados ?? 0) > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={toggleInteressados} style={sc.interessBtn}>
                👥 {showInteress ? 'Ocultar' : 'Ver'} interessados ({jogo.interessados})
              </button>
              {showInteress && (
                <div style={sc.interessBox}>
                  {loadingInteress ? (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Carregando...</p>
                  ) : interessados.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Nenhum ainda.</p>
                  ) : (
                    <>
                      <select style={sc.interessSelect} value={selectedEmail} onChange={e => setSelectedEmail(e.target.value)}>
                        <option value="">Selecione com quem confirmou...</option>
                        {interessados.map(i => (
                          <option key={i.email_usuario} value={i.email_usuario}>{i.nome_usuario}</option>
                        ))}
                      </select>
                      <button
                        style={{ ...sc.confirmarBtn, opacity: !selectedEmail || confirmando ? 0.5 : 1 }}
                        disabled={!selectedEmail || confirmando}
                        onClick={handleConfirmar}
                      >
                        🔒 Sala Fechada — Confirmar com {interessados.find(i => i.email_usuario === selectedEmail)?.nome_usuario || '...'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isConfirmada && isOwner && (
            <div style={sc.confirmadaInfo}>
              ✓ Confirmado com <strong>{jogo.confirmado_com?.split('@')[0]}</strong>
            </div>
          )}

          <div style={sc.reportRow}>
            {jaJogou && jogo.emailPublicador && jogo.emailPublicador !== emailUsuario && (
              <button onClick={() => setShowResult(true)} style={sc.rankBtn}>🏆 Registrar resultado</button>
            )}
            {!isOwner && (
              reportado
                ? <span style={sc.reportadoTxt}>✓ Furo registrado</span>
                : <button onClick={() => { onReportarFuro(); setReportado(true); }} style={sc.reportBtn}>Denunciar furo</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ResultadoModal ──────────────────────────────────────────────────────────
interface Liga { id: string; nome: string; temporada_ativa_id: string | null; temporada_ativa_nome: string | null; }

function ResultadoModal({ jogo, emailUsuario, userId, onClose }: { jogo: Jogo; emailUsuario: string; userId: number; onClose: () => void }) {
  const [ligas, setLigas] = useState<Liga[]>([]); const [ligaId, setLigaId] = useState(''); const [tempId, setTempId] = useState('');
  const [tipo, setTipo] = useState('melhor_de_3'); const [sets, setSets] = useState([{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]);
  const [wo, setWo] = useState(false); const [euGanhei, setEuGanhei] = useState(true); const [loading, setLoading] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) ?? '';
    if (!token) return;
    fetch(`${API_BASE}/ranking/ligas`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { const arr: Liga[] = d.data ?? []; setLigas(arr); if (arr.length > 0) { setLigaId(arr[0].id); setTempId(arr[0].temporada_ativa_id ?? ''); } }).catch(() => setErr('Erro ao carregar ligas.'));
  }, []);
  const onLigaChange = (id: string) => { setLigaId(id); const l = ligas.find(x => x.id === id); setTempId(l?.temporada_ativa_id ?? ''); };
  const submit = async () => {
    if (!tempId) { setErr('Selecione uma liga com temporada ativa.'); return; }
    setLoading(true); setErr('');
    const token = localStorage.getItem(TOKEN_KEY) ?? '';
    let placar = null; let vencedorSouEu = euGanhei;
    if (!wo) {
      const nSets = tipo === 'pro_set' ? 1 : 2;
      const parsedSets = sets.slice(0, nSets).map(s => ({ setA: Number(s.a || 0), setB: Number(s.b || 0) }));
      if (tipo !== 'pro_set') { const sA = parsedSets.filter(s => s.setA > s.setB).length; const sB = parsedSets.filter(s => s.setB > s.setA).length; if (sA === 1 && sB === 1) parsedSets.push({ setA: Number(sets[2].a || 0), setB: Number(sets[2].b || 0) }); }
      placar = parsedSets;
      const wA = parsedSets.filter(s => s.setA > s.setB).length; const wB = parsedSets.filter(s => s.setB > s.setA).length; vencedorSouEu = wA > wB;
    }
    try {
      const body: Record<string, unknown> = { temporada_id: tempId, jogador_a_id: userId, email_b: jogo.emailPublicador, placar, tipo_partida: tipo, wo, data_partida: jogo.dataInicio };
      if (wo) body.eu_ganhei = euGanhei; else body.vencedor_e_a = vencedorSouEu;
      const r = await fetch(`${API_BASE}/ranking/partidas/mural`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const json = await r.json();
      if (!r.ok) { setErr(json.error ?? 'Erro.'); return; }
      setOk(true); setTimeout(onClose, 2000);
    } catch { setErr('Erro de conexão.'); }
    setLoading(false);
  };
  if (ok) return (<div style={rm.overlay} onClick={onClose}><div style={rm.sheet}><div style={{ fontSize: 48 }}>🏆</div><p style={{ color: '#81c784', fontWeight: 800, fontSize: 16, margin: 0 }}>Resultado registrado!</p><p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>Aguardando confirmação do adversário.</p></div></div>);
  const nSets = tipo === 'pro_set' ? 1 : 2;
  const sA0 = Number(sets[0].a||0), sB0 = Number(sets[0].b||0), sA1 = Number(sets[1].a||0), sB1 = Number(sets[1].b||0);
  const show3 = tipo !== 'pro_set' && !wo && ((sA0 > sB0 && sA1 < sB1) || (sA0 < sB0 && sA1 > sB1));
  return (
    <div style={rm.overlay} onClick={onClose}>
      <div style={rm.sheet} onClick={e => e.stopPropagation()}>
        <div style={rm.header}><span style={rm.title}>📊 Registrar Resultado</span><button style={rm.closeBtn} onClick={onClose}>✕</button></div>
        <p style={rm.sub}>Você jogou com <strong>{jogo.emailPublicador?.split('@')[0] ?? 'esse jogador'}</strong> em {fmtData(jogo.dataInicio)}</p>
        {ligas.length === 0 && !err && <p style={rm.hint}>Carregando ligas…</p>}
        {ligas.length > 0 && <select style={rm.sel} value={ligaId} onChange={e => onLigaChange(e.target.value)}>{ligas.map(l => <option key={l.id} value={l.id}>{l.nome}{l.temporada_ativa_nome ? ` — ${l.temporada_ativa_nome}` : ' (sem temporada)'}</option>)}</select>}
        <div style={rm.woRow}><label style={rm.woLabel}><input type="checkbox" checked={wo} onChange={e => setWo(e.target.checked)} style={{ marginRight: 8 }} />W.O. (adversário não compareceu)</label></div>
        {!wo && (<><select style={rm.sel} value={tipo} onChange={e => setTipo(e.target.value)}><option value="melhor_de_3">Melhor de 3 sets</option><option value="2sets_supertiebreak">2 Sets + Super Tiebreak</option><option value="pro_set">Pró-set</option></select><p style={rm.hint}>Placar — Eu × Adversário</p>{Array.from({ length: show3 ? 3 : nSets }).map((_, i) => (<div key={i} style={rm.setRow}><span style={rm.setLabel}>Set {i+1}</span><input style={rm.setInp} type="number" min={0} max={99} placeholder="Eu" value={sets[i].a} onChange={e => setSets(prev => { const n = [...prev]; n[i] = { ...n[i], a: e.target.value }; return n; })} /><span style={{ color: 'rgba(255,255,255,0.4)' }}>×</span><input style={rm.setInp} type="number" min={0} max={99} placeholder="Adv" value={sets[i].b} onChange={e => setSets(prev => { const n = [...prev]; n[i] = { ...n[i], b: e.target.value }; return n; })} /></div>))}</>)}
        {wo && (<div style={rm.woRow}><label style={rm.woLabel}><input type="radio" checked={euGanhei} onChange={() => setEuGanhei(true)} style={{ marginRight: 6 }} />Eu ganhei o WO</label><label style={rm.woLabel}><input type="radio" checked={!euGanhei} onChange={() => setEuGanhei(false)} style={{ marginRight: 6 }} />Adversário ganhou o WO</label></div>)}
        {err && <p style={{ color: '#ef5350', fontSize: 13, margin: 0 }}>{err}</p>}
        <button style={{ ...rm.submitBtn, opacity: loading ? 0.6 : 1 }} onClick={submit} disabled={loading || !tempId}>{loading ? 'Enviando…' : '🏆 Registrar no Ranking'}</button>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase' as const }}>{label}</span>{children}</div>);
}

function MiniCalendar({ jogos, selectedDate, onSelectDate }: { jogos: Jogo[]; selectedDate: string | null; onSelectDate: (d: string | null) => void }) {
  const now = new Date(); const [viewYear, setViewYear] = useState(now.getFullYear()); const [viewMonth, setViewMonth] = useState(now.getMonth());
  const availDates = new Set<string>();
  jogos.forEach(jogo => { const start = new Date(jogo.dataInicio + 'T12:00:00'); const end = new Date((jogo.dataFim || jogo.dataInicio) + 'T12:00:00'); const cursor = new Date(start); while (cursor <= end) { availDates.add(cursor.toISOString().split('T')[0]); cursor.setDate(cursor.getDate() + 1); } });
  const todayStr = now.toISOString().split('T')[0]; const firstDow = new Date(viewYear, viewMonth, 1).getDay(); const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y-1), setViewMonth(11)) : setViewMonth(m => m-1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y+1), setViewMonth(0)) : setViewMonth(m => m+1);
  return (
    <div style={cal.wrapper}>
      <div style={cal.nav}><button onClick={prevMonth} style={cal.navBtn}>◀</button><span style={cal.monthLabel}>{MESES[viewMonth]} {viewYear}</span><button onClick={nextMonth} style={cal.navBtn}>▶</button></div>
      <div style={cal.grid}>
        {['D','S','T','Q','Q','S','S'].map((d, i) => <span key={`dow${i}`} style={cal.dow}>{d}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const mm = String(viewMonth + 1).padStart(2, '0'); const dd = String(d).padStart(2, '0');
          const dateStr = `${viewYear}-${mm}-${dd}`; const hasJogos = availDates.has(dateStr); const isPast = dateStr < todayStr; const isToday = dateStr === todayStr; const isSel = dateStr === selectedDate; const clickable = hasJogos && !isPast;
          return (<button key={dateStr} onClick={() => clickable && onSelectDate(isSel ? null : dateStr)} style={{ ...cal.dayBtn, ...(isPast ? cal.dayPast : {}), ...(isToday && !isSel ? cal.dayToday : {}), ...(clickable && !isSel ? cal.dayHas : {}), ...(isSel ? cal.daySel : {}), cursor: clickable ? 'pointer' : 'default' }}>{d}{clickable && <span style={{ ...cal.dot, background: isSel ? '#000' : '#4fc3f7' }} />}</button>);
        })}
      </div>
      {selectedDate && <button onClick={() => onSelectDate(null)} style={cal.clearBtn}>× Mostrar todos os dias</button>}
    </div>
  );
}

function InfoItem({ icon, text }: { icon: string; text: string }) {
  return (<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span><span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{text}</span></div>);
}

function WaIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>);
}

const cal: Record<string, React.CSSProperties> = {
  wrapper: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '14px 10px' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' },
  navBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 14, fontWeight: 700, color: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 },
  dow: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 6 },
  dayBtn: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', aspectRatio: '1', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: 0, gap: 1 },
  dayPast: { color: 'rgba(255,255,255,0.12)' }, dayToday: { color: '#4fc3f7', boxShadow: 'inset 0 0 0 1px rgba(79,195,247,0.4)', borderRadius: 8 }, dayHas: { color: '#fff', fontWeight: 700 }, daySel: { background: '#4fc3f7', color: '#000', fontWeight: 800, borderRadius: 8 },
  dot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%' },
  clearBtn: { marginTop: 10, width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, boxSizing: 'border-box' },
};
const cm: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,26,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '24px 24px 32px', maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#cce0ff', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  icon: { fontSize: 52, lineHeight: 1 }, title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' }, sub: { margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 },
  detectBtn: { width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(79,195,247,0.12)', border: '1.5px solid #4fc3f7', color: '#4fc3f7', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  ouLabel: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  input: { width: '100%', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 16, boxSizing: 'border-box', colorScheme: 'dark' },
  erro: { margin: 0, fontSize: 13, color: '#ff6b6b', textAlign: 'center' },
  confirmBtn: { width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, #1b5e20, #388e3c)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' },
};
const bb: Record<string, React.CSSProperties> = {
  banner: { background: 'rgba(244,67,54,0.12)', border: '1px solid rgba(244,67,54,0.4)', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 },
  title: { margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#ef9a9a' }, msg: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }, sub: { margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
};
const rg: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' },
  header: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxSizing: 'border-box' },
  body: { padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  intro: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }, rules: { display: 'flex', flexDirection: 'column', gap: 8 }, ruleRow: { display: 'flex', alignItems: 'center', gap: 10 },
  ruleN: { fontSize: 14, fontWeight: 800, minWidth: 90, color: '#fff' }, ruleArrow: { color: 'rgba(255,255,255,0.5)', fontSize: 14 }, ruleConsequence: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 },
  note: { margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 },
};
const s: Record<string, React.CSSProperties> = {
  page: { position: 'fixed', inset: 0, background: '#0d0d1a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', gap: 12, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', flexShrink: 0, zIndex: 10 },
  backBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.22)', color: '#cce0ff', padding: '8px 14px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 600, flexShrink: 0 },
  headerCenter: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }, headerTitle: { fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.2 },
  cidadeBtn: { background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.3)', color: '#4fc3f7', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.2 },
  headerSpacer: { width: 70, flexShrink: 0 },
  scrollBody: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] },
  inner: { display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 16px 48px', maxWidth: 540, margin: '0 auto', boxSizing: 'border-box', width: '100%' },
  section: { display: 'flex', flexDirection: 'column', gap: 14 }, sectionHead: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  sectionIcon: { fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 }, sectionTitle: { fontSize: 20, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: -0.3 }, sectionSub: { margin: '3px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  formCard: { display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 22, padding: '20px 16px 24px' },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase' }, subLabel: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: 0.4 },
  input: { width: '100%', maxWidth: '100%', padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box', colorScheme: 'dark', display: 'block' },
  select: { width: '100%', padding: '13px 14px', borderRadius: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, appearance: 'auto', boxSizing: 'border-box', colorScheme: 'dark' },
  row: { display: 'flex', gap: 10, overflow: 'hidden' }, col: { flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 },
  minimizeBtn: { flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 2 },
  timeStack: { display: 'flex', flexDirection: 'column', gap: 8 }, timeRow: { display: 'flex', alignItems: 'center', gap: 12 }, timeLabel: { fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', width: 28, flexShrink: 0 },
  timeInput: { flex: 1, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 15, boxSizing: 'border-box', colorScheme: 'dark', minWidth: 0 },
  modeToggle: { display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, gap: 4 },
  modeBtn: { flex: 1, padding: '10px 8px', borderRadius: 9, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  modeBtnActive: { background: 'rgba(79,195,247,0.2)', color: '#4fc3f7', boxShadow: 'inset 0 0 0 1px rgba(79,195,247,0.4)' },
  erro: { color: '#ff6b6b', fontSize: 13, fontWeight: 600, margin: 0 }, ok: { color: '#aef359', fontSize: 13, fontWeight: 600, margin: 0 },
  publishBtn: { padding: '16px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #1b5e20, #388e3c)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(56,142,60,0.4)', letterSpacing: 0.2, marginTop: 4 },
  emptyFeed: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px', textAlign: 'center' }, emptyText: { margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }, emptyHint: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  feed: { display: 'flex', flexDirection: 'column', gap: 14 },
};
const sc: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18 },
  content: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  classeBadge: { fontSize: 13, fontWeight: 800, padding: '5px 14px', borderRadius: 20, border: '1px solid', letterSpacing: 0.3 },
  confirmadaBadge: { fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: 'rgba(129,199,132,0.15)', border: '1px solid rgba(129,199,132,0.4)', color: '#81c784' },
  furoBadge: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(244,67,54,0.2)', border: '1px solid rgba(244,67,54,0.5)', color: '#ef9a9a' },
  ownerBadge: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(79,195,247,0.15)', border: '1px solid rgba(79,195,247,0.3)', color: '#4fc3f7' },
  tempo: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 },
  infoList: { display: 'flex', flexDirection: 'column', gap: 7 },
  btnRow: { display: 'flex', gap: 10 },
  waBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 12px', borderRadius: 13, background: 'linear-gradient(135deg, #1b5e20, #388e3c)', color: '#fff', fontSize: 14, fontWeight: 800, textDecoration: 'none', boxShadow: '0 3px 14px rgba(56,142,60,0.35)' },
  calBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 12px', borderRadius: 13, background: 'rgba(66,133,244,0.15)', border: '1.5px solid rgba(66,133,244,0.5)', color: '#90caf9', fontSize: 14, fontWeight: 700, textDecoration: 'none' },
  interessBtn: { width: '100%', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,167,38,0.1)', border: '1px solid rgba(255,167,38,0.3)', color: '#ffa726', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' },
  interessBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  interessSelect: { width: '100%', padding: '11px 12px', borderRadius: 10, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 14, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  confirmarBtn: { width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #1b5e20, #388e3c)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  confirmadaInfo: { fontSize: 13, color: '#81c784', fontWeight: 600, textAlign: 'center', padding: '6px 0' },
  reportRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2, gap: 8 },
  reportBtn: { background: 'none', border: 'none', padding: '4px 2px', color: 'rgba(255,255,255,0.22)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 },
  reportadoTxt: { fontSize: 11, color: '#aef359', fontWeight: 600 },
  rankBtn: { background: 'rgba(255,167,38,0.12)', border: '1px solid rgba(255,167,38,0.35)', color: '#ffa726', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
};
const rm: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 },
  sheet: { background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '20px 20px 28px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 16, fontWeight: 800, color: '#fff' }, closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' },
  sub: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }, hint: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  sel: { width: '100%', padding: '12px 14px', borderRadius: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.13)', color: '#fff', fontSize: 14, boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'] },
  woRow: { display: 'flex', flexDirection: 'column', gap: 8 }, woLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  setRow: { display: 'flex', alignItems: 'center', gap: 10 }, setLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, width: 40, flexShrink: 0 },
  setInp: { width: 60, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', padding: '8px 0', fontSize: 18, fontWeight: 700, textAlign: 'center', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '14px 0', borderRadius: 12, background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
};
