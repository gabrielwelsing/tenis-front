// =============================================================================
// API SERVICE — Comunicação com o tenis-back
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';

// ---------------------------------------------------------------------------
// Cidades — IBGE
// ---------------------------------------------------------------------------

export interface CidadeIBGE {
  id: number;
  nome: string;
  uf: string;
  label: string;
}

const IBGE_MUNICIPIOS_CACHE_KEY = 'tenis_ibge_municipios_v1';

function normalizarTextoCidade(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function cidadeEstaPadronizada(valor?: string | null): boolean {
  return /^[A-Za-zÀ-ÿ0-9 .'-]+ - [A-Z]{2}$/.test(String(valor || '').trim());
}

function extrairUFMunicipio(m: any): string {
  return String(
    m?.microrregiao?.mesorregiao?.UF?.sigla ??
    m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ??
    ''
  ).toUpperCase();
}

async function carregarMunicipiosIBGE(): Promise<CidadeIBGE[]> {
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(IBGE_MUNICIPIOS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CidadeIBGE[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        localStorage.removeItem(IBGE_MUNICIPIOS_CACHE_KEY);
      }
    }
  }

  const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
  if (!res.ok) throw new Error('Erro ao buscar cidades no IBGE.');

  const raw = await res.json();

  const cidades: CidadeIBGE[] = (Array.isArray(raw) ? raw : [])
    .map((m: any) => {
      const nome = String(m?.nome ?? '').trim();
      const uf = extrairUFMunicipio(m);
      return {
        id: Number(m?.id),
        nome,
        uf,
        label: nome && uf ? `${nome} - ${uf}` : '',
      };
    })
    .filter((c: CidadeIBGE) => Number.isFinite(c.id) && c.nome && c.uf && c.label)
    .sort((a: CidadeIBGE, b: CidadeIBGE) => a.label.localeCompare(b.label, 'pt-BR'));

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(IBGE_MUNICIPIOS_CACHE_KEY, JSON.stringify(cidades));
  }

  return cidades;
}

export async function buscarCidadesIBGE(termo: string, limite = 8): Promise<CidadeIBGE[]> {
  const busca = normalizarTextoCidade(termo);
  if (busca.length < 2) return [];

  const cidades = await carregarMunicipiosIBGE();
  const partes = busca.split(/\s+/).filter(Boolean);

  return cidades
    .map(c => {
      const nomeNorm = normalizarTextoCidade(c.nome);
      const labelNorm = normalizarTextoCidade(c.label);
      const match = partes.every(p => labelNorm.includes(p));
      if (!match) return null;

      let score = 3;
      if (nomeNorm === busca || labelNorm === busca) score = 0;
      else if (nomeNorm.startsWith(busca)) score = 1;
      else if (labelNorm.includes(busca)) score = 2;

      return { cidade: c, score };
    })
    .filter((x): x is { cidade: CidadeIBGE; score: number } => Boolean(x))
    .sort((a, b) => a.score - b.score || a.cidade.label.localeCompare(b.cidade.label, 'pt-BR'))
    .slice(0, limite)
    .map(x => x.cidade);
}

export async function padronizarCidadeIBGE(valor?: string | null): Promise<string> {
  const limpo = String(valor || '').trim().replace(/\s+-\s+/g, ' - ');
  if (!limpo) return '';
  if (cidadeEstaPadronizada(limpo)) return limpo;

  const opcoes = await buscarCidadesIBGE(limpo, 1);
  return opcoes[0]?.label ?? limpo;
}


// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface UserRecord {
  id:              number;
  nome:            string;
  email:           string;
  role:            'user' | 'aluno' | 'admin';
  foto_url:        string | null;
  localidade:      string | null;
  telefone:        string | null;
  plano_expira_em?: string | null;
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
// Admin — liberar PRO manualmente
// ---------------------------------------------------------------------------

export interface AdminUserSearchRecord {
  id: number;
  nome: string;
  email: string;
  role: 'user' | 'aluno' | 'admin';
  foto_url: string | null;
  telefone: string | null;
  plano_expira_em?: string | null;
}

