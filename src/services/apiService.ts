// =============================================================================
// API SERVICE — Comunicação com o tenis-back
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://tenis-back-production-9f72.up.railway.app';

// ---------------------------------------------------------------------------
// Gabarito biomecânico
// ---------------------------------------------------------------------------

export type NivelAluno = 'iniciante' | 'intermediario' | 'avancado';

export const NIVEL_LABELS: Record<NivelAluno, string> = {
  iniciante:     'Iniciante',
  intermediario: 'Intermediário',
  avancado:      'Avançado',
};

export interface JointMeta {
  label: string;
  ideal: number;
  tolerancia: number;
  peso: number;
}

export interface NivelConfig {
  metas: {
    elbow: JointMeta;
    knee:  JointMeta;
    hip:   JointMeta;
  };
}

export interface GabaritoEntry {
  label:       string;
  grupo:       string;
  fase:        string;
  imageUrl:    string;
  imageCredit: string;
  niveis:      Record<NivelAluno, NivelConfig>;
}

export async function fetchGabarito(): Promise<Record<string, GabaritoEntry>> {
  const res = await fetch(`${BASE_URL}/gabarito`);
  if (!res.ok) throw new Error(`Erro ao carregar gabarito: ${res.status}`);
  return res.json() as Promise<Record<string, GabaritoEntry>>;
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export interface ClipRecord {
  id: string;
  timestamp: string;
  videoDurationMs: number;
  audioDurationMs: number | null;
  driveVideoUrl: string;
  driveAudioUrl: string | null;
  syncStatus: string;
  createdAt: string;
}

export async function saveVideo(params: {
  id: string;
  timestamp: number;
  videoDurationMs: number;
  driveVideoUrl: string;
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, driveAudioUrl: null, audioDurationMs: null }),
  });
  if (!res.ok) throw new Error(`Erro ao salvar vídeo: ${res.status}`);
}

export async function saveAudio(params: {
  timestamp: number;
  audioDurationMs: number;
  driveAudioUrl: string;
  videoId?: string;
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/clips/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
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
  id:              string;
  cidade:          string;
  classe:          string;
  dataInicio:      string;
  dataFim?:        string | null;
  horarioInicio:   string;
  horarioFim:      string;
  local:           string;
  whatsapp:        string;
  publicadoEm:     number;
  emailPublicador?: string | null;
}

export async function getJogos(cidade?: string): Promise<JogoRecord[]> {
  const qs  = cidade ? `?cidade=${encodeURIComponent(cidade)}` : '';
  const res = await fetch(`${BASE_URL}/jogos${qs}`);
  if (!res.ok) throw new Error(`Erro ao carregar mural: ${res.status}`);
  return res.json();
}

export async function postJogo(jogo: JogoRecord): Promise<JogoRecord> {
  const res = await fetch(`${BASE_URL}/jogos`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(jogo),
  });
  if (!res.ok) throw new Error(`Erro ao publicar: ${res.status}`);
  return res.json();
}

export async function deleteJogo(id: string, emailPublicador: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jogos/${id}`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ emailPublicador }),
  });
  if (!res.ok) throw new Error(`Erro ao remover: ${res.status}`);
}
