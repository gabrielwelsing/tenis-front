// =============================================================================
// RANKING SCREEN — Ligas, Temporadas, Tabela, Partidas, Desafios, Config
// Auth: Bearer token do localStorage
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';

const API       = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';
const TOKEN_KEY = 'tenis_token';

interface Props {
  onBack:    () => void;
  userId:    number;
  role:      'user' | 'aluno' | 'admin';
  username:  string;
  fotoUrl?:  string | null;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Liga {
  id:                   string;
  admin_id:             number;
  nome:                 string;
  is_admin:             boolean;
  admin_nome:           string;
  temporada_ativa_id:   string | null;
  temporada_ativa_nome: string | null;
  total_membros:        number;
}
interface Temporada { id: string; liga_id: string; nome: string; data_inicio: string; data_fim: string; ativa: boolean; total_partidas: number; }
interface Membro    { membro_id: string; user_id: number; classe: string; nome: string; email: string; foto_url: string | null; }
interface RankingEntry { id: number; nome: string; foto_url: string | null; classe: string; total_pontos: number; jogos: number; vitorias: number; derrotas: number; }
interface Partida   { id: string; jogador_a_id: number; jogador_b_id: number; jogador_a_nome: string; jogador_b_nome: string; vencedor_id: number | null; vencedor_nome: string | null; placar: Array<{setA:number;setB:number}> | null; tipo_partida: string; wo: boolean; pontos_a: number; pontos_b: number; bonus_a: number; bonus_b: number; status: string; data_partida: string; confirmado_a: boolean; confirmado_b: boolean; rodada_id: string | null; }
interface Desafio   { id: string; liga_id: string; desafiante_id: number; desafiado_id: number; desafiante_nome: string; desafiado_nome: string; data_sugerida: string; horario_sugerido: string; local_sugerido: string; status: string; contra_data: string | null; contra_horario: string | null; contra_local: string | null; }
interface Rodada    { id: string; temporada_id: string; numero: number; ativa: boolean; total_matchups: number; }

type Tab = 'ranking' | 'rodada' | 'partidas' | 'desafios' | 'config';
const CLASSES = ['iniciante', 'intermediario', 'avancado'];
const CLASSE_LABELS: Record<string, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
const TIPO_LABELS: Record<string, string>   = { melhor_de_3: 'Melhor de 3', '2sets_supertiebreak': '2 Sets + ST', pro_set: 'Pró-set' };

// ─── Classe color palette ─────────────────────────────────────────────────────
const CLASSE_COLORS: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  avancado:      { color: '#b98718', bg: '#fff8e6', border: '#f0d58a', glow: 'rgba(185,135,24,0.18)' },
  intermediario: { color: '#c66b4d', bg: '#fff1eb', border: '#efc7b8', glow: 'rgba(198,107,77,0.18)' },
  iniciante:     { color: '#3f8f5b', bg: '#edf8ef', border: '#bee0c8', glow: 'rgba(63,143,91,0.16)' },
  geral:         { color: '#8d7b70', bg: '#fffaf7', border: '#eadfd6', glow: 'rgba(117,76,56,0.10)' },
};

function getClasseColor(classe: string) {
  return CLASSE_COLORS[classe] ?? CLASSE_COLORS['geral'];
}

function avatar(nome: string, foto: string | null, size = 36) {
  if (foto) return <img src={foto} alt={nome} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #c6714e, #8f4635)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_BG = [
  'linear-gradient(135deg, #fff8e6, #ffffff)',
  'linear-gradient(135deg, #f5f2ef, #ffffff)',
  'linear-gradient(135deg, #fff1e8, #ffffff)',
];
const MEDAL_BORDER = ['#f0d58a', '#d9d3cf', '#e5b184'];

// ─── API helpers ─────────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem(TOKEN_KEY) ?? '';
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Erro.');
  return json.data;
}

