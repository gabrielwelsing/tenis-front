// =============================================================================
// LOCAL SAVE SERVICE — Salva arquivos diretamente no dispositivo
// Usado pelo login ADM para testes sem Google Drive
// Cria sequência: lance1, lance2, lance3...
// Persiste metadados no localStorage para exibição no Histórico.
// =============================================================================

const COUNT_KEY  = 'tenis_lance_count';
const CLIPS_KEY  = 'tenis_local_clips';

export interface LocalClipRecord {
  id: string;
  lanceName: string;
  timestamp: number;
  videoDurationMs: number;
  audioDurationMs?: number;
  videoExt: string;
  audioExt?: string;
}

// -------------------------------------------------------------------------
// Persistência de metadados
// -------------------------------------------------------------------------
function loadClips(): LocalClipRecord[] {
  try {
    return JSON.parse(localStorage.getItem(CLIPS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveClips(clips: LocalClipRecord[]): void {
  localStorage.setItem(CLIPS_KEY, JSON.stringify(clips));
}

export function getLocalClips(): LocalClipRecord[] {
  return loadClips().sort((a, b) => b.timestamp - a.timestamp);
}

export function addVideoToLocalClips(lanceName: string, durationMs: number, ext: string): void {
  const clips = loadClips();
  clips.push({
    id: lanceName,
    lanceName,
    timestamp: Date.now(),
    videoDurationMs: durationMs,
    videoExt: ext,
  });
  saveClips(clips);
}

export function addAudioToLocalClips(lanceName: string, durationMs: number, ext: string): void {
  const clips = loadClips();
  const clip  = clips.find((c) => c.lanceName === lanceName);
  if (clip) {
    clip.audioDurationMs = durationMs;
    clip.audioExt        = ext;
    saveClips(clips);
  }
}

export function clearLocalClips(): void {
  localStorage.removeItem(CLIPS_KEY);
}

// -------------------------------------------------------------------------
// Download de arquivo
// -------------------------------------------------------------------------
function nextLanceName(): string {
  const current = parseInt(localStorage.getItem(COUNT_KEY) ?? '0', 10);
  const next    = current + 1;
  localStorage.setItem(COUNT_KEY, String(next));
  return `lance${next}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function saveVideoLocally(blob: Blob, durationMs: number): string {
  const lance = nextLanceName();
  const ext   = blob.type.includes('mp4') ? 'mp4' : 'webm';
  downloadBlob(blob, `${lance}_video.${ext}`);
  addVideoToLocalClips(lance, durationMs, ext);
  return lance;
}

export function saveAudioLocally(blob: Blob, lanceName: string, durationMs: number): void {
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  downloadBlob(blob, `${lanceName}_audio.${ext}`);
  addAudioToLocalClips(lanceName, durationMs, ext);
}

export function resetLanceCount(): void {
  localStorage.removeItem(COUNT_KEY);
}
