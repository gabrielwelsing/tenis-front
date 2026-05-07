// =============================================================================
// API SERVICE — Comunicação com o tenis-back
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface UserRecord {
  id:         number;
  nome:       string;
  email:      string;
  role:       'user' | 'aluno' | 'admin';
  foto_url:   string | null;
  localidade: string | null;
  telefone:   string | null;
}

export interface AuthResponse {
  token: string;
  user:  UserRecord;
}

export async function register(nome: string, email: string, password: string, localidade?: string, telefone?: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, password, localidade, telefone }) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Erro ao cadastrar.'); }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Erro ao fazer login.'); }
  return res.json();
}

export async function loginGoogle(credential: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Erro ao autenticar com Google.'); }
  return res.json();
}

export async function getMe(token: string): Promise<UserRecord> {
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Sessão inválida.');
  const data = await res.json();
  return data.user;
}

export async function updateProfile(token: string, data: { nome?: string; localidade?: string; telefone?: string; foto_url?: string }): Promise<UserRecord> {
  const res = await fetch(`${BASE_URL}/auth/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Erro ao atualizar perfil.');
  const result = await res.json();
  return result.user;
}

// ---------------------------------------------------------------------------
// Gabarito biomecânico
// ---------------------------------------------------------------------------

export type NivelAluno = 'iniciante' | 'intermediario' | 'avancado';

export const NIVEL_LABELS: Record<NivelAluno, string> = {
  iniciante:     'Iniciante',
  intermediario: 'Intermediário',
  avancado:      'Avançado',
};

export interface JointMeta { label: string; ideal: number; tolerancia: number; peso: number; }
export interface NivelConfig { metas: { elbow: JointMeta; knee: JointMeta; hip: JointMeta; }; }
export interface GabaritoEntry { label: string; grupo: string; fase: string; imageUrl: string; imageCredit: string; niveis: Record<NivelAluno, NivelConfig>; }

export async function fetchGabarito(): Promise<Record<string, GabaritoEntry>> {
  const res = await fetch(`${BASE_URL}/gabarito`);
  if (!res.ok) throw new Error(`Erro ao carregar gabarito: ${res.status}`);
  return res.json() as Promise<Record<string, GabaritoEntry>>;
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export interface ClipRecord {
  id: string; timestamp: string; videoDurationMs: number; audioDurationMs: number | null;
  driveVideoUrl: string; driveAudioUrl: string | null; syncStatus: string; createdAt: string;
}

export async function saveVideo(params: { id: string; timestamp: number; videoDurationMs: number; driveVideoUrl: string }): Promise<void> {
  const res = await fetch(`${BASE_URL}/clips`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...params, driveAudioUrl: null, audioDurationMs: null }) });
  if (!res.ok) throw new Error(`Erro ao salvar vídeo: ${res.status}`);
}

export async function saveAudio(params: { timestamp: number; audioDurationMs: number; driveAudioUrl: string; videoId?: string }): Promise<void> {
  const res = await fetch(`${BASE_URL}/clips/audio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  if (!res.ok) throw new Error(`Erro ao salvar áudio: ${res.status}`);
}

export async function getClips(): Promise<ClipRecord[]> {
  const res = await fetch(`${BASE_URL}/clips`);
  if (!res.ok) throw new Error(`Erro ao carregar clips: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Mural de Treinos
// ---------------------------------------------------------------------------

export interface JogoRecord {
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

export interface ProximaAtividadeRecord extends JogoRecord {
  adversarioNome:  string;
  adversarioEmail: string | null;
}

export interface ProximaAulaAgendaRecord {
  tipo:            'aula';
  id:              number;
  dataInicio:      string;
  dataFim?:        string | null;
  horarioInicio:   string;
  horarioFim:      string;
  local:           string;
  status:          'confirmada';
  alunoNome?:      string | null;
  alunoEmail?:     string | null;
  adversarioNome?: string | null;
  adversarioEmail?: string | null;
}

export type ProximaAtividadeCompletaRecord =
  | (ProximaAtividadeRecord & { tipo: 'jogo' })
  | ProximaAulaAgendaRecord;

export interface InteressadoRecord {
  email_usuario: string;
  nome_usuario:  string;
  created_at:    string;
}

export interface UpdateJogoDatasPayload {
  dataInicio:    string;
  dataFim?:      string | null;
  horarioInicio: string;
  horarioFim:    string;
}

export async function getJogos(cidade?: string): Promise<JogoRecord[]> {
  const qs  = cidade ? `?cidade=${encodeURIComponent(cidade)}` : '';
  const res = await fetch(`${BASE_URL}/jogos${qs}`);
  if (!res.ok) throw new Error(`Erro ao carregar mural: ${res.status}`);
  return res.json();
}

export async function getProximaAtividade(emailUsuario: string): Promise<ProximaAtividadeRecord | null> {
  const res = await fetch(`${BASE_URL}/jogos/proxima?email=${encodeURIComponent(emailUsuario)}`);
  if (!res.ok) throw new Error(`Erro ao carregar próxima atividade: ${res.status}`);
  return res.json();
}

export async function getProximaAulaAgenda(
  emailUsuario: string,
  role: UserRecord['role']
): Promise<ProximaAulaAgendaRecord | null> {
  const qs = new URLSearchParams({
    email: emailUsuario,
    role,
  });

  const res = await fetch(`${BASE_URL}/agenda/proxima?${qs.toString()}`);
  if (!res.ok) throw new Error(`Erro ao carregar próxima aula: ${res.status}`);
  return res.json();
}

function dataHoraAtividadeMs(a: { dataInicio: string; horarioInicio: string }): number {
  const data = String(a.dataInicio).slice(0, 10);
  const hora = String(a.horarioInicio || '00:00').slice(0, 5);
  return new Date(`${data}T${hora}:00`).getTime();
}

export async function getProximaAtividadeCompleta(
  emailUsuario: string,
  role: UserRecord['role']
): Promise<ProximaAtividadeCompletaRecord | null> {
  const aulaPromise = getProximaAulaAgenda(emailUsuario, role);

  if (role === 'admin') {
    return aulaPromise;
  }

  const [jogoResult, aulaResult] = await Promise.allSettled([
    getProximaAtividade(emailUsuario),
    aulaPromise,
  ]);

  const jogo = jogoResult.status === 'fulfilled' && jogoResult.value
    ? { ...jogoResult.value, tipo: 'jogo' as const }
    : null;

  const aula = aulaResult.status === 'fulfilled' ? aulaResult.value : null;

  if (jogo && aula) {
    return dataHoraAtividadeMs(jogo) <= dataHoraAtividadeMs(aula) ? jogo : aula;
  }

  return jogo ?? aula ?? null;
}

export async function postJogo(jogo: JogoRecord): Promise<JogoRecord> {
  const res = await fetch(`${BASE_URL}/jogos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jogo) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erro ao publicar: ${res.status}`);
  }
  return res.json();
}

export async function updateJogoDatas(
  id: string,
  emailPublicador: string,
  dados: UpdateJogoDatasPayload
): Promise<JogoRecord> {
  const res = await fetch(`${BASE_URL}/jogos/${id}/datas`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailPublicador,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim ?? null,
      horarioInicio: dados.horarioInicio,
      horarioFim: dados.horarioFim,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erro ao editar publicação: ${res.status}`);
  }

  return res.json();
}

