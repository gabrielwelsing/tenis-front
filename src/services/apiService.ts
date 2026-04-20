// =============================================================================
// API SERVICE — Comunicação com o tenis-back
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Gabarito biomecânico
// ---------------------------------------------------------------------------

export interface JointMeta {
  label: string;
  ideal: number;
  tolerancia: number;
  peso: number;
}

export interface GabaritoGolpe {
  label: string;
  imageUrl: string;
  imageCredit: string;
  metas: {
    elbow: JointMeta;
    knee:  JointMeta;
    hip:   JointMeta;
  };
}

export async function fetchGabarito(): Promise<Record<string, GabaritoGolpe>> {
  const res = await fetch(`${BASE_URL}/gabarito`);
  if (!res.ok) throw new Error(`Erro ao carregar gabarito: ${res.status}`);
  return res.json() as Promise<Record<string, GabaritoGolpe>>;
}

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

// videoId: ID do vídeo mais recente — vincula o áudio diretamente (sem adivinhação)
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
