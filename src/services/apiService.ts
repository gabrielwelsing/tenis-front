// =============================================================================
// API SERVICE — Comunicação com o tenis-back (Railway)
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface ClipPayload {
  id: string;
  timestamp: number;
  videoDurationMs: number;
  audioDurationMs: number | null;
  driveVideoUrl: string;
  driveAudioUrl: string | null;
}

export interface ClipRecord extends ClipPayload {
  createdAt: string;
  syncStatus: string;
}

// ---------------------------------------------------------------------------
// saveClip — persiste os metadados do lance no PostgreSQL via tenis-back
// ---------------------------------------------------------------------------
export async function saveClip(payload: ClipPayload): Promise<void> {
  const res = await fetch(`${BASE_URL}/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ao salvar clip: ${res.status}`);
}

// ---------------------------------------------------------------------------
// getClips — lista todos os lances do banco (para a tela de histórico)
// ---------------------------------------------------------------------------
export async function getClips(): Promise<ClipRecord[]> {
  const res = await fetch(`${BASE_URL}/clips`);
  if (!res.ok) throw new Error(`Erro ao carregar clips: ${res.status}`);
  return res.json();
}