export async function deleteJogo(id: string, emailPublicador: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jogos/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailPublicador }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erro ao remover: ${res.status}`);
  }
}

export async function registrarInteresse(jogoId: string, email_usuario: string, nome_usuario: string): Promise<{ interessados: number }> {
  const res = await fetch(`${BASE_URL}/jogos/${jogoId}/interessado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_usuario, nome_usuario }) });
  if (!res.ok) throw new Error('Erro ao registrar interesse.');
  return res.json();
}

export async function getInteressados(jogoId: string, email_publicador: string): Promise<InteressadoRecord[]> {
  const res = await fetch(`${BASE_URL}/jogos/${jogoId}/interessados?email_publicador=${encodeURIComponent(email_publicador)}`);
  if (!res.ok) throw new Error('Erro ao buscar interessados.');
  return res.json();
}

export async function confirmarSala(jogoId: string, email_publicador: string, confirmado_com: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jogos/${jogoId}/confirmar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_publicador, confirmado_com }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao confirmar partida.');
  }
}

export async function encerrarSala(jogoId: string, email_publicador: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jogos/${jogoId}/encerrar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_publicador }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao encerrar partida.');
  }
}

// ---------------------------------------------------------------------------
// Prioridades da Home
// ---------------------------------------------------------------------------

export interface ResultadoPendenteRecord {
  id: string;
  temporada_id: string;
  jogador_a_id: number;
  jogador_b_id: number;
  jogador_a_nome: string;
  jogador_b_nome: string;
  jogador_a_foto?: string | null;
  jogador_b_foto?: string | null;
  vencedor_id?: number | null;
  vencedor_nome?: string | null;
  placar?: unknown;
  tipo_partida?: string;
  data_partida?: string;
  status: string;
}

