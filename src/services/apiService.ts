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
  status?:          'aberta' | 'confirmada' | 'encerrada';
  interessados?:    number;
  confirmado_com?:  string | null;
}

export interface InteressadoRecord {
  email_usuario: string;
  nome_usuario:  string;
  created_at:    string;
}

export async function getJogos(cidade?: string): Promise<JogoRecord[]> {
  const qs  = cidade ? `?cidade=${encodeURIComponent(cidade)}` : '';
  const res = await fetch(`${BASE_URL}/jogos${qs}`);
  if (!res.ok) throw new Error(`Erro ao carregar mural: ${res.status}`);
  return res.json();
}

export async function postJogo(jogo: JogoRecord): Promise<JogoRecord> {
  const res = await fetch(`${BASE_URL}/jogos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jogo) });
  if (!res.ok) throw new Error(`Erro ao publicar: ${res.status}`);
  return res.json();
}

export async function deleteJogo(id: string, emailPublicador: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jogos/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailPublicador }) });
  if (!res.ok) throw new Error(`Erro ao remover: ${res.status}`);
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
  await fetch(`${BASE_URL}/jogos/${jogoId}/confirmar`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_publicador, confirmado_com }) });
}

export async function encerrarSala(jogoId: string, email_publicador: string): Promise<void> {
  await fetch(`${BASE_URL}/jogos/${jogoId}/encerrar`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_publicador }) });
}

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