export async function buscarUsuariosGratisAdmin(
  token: string,
  query: string
): Promise<AdminUserSearchRecord[]> {
  const q = query.trim();

  if (q.length < 2) return [];

  const res = await fetch(`${BASE_URL}/auth/admin/users/search?q=${encodeURIComponent(q)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao buscar usuários.');
  }

  return res.json();
}

export async function liberarProManualAdmin(
  token: string,
  userId: number,
  dias: number
): Promise<UserRecord> {
  const res = await fetch(`${BASE_URL}/auth/admin/users/${userId}/liberar-pro`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dias }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao liberar acesso PRO.');
  }

  const json = await res.json();
  return json.user;
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
  status?:          'aberta' | 'confirmada' | 'encerrada' | 'cancelada';
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
  | ProximaAulaAgendaRecord
  | (AtividadeHomeRecord & { tipo: 'desafio' });

export interface AtividadeHomeRecord {
  id:             string;
  origemId?:      string | number | null;
  tipo:           'aula' | 'jogo' | 'desafio';
  dataInicio:     string;
  dataFim?:       string | null;
  horarioInicio:  string;
  horarioFim:     string;
  local:          string;
  titulo:         string;
  subtitulo?:     string | null;
  status?:        string | null;
  pessoaNome?:    string | null;
  pessoaEmail?:   string | null;
  adversarioNome?: string | null;
  adversarioEmail?: string | null;
  alunoNome?:      string | null;
  alunoEmail?:     string | null;
  passado?:       boolean;
}

export interface AtividadesHomeResponse {
  proximas:   AtividadeHomeRecord[];
  anteriores: AtividadeHomeRecord[];
}

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

export async function getJogos(cidade?: string, incluirHistorico = false): Promise<JogoRecord[]> {
  const qs = new URLSearchParams();

  if (cidade) qs.set('cidade', cidade);
  if (incluirHistorico) qs.set('historico', '1');

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${BASE_URL}/jogos${query}`);
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
  role: UserRecord['role'],
  token?: string
): Promise<ProximaAtividadeCompletaRecord | null> {
  const buscarFallbackOriginal = async (): Promise<ProximaAtividadeCompletaRecord | null> => {
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
  };

  if (token) {
    const agenda = await getAtividadesHome(emailUsuario, role, token).catch(() => null);
    const primeira = agenda?.proximas?.[0];

    if (primeira) {
      return {
        ...primeira,
        adversarioNome: primeira.adversarioNome ?? primeira.pessoaNome ?? null,
        adversarioEmail: primeira.adversarioEmail ?? primeira.pessoaEmail ?? null,
        alunoNome: primeira.alunoNome ?? primeira.pessoaNome ?? null,
        alunoEmail: primeira.alunoEmail ?? primeira.pessoaEmail ?? null,
      } as ProximaAtividadeCompletaRecord;
    }

    return buscarFallbackOriginal();
  }

  return buscarFallbackOriginal();
}

function atividadeMs(a: { dataInicio: string; horarioInicio?: string; horarioFim?: string }): number {
  const data = String(a.dataInicio).slice(0, 10);
  const hora = String(a.horarioInicio || a.horarioFim || '00:00').slice(0, 5);
  return new Date(`${data}T${hora}:00`).getTime();
}

function atividadeFimMs(a: { dataInicio: string; horarioFim?: string; horarioInicio?: string }): number {
  const data = String(a.dataInicio).slice(0, 10);
  const hora = String(a.horarioFim || a.horarioInicio || '00:00').slice(0, 5);
  return new Date(`${data}T${hora}:00`).getTime();
}

async function lerAtividadesResponse(res: Response): Promise<AtividadeHomeRecord[]> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erro HTTP ${res.status}`);
  }

  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;

  return [];
}

export async function getAtividadesHome(
  emailUsuario: string,
  role: UserRecord['role'],
  token?: string
): Promise<AtividadesHomeResponse> {
  const qs = new URLSearchParams({
    email: emailUsuario,
    role,
  });

  const rankingPromise = token
    ? fetch(`${BASE_URL}/ranking/atividades`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(lerAtividadesResponse)
    : Promise.resolve([] as AtividadeHomeRecord[]);

  const [agendaResult, jogosResult, rankingResult] = await Promise.allSettled([
    fetch(`${BASE_URL}/agenda/atividades?${qs.toString()}`).then(lerAtividadesResponse),
    fetch(`${BASE_URL}/jogos/atividades?email=${encodeURIComponent(emailUsuario)}`).then(lerAtividadesResponse),
    rankingPromise,
  ]);

  const agendaAtividades: AtividadeHomeRecord[] =
    agendaResult.status === 'fulfilled' ? agendaResult.value : [];

  const jogosAtividades: AtividadeHomeRecord[] =
    jogosResult.status === 'fulfilled' ? jogosResult.value : [];

  const rankingAtividades: AtividadeHomeRecord[] =
    rankingResult.status === 'fulfilled' ? rankingResult.value : [];

  if (
    agendaResult.status === 'rejected' &&
    jogosResult.status === 'rejected' &&
    rankingResult.status === 'rejected'
  ) {
    throw new Error('Não foi possível carregar agenda, jogos e desafios.');
  }

  const agora = Date.now();
  const todas = [...agendaAtividades, ...jogosAtividades, ...rankingAtividades].map(a => ({
    ...a,
    adversarioNome: a.adversarioNome ?? a.pessoaNome ?? null,
    adversarioEmail: a.adversarioEmail ?? a.pessoaEmail ?? null,
    passado: a.passado ?? atividadeFimMs(a) < agora,
  }));

  const proximas = todas
    .filter(a => !a.passado)
    .sort((a, b) => atividadeMs(a) - atividadeMs(b))
    .slice(0, 30);

  const anteriores = todas
    .filter(a => a.passado)
    .sort((a, b) => atividadeMs(b) - atividadeMs(a))
    .slice(0, 30);

  return { proximas, anteriores };
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


export async function cancelarJogo(id: string, emailUsuario: string): Promise<JogoRecord> {
  const res = await fetch(`${BASE_URL}/jogos/${id}/cancelar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_usuario: emailUsuario }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erro ao cancelar partida: ${res.status}`);
  }

  return res.json();
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
