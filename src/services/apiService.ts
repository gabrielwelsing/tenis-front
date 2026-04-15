// =============================================================================
// API SERVICE — Comunicação com o tenis-back
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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

// Salva metadados do vídeo (sem áudio ainda)
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

// Vincula áudio ao vídeo de timestamp mais próximo
export async function saveAudio(params: {
  timestamp: number;
  audioDurationMs: number;
  driveAudioUrl: string;
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