// =============================================================================
export default function RankingScreen({ onBack, userId, role, username, fotoUrl }: Props) {
  const isAdmin = role === 'admin';

  // ─── Navigation ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('ranking');

  // ─── Liga / temporada selection ────────────────────────────────────────────
  const [ligas,       setLigas]       = useState<Liga[]>([]);
  const [ligaId,      setLigaId]      = useState('');
  const [temporadas,  setTemporadas]  = useState<Temporada[]>([]);
  const [temporadaId, setTemporadaId] = useState('');

  // ─── Data ──────────────────────────────────────────────────────────────────
  const [membros,      setMembros]      = useState<Membro[]>([]);
  const [rankingData,  setRankingData]  = useState<RankingEntry[]>([]);
  const [partidas,     setPartidas]     = useState<Partida[]>([]);
  const [desafios,     setDesafios]     = useState<Desafio[]>([]);
  const [classeFilter, setClasseFilter] = useState('');
  const [rodadas,      setRodadas]      = useState<Rodada[]>([]);
  const [matchups,     setMatchups]     = useState<Partida[]>([]);
  const [pendentes,    setPendentes]    = useState<Partida[]>([]);
  const [partSel,      setPartSel]      = useState<Set<number>>(new Set());

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ─── Forms ─────────────────────────────────────────────────────────────────
  const [novaLiga, setNovaLiga]   = useState('');
  const [formTemp, setFormTemp]   = useState({ nome: '', data_inicio: '', data_fim: '' });
  const [formMembro, setFormMembro] = useState({ email: '', classe: 'intermediario' });
  const [formPartida, setFormPartida] = useState({
    jogador_a_id: 0, jogador_b_id: 0, tipo_partida: 'melhor_de_3',
    wo: false, wo_vencedor_id: 0, data_partida: new Date().toISOString().split('T')[0],
    sets: [{ setA: '', setB: '' }, { setA: '', setB: '' }, { setA: '', setB: '' }],
  });
  const [formDesafio, setFormDesafio] = useState({ desafiado_id: 0, data_sugerida: '', horario_sugerido: '', local_sugerido: '' });
  const [showDesafioForm, setShowDesafioForm] = useState(false);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  // ─── Load ligas ────────────────────────────────────────────────────────────
  const loadLigas = useCallback(async () => {
    setLoading(true);
    try {
      const data: Liga[] = await api('GET', '/ranking/ligas');
      setLigas(data);
      if (data.length > 0 && !ligaId) {
        const first = data[0];
        setLigaId(first.id);
        if (first.temporada_ativa_id) setTemporadaId(first.temporada_ativa_id);
      }
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  }, [ligaId]);

  useEffect(() => { loadLigas(); }, []);

  // ─── Load data when liga/temporada changes ─────────────────────────────────
  const loadMembros = useCallback(async () => {
    if (!ligaId) return;
    try { setMembros(await api('GET', `/ranking/ligas/${ligaId}/membros`)); } catch { /* silent */ }
  }, [ligaId]);

  const loadTemporadas = useCallback(async () => {
    if (!ligaId) return;
    try {
      const data: Temporada[] = await api('GET', `/ranking/ligas/${ligaId}/temporadas`);
      setTemporadas(data);
      const ativa = data.find(t => t.ativa);
      if (ativa && !temporadaId) setTemporadaId(ativa.id);
    } catch { /* silent */ }
  }, [ligaId, temporadaId]);

  const loadRanking = useCallback(async () => {
    if (!temporadaId) return;
    try {
      const qs = classeFilter ? `?classe=${classeFilter}` : '';
      setRankingData(await api('GET', `/ranking/temporadas/${temporadaId}/tabela${qs}`));
    } catch { /* silent */ }
  }, [temporadaId, classeFilter]);

  const loadPartidas = useCallback(async () => {
    if (!temporadaId) return;
    try { setPartidas(await api('GET', `/ranking/temporadas/${temporadaId}/partidas`)); } catch { /* silent */ }
  }, [temporadaId]);

  const loadDesafios = useCallback(async () => {
    if (!ligaId) return;
    try { setDesafios(await api('GET', `/ranking/desafios?ligaId=${ligaId}`)); } catch { /* silent */ }
  }, [ligaId]);

  const loadRodadas = useCallback(async () => {
    if (!temporadaId) return;
    try {
      const data: Rodada[] = await api('GET', `/ranking/temporadas/${temporadaId}/rodadas`);
      setRodadas(data);
      const ativa = data.find(r => r.ativa);
      if (ativa) {
        const mu: Partida[] = await api('GET', `/ranking/rodadas/${ativa.id}/matchups`);
        setMatchups(mu);
      } else {
        setMatchups([]);
      }
    } catch { /* silent */ }
  }, [temporadaId]);

  const loadPendentes = useCallback(async () => {
    try { setPendentes(await api('GET', '/ranking/partidas/pendentes')); } catch { /* silent */ }
  }, []);

  useEffect(() => { loadMembros(); loadTemporadas(); }, [ligaId]);
  useEffect(() => { loadRanking(); loadPartidas(); loadDesafios(); loadRodadas(); loadPendentes(); }, [temporadaId]);
  useEffect(() => { if (temporadaId) loadRanking(); }, [classeFilter]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const criarLiga = async () => {
    if (!novaLiga.trim()) return;
    setLoading(true);
    try {
      await api('POST', '/ranking/ligas', { nome: novaLiga.trim() });
      setNovaLiga('');
      flash('ok', 'Liga criada!');
      await loadLigas();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  };

  const criarTemporada = async () => {
    if (!formTemp.nome || !formTemp.data_inicio || !formTemp.data_fim) { flash('err', 'Preencha todos os campos.'); return; }
    setLoading(true);
    try {
      await api('POST', `/ranking/ligas/${ligaId}/temporadas`, formTemp);
      setFormTemp({ nome: '', data_inicio: '', data_fim: '' });
      flash('ok', 'Temporada criada!');
      await loadTemporadas();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  };

  const encerrarTemporada = async (id: string) => {
    if (!confirm('Encerrar esta temporada?')) return;
    try {
      await api('PATCH', `/ranking/ligas/${ligaId}/temporadas/${id}`, {});
      flash('ok', 'Temporada encerrada.');
      await loadTemporadas();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
  };

  const adicionarMembro = async () => {
    if (!formMembro.email) { flash('err', 'E-mail obrigatório.'); return; }
    setLoading(true);
    try {
      await api('POST', `/ranking/ligas/${ligaId}/membros`, formMembro);
      setFormMembro({ email: '', classe: 'intermediario' });
      flash('ok', 'Membro adicionado!');
      await loadMembros();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  };

  const removerMembro = async (uid: number) => {
    if (!confirm('Remover membro da liga?')) return;
    try {
      await api('DELETE', `/ranking/ligas/${ligaId}/membros/${uid}`, {});
      flash('ok', 'Membro removido.');
      await loadMembros();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
  };

  const alterarClasse = async (uid: number, classe: string) => {
    try {
      await api('PATCH', `/ranking/ligas/${ligaId}/membros/${uid}`, { classe });
      flash('ok', 'Classe atualizada.');
      await loadMembros();
      await loadRanking();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
  };

  const registrarPartida = async () => {
    const { jogador_a_id, jogador_b_id, tipo_partida, wo, wo_vencedor_id, data_partida, sets } = formPartida;
    if (!jogador_a_id || !jogador_b_id) { flash('err', 'Selecione os dois jogadores.'); return; }
    if (jogador_a_id === jogador_b_id) { flash('err', 'Jogadores devem ser diferentes.'); return; }
    if (wo && !wo_vencedor_id) { flash('err', 'Selecione o vencedor do WO.'); return; }

    let placar: Array<{setA:number;setB:number}> | null = null;
    if (!wo) {
      const nSets = tipo_partida === 'pro_set' ? 1 : 2;
      placar = sets.slice(0, nSets).map(s => ({ setA: Number(s.setA || 0), setB: Number(s.setB || 0) }));
      // add third set if needed (melhor_de_3 and tied)
      if (tipo_partida !== 'pro_set') {
        const sA = placar.filter(s => s.setA > s.setB).length;
        const sB = placar.filter(s => s.setB > s.setA).length;
        if (sA === 1 && sB === 1) placar.push({ setA: Number(sets[2].setA || 0), setB: Number(sets[2].setB || 0) });
      }
    }

    setLoading(true);
    try {
      await api('POST', '/ranking/partidas', { temporada_id: temporadaId, jogador_a_id, jogador_b_id, placar, tipo_partida, wo, wo_vencedor_id: wo ? wo_vencedor_id : undefined, data_partida });
      setFormPartida({ jogador_a_id: 0, jogador_b_id: 0, tipo_partida: 'melhor_de_3', wo: false, wo_vencedor_id: 0, data_partida: new Date().toISOString().split('T')[0], sets: [{ setA: '', setB: '' }, { setA: '', setB: '' }, { setA: '', setB: '' }] });
      flash('ok', 'Partida registrada! Aguardando confirmação.');
      await loadPartidas();
      await loadRanking();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  };

  const confirmarPartida = async (id: string, confirmar: boolean) => {
    try {
      await api('PATCH', `/ranking/partidas/${id}/confirmar`, { confirmar });
      flash('ok', confirmar ? 'Confirmado! Pontos entram ao outro confirmar também.' : 'Resultado contestado — admin vai revisar.');
      await loadPartidas();
      await loadPendentes();
      await loadRanking();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
  };

  const criarRodada = async () => {
    if (partSel.size < 2) { flash('err', 'Selecione ao menos 2 participantes.'); return; }
    if (!temporadaId) { flash('err', 'Selecione uma temporada ativa.'); return; }
    setLoading(true);
    try {
      await api('POST', '/ranking/rodadas', { temporada_id: temporadaId, participantes: [...partSel] });
      setPartSel(new Set());
      flash('ok', 'Rodada criada e emparelhamentos gerados!');
      await loadRodadas();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  };

  const encerrarRodada = async (rodadaId: string) => {
    if (!confirm('Encerrar esta rodada?')) return;
    try {
      await api('PATCH', `/ranking/rodadas/${rodadaId}/encerrar`, {});
      flash('ok', 'Rodada encerrada.');
      await loadRodadas();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
  };

  const togglePartSel = (uid: number) => {
    setPartSel(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const criarDesafio = async () => {
    if (!formDesafio.desafiado_id || !formDesafio.data_sugerida || !formDesafio.horario_sugerido || !formDesafio.local_sugerido) {
      flash('err', 'Preencha todos os campos do desafio.'); return;
    }
    setLoading(true);
    try {
      await api('POST', '/ranking/desafios', { liga_id: ligaId, ...formDesafio });
      setFormDesafio({ desafiado_id: 0, data_sugerida: '', horario_sugerido: '', local_sugerido: '' });
      setShowDesafioForm(false);
      flash('ok', 'Desafio enviado!');
      await loadDesafios();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
    setLoading(false);
  };

  const responderDesafio = async (id: string, status: string) => {
    try {
      await api('PATCH', `/ranking/desafios/${id}`, { status });
      flash('ok', status === 'aceito' ? 'Desafio aceito!' : 'Desafio recusado.');
      await loadDesafios();
    } catch (e: unknown) { flash('err', e instanceof Error ? e.message : 'Erro.'); }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────
  const ligaAtual   = ligas.find(l => l.id === ligaId);
  const isLigaAdmin = ligaAtual?.is_admin ?? false;
  const aproveitamento = (v: number, j: number) => j === 0 ? 0 : Math.round((v / j) * 100);

  // ─── Liga selection UI ─────────────────────────────────────────────────────
  const renderLigaSelect = () => (
    <div style={s.ligaRow}>
      {/* Liga selector estilizado como chip/pill */}
      <div style={{ position: 'relative', flex: 1 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none', zIndex: 1 }}>🏟️</span>
        <select
          style={{ ...s.ligaSelect, paddingLeft: 30 }}
          value={ligaId}
          onChange={e => { setLigaId(e.target.value); setTemporadaId(''); setRankingData([]); }}
        >
          {ligas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>
      {temporadas.length > 0 && (
        <select
          style={{ ...s.ligaSelect, flex: 0.8 }}
          value={temporadaId}
          onChange={e => setTemporadaId(e.target.value)}
        >
          {temporadas.map(t => <option key={t.id} value={t.id}>{t.nome}{t.ativa ? ' ✓' : ''}</option>)}
        </select>
      )}
    </div>
  );

  // ─── Tab: Rodada ───────────────────────────────────────────────────────────
  const renderRodada = () => {
    const rodadaAtiva = rodadas.find(r => r.ativa);

    if (!temporadaId) return <div style={s.empty}>Selecione uma temporada.</div>;

    if (!rodadaAtiva) {
      if (isLigaAdmin) return (
        <div>
          <div style={{ textAlign: 'center', padding: '32px 16px 16px', color: '#9b8a7f' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhuma rodada ativa</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>Selecione os participantes e o sistema emparelhará automaticamente por posição no ranking.</div>
          </div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {membros.map(m => (
              <div key={m.user_id} onClick={() => togglePartSel(m.user_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
                  border: `1.5px solid ${partSel.has(m.user_id) ? 'rgba(255,215,0,.5)' : '#f4ebe3'}`,
                  background: partSel.has(m.user_id) ? 'rgba(255,215,0,.06)' : '#fff', cursor: 'pointer' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${partSel.has(m.user_id) ? '#b98718' : '#dfc8bb'}`,
                  background: partSel.has(m.user_id) ? '#b98718' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#000', flexShrink: 0 }}>
                  {partSel.has(m.user_id) ? '✓' : ''}
                </div>
                {avatar(m.nome, m.foto_url, 30)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{m.nome}</div>
                  <div style={{ fontSize: 10, color: '#9b8a7f' }}>{CLASSE_LABELS[m.classe] ?? m.classe}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 16px' }}>
            <button style={{ ...s.submitBtn, opacity: partSel.size >= 2 ? 1 : 0.4 }}
              onClick={criarRodada} disabled={partSel.size < 2 || loading}>
              {loading ? 'Gerando…' : `⚔️ Gerar Rodada (${partSel.size} selecionados)`}
            </button>
          </div>
        </div>
      );
      return (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9b8a7f' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Nenhuma rodada no momento</div>
          <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>Aguarde o professor criar a próxima rodada.</div>
        </div>
      );
    }

    // Rodada ativa
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>⚔️ Rodada {rodadaAtiva.numero}</div>
            <div style={{ fontSize: 11, color: '#94857a', marginTop: 2 }}>{rodadaAtiva.total_matchups} partidas</div>
          </div>
          {isLigaAdmin && (
            <button onClick={() => encerrarRodada(rodadaAtiva.id)}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(239,83,80,.4)', background: 'rgba(239,83,80,.1)', color: '#ef9a9a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Encerrar
            </button>
          )}
        </div>
        {matchups.length === 0 && <div style={s.empty}>Carregando partidas…</div>}
        {matchups.map((pt, i) => {
          const isMyMatch = pt.jogador_a_id === userId || pt.jogador_b_id === userId;
          return (
            <div key={pt.id} style={{ ...s.partidaCard, ...(isMyMatch ? { boxShadow: '0 0 0 1.5px rgba(255,215,0,.4)' } : {}) }}>
              <div style={s.partidaHeader}>
                <span style={s.partidaDate}>Jogo {i + 1}</span>
                <span style={{ ...s.statusPill,
                  background: pt.status === 'confirmada' ? 'rgba(76,175,80,.15)' : 'rgba(255,167,38,.15)',
                  color: pt.status === 'confirmada' ? '#3f8f5b' : '#ffa726',
                  border: `1px solid ${pt.status === 'confirmada' ? '#3f8f5b' : '#ffa726'}` }}>
                  {pt.status === 'confirmada' ? 'Confirmada' : 'Pendente'}
                </span>
              </div>
              <div style={s.partidaVs}>
                <span style={{ color: pt.vencedor_id === pt.jogador_a_id ? '#3f8f5b' : '#3d332e', fontWeight: 800 }}>
                  {pt.jogador_a_nome}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(79,195,247,.7)', fontWeight: 700 }}>Desafiante</span>
                <span style={s.vs}>VS</span>
                <span style={{ fontSize: 10, color: 'rgba(255,183,77,.7)', fontWeight: 700 }}>Desafiado</span>
                <span style={{ color: pt.vencedor_id === pt.jogador_b_id ? '#3f8f5b' : '#3d332e', fontWeight: 800 }}>
                  {pt.jogador_b_nome}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Tab: Ranking ──────────────────────────────────────────────────────────
  const CLASS_ICONS: Record<string, string> = { avancado: '🏆', intermediario: '🎾', iniciante: '🌱', geral: '📋' };
  const CLASS_ORDER = ['avancado', 'intermediario', 'iniciante', 'geral'];

  // Classe filter pill labels
  const CLASSE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '',             label: 'Todos'           },
    { value: 'avancado',     label: '🏆 Avançado'     },
    { value: 'intermediario',label: '🎾 Intermediário' },
    { value: 'iniciante',    label: '🌱 Iniciante'    },
  ];

  const renderRanking = () => {
    // Agrupa por classe para exibição separada
    const byClasse: Record<string, RankingEntry[]> = {};
    rankingData.forEach(e => {
      const cl = e.classe || 'geral';
      if (!byClasse[cl]) byClasse[cl] = [];
      byClasse[cl].push(e);
    });
    const classesPresentes = CLASS_ORDER.filter(c => byClasse[c]?.length > 0);

    return (
      <div>
        {renderLigaSelect()}

        {/* ── Filtros de classe ── */}
        {temporadaId && (
          <div style={s.filterRow}>
            {CLASSE_FILTER_OPTIONS.map(opt => {
              const isActive = classeFilter === opt.value;
              const palette  = opt.value ? getClasseColor(opt.value) : null;
              const activeBg     = palette ? palette.bg    : '#f4ebe3';
              const activeBorder = palette ? palette.border: '#b5a69d';
              const activeColor  = palette ? palette.color : '#fff';
              return (
                <button
                  key={opt.value}
                  onClick={() => setClasseFilter(opt.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1px solid ${isActive ? activeBorder : '#eadfd6'}`,
                    background: isActive ? activeBg : 'transparent',
                    color: isActive ? activeColor : '#8f7769',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {!temporadaId ? (
          <div style={s.empty}>
            {isLigaAdmin
              ? 'Nenhuma temporada ativa. Vá em Config para criar.'
              : 'Aguardando o admin criar uma temporada.'}
          </div>
        ) : (
          <>
            {rankingData.length === 0 && <div style={s.empty}>Nenhuma partida registrada ainda.</div>}

            {/* Tabelas separadas por classe */}
            {classesPresentes.map(cl => {
              const entries = byClasse[cl];
              const palette = getClasseColor(cl);
              return (
                <div key={cl} style={{ marginBottom: 24 }}>
                  {/* Cabeçalho de seção de classe */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 10px', marginBottom: 2 }}>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${palette.border}, transparent)` }} />
                    <span style={{ fontSize: 13, color: palette.color, fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
                      {CLASS_ICONS[cl]} {(CLASSE_LABELS[cl] ?? cl).toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: '#b5a69d', whiteSpace: 'nowrap' }}>
                      · {entries.length} {entries.length === 1 ? 'jogador' : 'jogadores'}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, ${palette.border}, transparent)` }} />
                  </div>

                  {entries.map((entry, idx) => {
                    const isSelf  = entry.id === userId;
                    const isTop3  = idx < 3;
                    const aprov   = aproveitamento(entry.vitorias, entry.jogos);

                    const cardBg     = isTop3 ? MEDAL_BG[idx]       : palette.bg;
                    const cardBorder = isTop3 ? MEDAL_BORDER[idx]    : palette.border;
                    const cardGlow   = isTop3 ? `0 0 16px ${palette.glow}, 0 0 0 1px ${MEDAL_BORDER[idx]}` : undefined;

                    return (
                      <div key={entry.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px 12px 12px',
                        borderRadius: 14,
                        border: `1px solid ${isSelf ? '#c66b4d' : cardBorder}`,
                        borderLeft: `3px solid ${palette.color}`,
                        background: cardBg,
                        backdropFilter: 'blur(4px)',
                        marginBottom: 8,
                        ...(isTop3 ? { boxShadow: cardGlow } : {}),
                        ...(isSelf && !isTop3 ? { boxShadow: '0 0 0 2px #c66b4d' } : {}),
                      }}>
                        {/* Posição */}
                        <div style={{ width: 32, textAlign: 'center', flexShrink: 0 }}>
                          {isTop3
                            ? <span style={{ fontSize: 20 }}>{MEDAL[idx]}</span>
                            : <span style={{ color: '#9b8a7f', fontSize: 14, fontWeight: 700 }}>#{idx + 1}</span>}
                        </div>

                        {avatar(entry.nome, entry.foto_url)}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#2d2521', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.nome}
                            {isSelf && <span style={{ color: '#3f8f5b', fontSize: 11 }}> (você)</span>}
                          </div>
                          {/* Stats como pills */}
                          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                            {[
                              { label: 'J', val: entry.jogos },
                              { label: 'V', val: entry.vitorias },
                              { label: 'D', val: entry.derrotas },
                            ].map(stat => (
                              <span key={stat.label} style={{ background: '#f7eee7', borderRadius: 6, padding: '2px 7px', fontSize: 11, color: '#6f625b', fontWeight: 700 }}>
                                {stat.label} {stat.val}
                              </span>
                            ))}
                          </div>
                          {/* Barra de aproveitamento */}
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 80, height: 3, borderRadius: 2, background: '#f4ebe3', overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ width: `${aprov}%`, height: '100%', background: palette.color, borderRadius: 2, transition: 'width .3s' }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#9b8a7f' }}>{aprov}%</span>
                          </div>
                        </div>

                        {/* Pontos — badge colorido */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: palette.color, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{entry.total_pontos}</div>
                          <div style={{ color: '#9b8a7f', fontSize: 10, fontWeight: 600, marginTop: 2 }}>pts</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // ─── Tab: Partidas ─────────────────────────────────────────────────────────
  const renderPartidas = () => {
    const fp  = formPartida;
    const nSets = fp.tipo_partida === 'pro_set' ? 1 : 2;
    const need3 = fp.tipo_partida !== 'pro_set' && !fp.wo;
    const s1A  = Number(fp.sets[0].setA || 0), s1B = Number(fp.sets[0].setB || 0);
    const s2A  = Number(fp.sets[1].setA || 0), s2B = Number(fp.sets[1].setB || 0);
    const tied = s1A > s1B && s2A < s2B || s1A < s1B && s2A > s2B;
    const show3 = need3 && tied;

    return (
      <div>
        {renderLigaSelect()}

        {/* ── Confirmações pendentes ── */}
        {pendentes.length > 0 && (
          <>
            <div style={s.sectionTitle}>📬 Aguardando sua confirmação</div>
            {pendentes.map(pt => {
              const euSouA = pt.jogador_a_id === userId;
              const vencedor = pt.vencedor_id === pt.jogador_a_id ? pt.jogador_a_nome : pt.jogador_b_nome;
              return (
                <div key={pt.id} style={{ ...s.partidaCard, border: '1px solid rgba(255,167,38,.4)', background: 'rgba(255,167,38,.04)', marginBottom: 10 }}>
                  <div style={s.partidaHeader}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      {euSouA ? pt.jogador_b_nome : pt.jogador_a_nome} enviou um resultado
                    </span>
                    <span style={{ ...s.statusPill, background: 'rgba(255,167,38,.15)', color: '#ffa726', border: '1px solid #ffa726' }}>
                      Confirmar
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6f625b', marginBottom: 8, lineHeight: 1.5 }}>
                    Vencedor: <strong style={{ color: '#3f8f5b' }}>{vencedor}</strong>
                  </div>
                  {pt.placar && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {pt.placar.map((set, i) => (
                        <span key={i} style={{ background: '#f4ebe3', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 800 }}>
                          {set.setA}–{set.setB}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#94857a', marginBottom: 10 }}>
                    {pt.jogador_a_nome}: <strong style={{ color: '#b98718' }}>{pt.pontos_a + pt.bonus_a} pts</strong>
                    &nbsp;·&nbsp;
                    {pt.jogador_b_nome}: <strong style={{ color: '#b98718' }}>{pt.pontos_b + pt.bonus_b} pts</strong>
                  </div>
                  <div style={s.confirmBtns}>
                    <button style={s.okBtn} onClick={() => confirmarPartida(pt.id, true)}>✓ Confirmar resultado</button>
                    <button style={s.disputeBtn} onClick={() => confirmarPartida(pt.id, false)}>✕ Contestar</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Resultados que eu enviei aguardando o outro */}
        {partidas.filter(pt => pt.status === 'pendente' && (pt.jogador_a_id === userId || pt.jogador_b_id === userId)).map(pt => {
          const euSouA = pt.jogador_a_id === userId;
          const jaConfirmei = euSouA ? pt.confirmado_a : pt.confirmado_b;
          if (!jaConfirmei) return null; // já está em pendentes acima
          return (
            <div key={pt.id} style={{ ...s.partidaCard, border: '1px solid rgba(79,195,247,.25)', background: 'rgba(79,195,247,.04)', marginBottom: 10 }}>
              <div style={s.partidaHeader}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>📤 Resultado enviado</span>
                <span style={{ ...s.statusPill, background: 'rgba(79,195,247,.15)', color: '#c66b4d', border: '1px solid #c66b4d' }}>⏳ Aguardando</span>
              </div>
              <div style={{ fontSize: 12, color: '#8d7b70', lineHeight: 1.5 }}>
                {pt.jogador_a_nome} vs {pt.jogador_b_nome}<br/>
                Aguardando confirmação de <strong>{euSouA ? pt.jogador_b_nome : pt.jogador_a_nome}</strong>.<br/>
                <span style={{ fontSize: 11, color: '#b5a69d' }}>Após 48h sem contestação é aceito automaticamente.</span>
              </div>
            </div>
          );
        })}

        {!temporadaId ? <div style={s.empty}>Selecione uma temporada.</div> : (
          <>
            <div style={s.formCard}>
              <div style={s.formTitle}>Registrar Partida</div>

              <div style={s.formRow}>
                <div style={s.formGroup}>
                  <label style={s.label}>Jogador A</label>
                  <select style={s.sel} value={fp.jogador_a_id} onChange={e => setFormPartida(f => ({ ...f, jogador_a_id: Number(e.target.value) }))}>
                    <option value={0}>Selecionar…</option>
                    {membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Jogador B</label>
                  <select style={s.sel} value={fp.jogador_b_id} onChange={e => setFormPartida(f => ({ ...f, jogador_b_id: Number(e.target.value) }))}>
                    <option value={0}>Selecionar…</option>
                    {membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
                  </select>
                </div>
              </div>

              <div style={s.formRow}>
                <div style={s.formGroup}>
                  <label style={s.label}>Tipo</label>
                  <select style={s.sel} value={fp.tipo_partida} onChange={e => setFormPartida(f => ({ ...f, tipo_partida: e.target.value }))}>
                    {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Data</label>
                  <input style={s.inp} type="date" value={fp.data_partida} onChange={e => setFormPartida(f => ({ ...f, data_partida: e.target.value }))} />
                </div>
              </div>

              <div style={s.woRow}>
                <label style={s.woLabel}>
                  <input type="checkbox" checked={fp.wo} onChange={e => setFormPartida(f => ({ ...f, wo: e.target.checked }))} style={{ marginRight: 8 }} />
                  WO (W.O. — adversário não compareceu)
                </label>
              </div>

              {!fp.wo && (
                <>
                  {Array.from({ length: fp.tipo_partida === 'pro_set' ? 1 : (show3 ? 3 : nSets) }).map((_, i) => (
                    <div key={i} style={s.setRow}>
                      <span style={s.setLabel}>{fp.tipo_partida === 'pro_set' ? 'Placar' : `Set ${i + 1}`}</span>
                      <input style={s.setInp} type="number" min={0} max={99} placeholder="A"
                        value={fp.sets[i].setA}
                        onChange={e => setFormPartida(f => { const ns = [...f.sets]; ns[i] = { ...ns[i], setA: e.target.value }; return { ...f, sets: ns }; })} />
                      <span style={{ color: '#94857a' }}>×</span>
                      <input style={s.setInp} type="number" min={0} max={99} placeholder="B"
                        value={fp.sets[i].setB}
                        onChange={e => setFormPartida(f => { const ns = [...f.sets]; ns[i] = { ...ns[i], setB: e.target.value }; return { ...f, sets: ns }; })} />
                    </div>
                  ))}
                </>
              )}

              {fp.wo && (
                <div style={s.formGroup}>
                  <label style={s.label}>Vencedor do WO</label>
                  <select style={s.sel} value={fp.wo_vencedor_id} onChange={e => setFormPartida(f => ({ ...f, wo_vencedor_id: Number(e.target.value) }))}>
                    <option value={0}>Selecionar…</option>
                    {[fp.jogador_a_id, fp.jogador_b_id].filter(Boolean).map(uid => {
                      const m = membros.find(mb => mb.user_id === uid);
                      return m ? <option key={uid} value={uid}>{m.nome}</option> : null;
                    })}
                  </select>
                </div>
              )}

              <button style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }} onClick={registrarPartida} disabled={loading}>
                {loading ? 'Registrando…' : 'Registrar Partida'}
              </button>
            </div>

            <div style={s.sectionTitle}>Partidas Recentes</div>

            {partidas.length === 0 && <div style={s.empty}>Nenhuma partida registrada.</div>}

            {partidas.map(pt => {
              const isPending  = pt.status === 'pendente';
              const isEnvolved = pt.jogador_a_id === userId || pt.jogador_b_id === userId;
              const isVencedor = pt.vencedor_id === userId;
              return (
                <div key={pt.id} style={s.partidaCard}>
                  <div style={s.partidaHeader}>
                    <span style={s.partidaDate}>{pt.data_partida?.slice(0, 10)}</span>
                    <span style={{ ...s.statusPill, background: pt.status === 'confirmada' ? 'rgba(76,175,80,0.15)' : pt.status === 'disputada_admin' ? 'rgba(244,67,54,0.15)' : 'rgba(255,167,38,0.15)', color: pt.status === 'confirmada' ? '#3f8f5b' : pt.status === 'disputada_admin' ? '#f44336' : '#ffa726', border: `1px solid ${pt.status === 'confirmada' ? '#3f8f5b' : pt.status === 'disputada_admin' ? '#f44336' : '#ffa726'}` }}>
                      {pt.status === 'confirmada' ? 'Confirmada' : pt.status === 'disputada_admin' ? 'Em disputa' : 'Pendente'}
                    </span>
                  </div>
                  <div style={s.partidaVs}>
                    <span style={{ color: pt.vencedor_id === pt.jogador_a_id ? '#3f8f5b' : '#3d332e', fontWeight: pt.vencedor_id === pt.jogador_a_id ? 800 : 500 }}>{pt.jogador_a_nome}</span>
                    <span style={s.vs}>vs</span>
                    <span style={{ color: pt.vencedor_id === pt.jogador_b_id ? '#3f8f5b' : '#3d332e', fontWeight: pt.vencedor_id === pt.jogador_b_id ? 800 : 500 }}>{pt.jogador_b_nome}</span>
                  </div>
                  {pt.placar && (
                    <div style={s.placarRow}>
                      {pt.placar.map((set, i) => (
                        <span key={i} style={s.placarSet}>{set.setA}–{set.setB}</span>
                      ))}
                    </div>
                  )}
                  {pt.wo && <div style={s.woTag}>W.O.</div>}
                  <div style={s.ptsRow}>
                    <span style={s.ptsTag}>{pt.jogador_a_nome}: {pt.pontos_a + pt.bonus_a} pts{pt.bonus_a > 0 ? ` (+${pt.bonus_a})` : ''}</span>
                    <span style={s.ptsTag}>{pt.jogador_b_nome}: {pt.pontos_b + pt.bonus_b} pts{pt.bonus_b > 0 ? ` (+${pt.bonus_b})` : ''}</span>
                  </div>
                  {isPending && isEnvolved && !isVencedor && (
                    <div style={s.confirmBtns}>
                      <button style={s.okBtn} onClick={() => confirmarPartida(pt.id, true)}>Confirmar resultado</button>
                      <button style={s.disputeBtn} onClick={() => confirmarPartida(pt.id, false)}>Disputar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // ─── Tab: Desafios ─────────────────────────────────────────────────────────
  const renderDesafios = () => (
    <div>
      {renderLigaSelect()}
      <button style={s.addBtn} onClick={() => setShowDesafioForm(v => !v)}>
        {showDesafioForm ? '– Fechar' : '+ Desafiar alguém'}
      </button>

      {showDesafioForm && (
        <div style={s.formCard}>
          <div style={s.formTitle}>Novo Desafio</div>
          <div style={s.formGroup}>
            <label style={s.label}>Adversário</label>
            <select style={s.sel} value={formDesafio.desafiado_id} onChange={e => setFormDesafio(f => ({ ...f, desafiado_id: Number(e.target.value) }))}>
              <option value={0}>Selecionar…</option>
              {membros.filter(m => m.user_id !== userId).map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
            </select>
          </div>
          <div style={s.formRow}>
            <div style={s.formGroup}>
              <label style={s.label}>Data</label>
              <input style={s.inp} type="date" value={formDesafio.data_sugerida} onChange={e => setFormDesafio(f => ({ ...f, data_sugerida: e.target.value }))} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Horário</label>
              <input style={s.inp} type="time" value={formDesafio.horario_sugerido} onChange={e => setFormDesafio(f => ({ ...f, horario_sugerido: e.target.value }))} />
            </div>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Local</label>
            <input style={s.inp} placeholder="Ex: Quadra 1 — ACTO" value={formDesafio.local_sugerido} onChange={e => setFormDesafio(f => ({ ...f, local_sugerido: e.target.value }))} />
          </div>
          <button style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }} onClick={criarDesafio} disabled={loading}>
            Enviar Desafio
          </button>
        </div>
      )}

      <div style={s.sectionTitle}>Seus Desafios</div>
      {desafios.length === 0 && <div style={s.empty}>Nenhum desafio ativo.</div>}

      {desafios.map(d => {
        const recebido = d.desafiado_id === userId;
        const pending  = d.status === 'pendente' || d.status === 'contraproposto';
        return (
          <div key={d.id} style={s.desafioCard}>
            <div style={s.desafioHeader}>
              <span style={s.desafioNome}>{recebido ? `De: ${d.desafiante_nome}` : `Para: ${d.desafiado_nome}`}</span>
              <span style={{ ...s.statusPill, background: d.status === 'aceito' ? 'rgba(76,175,80,0.15)' : d.status === 'recusado' ? 'rgba(244,67,54,0.15)' : 'rgba(255,167,38,0.15)', color: d.status === 'aceito' ? '#3f8f5b' : d.status === 'recusado' ? '#f44336' : '#ffa726', border: `1px solid ${d.status === 'aceito' ? '#3f8f5b' : d.status === 'recusado' ? '#f44336' : '#ffa726'}` }}>
                {d.status}
              </span>
            </div>
            <div style={s.desafioInfo}>{d.data_sugerida} · {d.horario_sugerido} · {d.local_sugerido}</div>
            {d.contra_data && (
              <div style={{ ...s.desafioInfo, color: '#ffa726' }}>Contraproposta: {d.contra_data} · {d.contra_horario} · {d.contra_local}</div>
            )}
            {recebido && pending && (
              <div style={s.confirmBtns}>
                <button style={s.okBtn}      onClick={() => responderDesafio(d.id, 'aceito')}>Aceitar</button>
                <button style={s.disputeBtn} onClick={() => responderDesafio(d.id, 'recusado')}>Recusar</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Tab: Config (admin only) ─────────────────────────────────────────────
  const renderConfig = () => (
    <div>
      {isAdmin && (
        <div style={s.formCard}>
          <div style={s.formTitle}>Criar Liga</div>
          <div style={s.formGroup}>
            <label style={s.label}>Nome da Liga</label>
            <input style={s.inp} placeholder="Ex: Liga ACTO 2026" value={novaLiga} onChange={e => setNovaLiga(e.target.value)} />
          </div>
          <button style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }} onClick={criarLiga} disabled={loading}>
            {loading ? 'Criando…' : 'Criar Liga'}
          </button>
        </div>
      )}

      {isAdmin && (
        <>
          {renderLigaSelect()}

          <div style={s.formCard}>
            <div style={s.formTitle}>Nova Temporada</div>
            <div style={s.formGroup}>
              <label style={s.label}>Nome</label>
              <input style={s.inp} placeholder="Ex: Temporada 1 — 2026" value={formTemp.nome} onChange={e => setFormTemp(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div style={s.formRow}>
              <div style={s.formGroup}>
                <label style={s.label}>Início</label>
                <input style={s.inp} type="date" value={formTemp.data_inicio} onChange={e => setFormTemp(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Fim</label>
                <input style={s.inp} type="date" value={formTemp.data_fim} onChange={e => setFormTemp(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
            <button style={s.submitBtn} onClick={criarTemporada} disabled={loading}>Criar Temporada</button>
          </div>

          <div style={s.sectionTitle}>Temporadas</div>
          {temporadas.map(t => (
            <div key={t.id} style={s.tempCard}>
              <div>
                <div style={s.tempNome}>{t.nome}</div>
                <div style={s.tempDatas}>{t.data_inicio?.slice(0, 10)} → {t.data_fim?.slice(0, 10)} · {t.total_partidas} partidas</div>
              </div>
              {t.ativa
                ? <button style={s.encerrarBtn} onClick={() => encerrarTemporada(t.id)}>Encerrar</button>
                : <span style={s.encerradaTag}>Encerrada</span>}
            </div>
          ))}

          <div style={s.sectionTitle}>Membros</div>
          <div style={s.formCard}>
            <div style={s.formRow}>
              <div style={s.formGroup}>
                <label style={s.label}>E-mail</label>
                <input style={s.inp} placeholder="aluno@exemplo.com" value={formMembro.email} onChange={e => setFormMembro(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div style={{ ...s.formGroup, flex: 0.7 }}>
                <label style={s.label}>Classe</label>
                <select style={s.sel} value={formMembro.classe} onChange={e => setFormMembro(f => ({ ...f, classe: e.target.value }))}>
                  {CLASSES.map(c => <option key={c} value={c}>{CLASSE_LABELS[c]}</option>)}
                </select>
              </div>
            </div>
            <button style={s.submitBtn} onClick={adicionarMembro} disabled={loading}>Adicionar Membro</button>
          </div>

          {membros.map(m => (
            <div key={m.user_id} style={s.membroCard}>
              {avatar(m.nome, m.foto_url, 32)}
              <div style={s.membroInfo}>
                <div style={s.membroNome}>{m.nome}</div>
                <div style={s.membroEmail}>{m.email}</div>
              </div>
              <select style={s.classeSelect} value={m.classe} onChange={e => alterarClasse(m.user_id, e.target.value)}>
                {CLASSES.map(c => <option key={c} value={c}>{CLASSE_LABELS[c]}</option>)}
              </select>
              <button style={s.removeBtn} onClick={() => removerMembro(m.user_id)}>✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string }[] = [
    { key: 'ranking',  label: '🏅 Ranking'  },
    { key: 'rodada',   label: '⚔️ Rodada'   },
    { key: 'partidas', label: '🎯 Resultado' },
    { key: 'desafios', label: '🤝 Desafio'  },
    { key: 'config',   label: isAdmin ? '⚙️ Config' : '⚙️ Ligas' },
  ];

  // Subtítulo do header: liga + temporada
  const temporadaAtual = temporadas.find(t => t.id === temporadaId);
  const headerSubtitle = ligaAtual
    ? temporadaAtual
      ? `${ligaAtual.nome} · ${temporadaAtual.nome}`
      : ligaAtual.nome
    : null;

  return (
    <div style={s.page}>
      {/* Background glows */}
      <div style={s.bgGlow} />
      <div style={s.bgGlow2} />

      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹ Voltar</button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={s.title}>🏆 Ranking</h2>
          {headerSubtitle && (
            <div style={s.headerSubtitle}>{headerSubtitle}</div>
          )}
        </div>
        <div style={{ width: 64 }} />
      </div>

      {msg && (
        <div style={{ ...s.toast, background: msg.type === 'ok' ? 'rgba(46,125,50,0.95)' : 'rgba(198,40,40,0.95)' }}>
          {msg.text}
        </div>
      )}

      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {loading && ligas.length === 0 && <div style={s.empty}>Carregando…</div>}
        {!loading && ligas.length === 0 && (
          <div style={s.emptyBig}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎾</div>
            <div style={s.emptyBigText}>
              {isAdmin
                ? 'Crie sua primeira liga na aba "Config".'
                : 'Peça ao seu professor para te adicionar a uma liga.'}
            </div>
            {isAdmin && <button style={s.submitBtn} onClick={() => setTab('config')}>Criar Liga</button>}
          </div>
        )}

        {ligas.length > 0 && (
          tab === 'ranking'  ? renderRanking()  :
          tab === 'rodada'   ? renderRodada()   :
          tab === 'partidas' ? renderPartidas() :
          tab === 'desafios' ? renderDesafios() :
          renderConfig()
        )}
      </div>
    </div>
  );
}

// =============================================================================

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'fixed',
    inset: 0,
    background: '#fbf7f1',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: '#2d2521',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  bgGlow: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(191,102,72,0.16) 0%, transparent 68%)',
    pointerEvents: 'none',
  },

  bgGlow2: {
    position: 'absolute',
    bottom: -130,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(116,80,58,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  header: {
    display: 'grid',
    gridTemplateColumns: '76px 1fr 76px',
    alignItems: 'center',
    gap: 10,
    padding: 'max(16px,env(safe-area-inset-top,16px)) 16px 12px',
    background: '#fbf7f1',
    position: 'relative',
    zIndex: 10,
    flexShrink: 0,
  },

  backBtn: {
    background: '#f3e8de',
    border: 'none',
    color: '#7a5142',
    padding: '10px 12px',
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 850,
    cursor: 'pointer',
    minWidth: 64,
  },

  title: {
    color: '#2d2521',
    fontSize: 22,
    fontWeight: 950,
    margin: 0,
    lineHeight: 1.12,
    letterSpacing: -0.7,
  },

  headerSubtitle: {
    color: '#94857a',
    fontSize: 11,
    fontWeight: 650,
    marginTop: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 190,
  },

  toast: {
    position: 'fixed',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '11px 18px',
    borderRadius: 999,
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    zIndex: 100,
    boxShadow: '0 10px 28px rgba(70,45,34,0.22)',
    whiteSpace: 'nowrap',
  },

  tabBar: {
    display: 'flex',
    gap: 7,
    overflowX: 'auto',
    padding: '0 14px 12px',
    background: '#fbf7f1',
    flexShrink: 0,
    position: 'relative',
    zIndex: 8,
  },

  tabBtn: {
    flex: '0 0 auto',
    padding: '10px 13px',
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    color: '#8f7769',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    borderRadius: 999,
    boxShadow: '0 8px 20px rgba(117,76,56,0.05)',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
  },

  tabActive: {
    background: '#c66b4d',
    color: '#fff',
    borderColor: '#c66b4d',
    boxShadow: '0 10px 20px rgba(198,107,77,0.18)',
  },

  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 14px 40px',
    maxWidth: 540,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 2,
  },

  ligaRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 14,
  },

  ligaSelect: {
    flex: 1,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 14,
    color: '#332a25',
    padding: '11px 12px',
    fontSize: 13,
    fontWeight: 750,
    appearance: 'none',
    WebkitAppearance: 'none',
    boxShadow: '0 8px 20px rgba(117,76,56,0.05)',
    colorScheme: 'light',
  },

  filterRow: {
    display: 'flex',
    gap: 7,
    marginBottom: 14,
    flexWrap: 'wrap',
  },

  empty: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    color: '#94857a',
    textAlign: 'center',
    padding: '28px 16px',
    fontSize: 13,
    fontWeight: 750,
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  emptyBig: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '44px 24px',
    gap: 12,
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  emptyBigText: {
    color: '#8d7b70',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 1.6,
    fontWeight: 700,
  },

  formCard: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  formTitle: {
    color: '#b65b43',
    fontSize: 13,
    fontWeight: 950,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  formRow: {
    display: 'flex',
    gap: 10,
  },

  formGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },

  label: {
    color: '#8f7769',
    fontSize: 11,
    fontWeight: 850,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sel: {
    background: '#fffaf7',
    border: '1px solid #eadfd6',
    borderRadius: 14,
    color: '#332a25',
    padding: '12px 12px',
    fontSize: 13,
    fontWeight: 650,
    width: '100%',
    boxSizing: 'border-box',
    colorScheme: 'light',
  },

  inp: {
    background: '#fffaf7',
    border: '1px solid #eadfd6',
    borderRadius: 14,
    color: '#332a25',
    padding: '12px 12px',
    fontSize: 13,
    fontWeight: 650,
    width: '100%',
    boxSizing: 'border-box',
    colorScheme: 'light',
  },

  woRow: {
    display: 'flex',
    alignItems: 'center',
  },

  woLabel: {
    color: '#6f625b',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontWeight: 700,
  },

  setRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  setLabel: {
    color: '#8f7769',
    fontSize: 12,
    fontWeight: 850,
    width: 42,
    flexShrink: 0,
  },

  setInp: {
    width: 58,
    background: '#fffaf7',
    border: '1px solid #eadfd6',
    borderRadius: 12,
    color: '#332a25',
    padding: '9px 0',
    fontSize: 18,
    fontWeight: 850,
    textAlign: 'center',
    boxSizing: 'border-box',
    colorScheme: 'light',
  },

  submitBtn: {
    width: '100%',
    padding: '14px 0',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  addBtn: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 16,
    marginBottom: 12,
    background: '#fff1eb',
    border: '1px dashed rgba(198,107,77,0.35)',
    color: '#a54f3d',
    fontSize: 13,
    fontWeight: 950,
    cursor: 'pointer',
  },

  sectionTitle: {
    color: '#8f7769',
    fontSize: 11,
    fontWeight: 950,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },

  partidaCard: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0 10px 24px rgba(57,37,28,0.06)',
  },

  partidaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },

  partidaDate: {
    color: '#94857a',
    fontSize: 12,
    fontWeight: 700,
  },

  statusPill: {
    fontSize: 11,
    fontWeight: 850,
    padding: '5px 10px',
    borderRadius: 999,
  },

  partidaVs: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    marginBottom: 6,
    flexWrap: 'wrap',
    color: '#3d332e',
  },

  vs: {
    color: '#b5a69d',
    fontSize: 11,
    fontWeight: 900,
  },

  placarRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 4,
  },

  placarSet: {
    background: '#f4ebe3',
    borderRadius: 8,
    padding: '3px 9px',
    fontSize: 12,
    color: '#6f625b',
    fontWeight: 850,
  },

  woTag: {
    display: 'inline-block',
    background: '#fff4e8',
    color: '#b36a2f',
    border: '1px solid rgba(179,106,47,0.22)',
    borderRadius: 999,
    padding: '3px 9px',
    fontSize: 11,
    fontWeight: 850,
    marginBottom: 4,
  },

  ptsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },

  ptsTag: {
    color: '#8f7769',
    fontSize: 11,
    fontWeight: 700,
  },

  confirmBtns: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },

  okBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 13,
    border: 'none',
    background: '#3f8f5b',
    color: '#fff',
    fontSize: 12,
    fontWeight: 850,
    cursor: 'pointer',
  },

  disputeBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 13,
    border: '1px solid rgba(201,84,65,0.22)',
    background: '#fff0ec',
    color: '#c95441',
    fontSize: 12,
    fontWeight: 850,
    cursor: 'pointer',
  },

  desafioCard: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0 10px 24px rgba(57,37,28,0.06)',
  },

  desafioHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },

  desafioNome: {
    color: '#2d2521',
    fontSize: 14,
    fontWeight: 850,
  },

  desafioInfo: {
    color: '#8f7769',
    fontSize: 12,
    marginBottom: 2,
    fontWeight: 650,
  },

  tempCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 18,
    padding: '13px 14px',
    marginBottom: 9,
    gap: 10,
    boxShadow: '0 10px 24px rgba(57,37,28,0.06)',
  },

  tempNome: {
    color: '#2d2521',
    fontSize: 14,
    fontWeight: 850,
  },

  tempDatas: {
    color: '#94857a',
    fontSize: 11,
    marginTop: 2,
    fontWeight: 650,
  },

  encerrarBtn: {
    background: '#fff0ec',
    border: '1px solid rgba(201,84,65,0.22)',
    color: '#c95441',
    borderRadius: 12,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 850,
    cursor: 'pointer',
  },

  encerradaTag: {
    color: '#9b8a7f',
    fontSize: 11,
    fontWeight: 850,
  },

  membroCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 18,
    padding: '11px 12px',
    marginBottom: 8,
    boxShadow: '0 10px 24px rgba(57,37,28,0.06)',
  },

  membroInfo: {
    flex: 1,
    minWidth: 0,
  },

  membroNome: {
    color: '#2d2521',
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  membroEmail: {
    color: '#94857a',
    fontSize: 11,
    fontWeight: 650,
  },

  classeSelect: {
    background: '#fffaf7',
    border: '1px solid #eadfd6',
    borderRadius: 12,
    color: '#332a25',
    padding: '7px 8px',
    fontSize: 11,
    fontWeight: 750,
    flexShrink: 0,
    colorScheme: 'light',
  },

  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: '#fff0ec',
    border: '1px solid rgba(201,84,65,0.16)',
    color: '#c95441',
    fontSize: 15,
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
};