export interface DesafioPendenteRecord {
  id: string;
  liga_id: string;
  desafiante_id: number;
  desafiado_id: number;
  desafiante_nome: string;
  desafiado_nome: string;
  desafiante_foto?: string | null;
  desafiado_foto?: string | null;
  data_sugerida: string;
  horario_sugerido: string;
  local_sugerido: string;
  status: string;
  created_at?: string;
}

export type HomePrioridadeRecord =
  | { tipo: 'desafio'; desafio: DesafioPendenteRecord }
  | { tipo: 'resultado'; resultado: ResultadoPendenteRecord }
  | null;

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

async function rankingApi(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Erro.');
  return json.data;
}

export const getMinhasLigas          = (t: string)                                                => rankingApi(t, 'GET',    '/ranking/ligas');
export const criarLiga               = (t: string, nome: string)                                  => rankingApi(t, 'POST',   '/ranking/ligas', { nome });
export const getMembros              = (t: string, ligaId: string)                                 => rankingApi(t, 'GET',    `/ranking/ligas/${ligaId}/membros`);
export const adicionarMembro         = (t: string, ligaId: string, email: string, classe: string) => rankingApi(t, 'POST',   `/ranking/ligas/${ligaId}/membros`, { email, classe });
export const removerMembro           = (t: string, ligaId: string, userId: number)                 => rankingApi(t, 'DELETE', `/ranking/ligas/${ligaId}/membros/${userId}`, {});
export const alterarClasseMembro     = (t: string, ligaId: string, userId: number, classe: string) => rankingApi(t, 'PATCH',  `/ranking/ligas/${ligaId}/membros/${userId}`, { classe });
export const criarTemporada          = (t: string, ligaId: string, dados: object)                  => rankingApi(t, 'POST',   `/ranking/ligas/${ligaId}/temporadas`, dados);
export const getTemporadas           = (t: string, ligaId: string)                                 => rankingApi(t, 'GET',    `/ranking/ligas/${ligaId}/temporadas`);
export const encerrarTemporada       = (t: string, ligaId: string, tempId: string)                 => rankingApi(t, 'PATCH',  `/ranking/ligas/${ligaId}/temporadas/${tempId}`, {});
export const registrarPartida        = (t: string, dados: object)                                  => rankingApi(t, 'POST',   '/ranking/partidas', dados);
export const getPartidas             = (t: string, temporadaId: string)                            => rankingApi(t, 'GET',    `/ranking/temporadas/${temporadaId}/partidas`);
export const confirmarPartida        = (t: string, partidaId: string, confirmar: boolean)          => rankingApi(t, 'PATCH',  `/ranking/partidas/${partidaId}/confirmar`, { confirmar });
export const getTabelaRanking        = (t: string, temporadaId: string, classe?: string)           => rankingApi(t, 'GET',    `/ranking/temporadas/${temporadaId}/tabela${classe ? `?classe=${classe}` : ''}`);
export const criarDesafio            = (t: string, dados: object)                                  => rankingApi(t, 'POST',   '/ranking/desafios', dados);
export const getDesafios             = (t: string, ligaId: string)                                 => rankingApi(t, 'GET',    `/ranking/desafios?ligaId=${ligaId}`);
export const responderDesafio        = (t: string, desafioId: string, dados: object)               => rankingApi(t, 'PATCH',  `/ranking/desafios/${desafioId}`, dados);
export const converterDesafioPartida = (t: string, desafioId: string, dados: object)               => rankingApi(t, 'POST',   `/ranking/desafios/${desafioId}/partida`, dados);

export async function getResultadoPendente(token: string): Promise<ResultadoPendenteRecord | null> {
  const data = await rankingApi(token, 'GET', '/ranking/partidas/pendentes');
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

export async function getDesafioPendente(token: string): Promise<DesafioPendenteRecord | null> {
  const data = await rankingApi(token, 'GET', '/ranking/desafios/pendentes');
  return data ?? null;
}

export async function getPrioridadeHome(token: string): Promise<HomePrioridadeRecord> {
  if (!token) return null;

  const desafio = await getDesafioPendente(token).catch(() => null);
  if (desafio) return { tipo: 'desafio', desafio };

  const resultado = await getResultadoPendente(token).catch(() => null);
  if (resultado) return { tipo: 'resultado', resultado };

  return null;
}

export async function responderDesafioPendente(
  token: string,
  desafioId: string,
  aceitar: boolean
): Promise<void> {
  await responderDesafio(token, desafioId, { status: aceitar ? 'aceito' : 'recusado' });
}

export async function responderResultadoPendente(
  token: string,
  partidaId: string,
  confirmar: boolean
): Promise<void> {
  await confirmarPartida(token, partidaId, confirmar);
}

