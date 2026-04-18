// =============================================================================
// LOCAL SAVE SERVICE — Salva arquivos + metadados por perfil de usuário
// Cada usuário tem seu próprio histórico isolado no localStorage.
// =============================================================================

// ── Perfis ────────────────────────────────────────────────────────────────────
const PROFILES_KEY    = 'tenis_profiles';    // Record<username, password>
const CURRENT_USER_KEY = 'tenis_current_user';

export interface LocalProfile {
  username: string;
}

function loadProfiles(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '{}'); }
  catch { return {}; }
}

export function getCurrentUser(): string {
  return localStorage.getItem(CURRENT_USER_KEY) ?? 'default';
}

export function setCurrentUser(username: string): void {
  localStorage.setItem(CURRENT_USER_KEY, username);
}

/** Cria ou autentica um usuário.
 *  - Se o usuário não existe → cria e retorna 'created'
 *  - Se existe e senha correta → retorna 'ok'
 *  - Se existe e senha errada → retorna 'wrong_password'
 */
export function admLogin(username: string, password: string): 'created' | 'ok' | 'wrong_password' {
  const profiles = loadProfiles();
  const trimmed  = username.trim().toLowerCase();

  if (!profiles[trimmed]) {
    profiles[trimmed] = password;
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    setCurrentUser(trimmed);
    return 'created';
  }

  if (profiles[trimmed] === password) {
    setCurrentUser(trimmed);
    return 'ok';
  }

  return 'wrong_password';
}

export function admLogout(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ── Metadados de clipes (por usuário) ─────────────────────────────────────────
const COUNT_KEY = () => `tenis_lance_count_${getCurrentUser()}`;
const CLIPS_KEY = () => `tenis_local_clips_${getCurrentUser()}`;

export interface LocalClipRecord {
  id: string;
  lanceName: string;
  timestamp: number;
  videoDurationMs: number;
  audioDurationMs?: number;
  videoExt: string;
  audioExt?: string;
}

function loadClips(): LocalClipRecord[] {
  try { return JSON.parse(localStorage.getItem(CLIPS_KEY()) ?? '[]'); }
  catch { return []; }
}

function saveClips(clips: LocalClipRecord[]): void {
  localStorage.setItem(CLIPS_KEY(), JSON.stringify(clips));
}

export function getLocalClips(): LocalClipRecord[] {
  return loadClips().sort((a, b) => b.timestamp - a.timestamp);
}

export function addVideoToLocalClips(lanceName: string, durationMs: number, ext: string): void {
  const clips = loadClips();
  clips.push({ id: lanceName, lanceName, timestamp: Date.now(), videoDurationMs: durationMs, videoExt: ext });
  saveClips(clips);
}

export function addAudioToLocalClips(lanceName: string, durationMs: number, ext: string): void {
  const clips = loadClips();
  const clip  = clips.find((c) => c.lanceName === lanceName);
  if (clip) { clip.audioDurationMs = durationMs; clip.audioExt = ext; saveClips(clips); }
}

export function clearLocalClips(): void {
  localStorage.removeItem(CLIPS_KEY());
}

// ── Download de arquivo ───────────────────────────────────────────────────────
function nextLanceName(): string {
  const current = parseInt(localStorage.getItem(COUNT_KEY()) ?? '0', 10);
  const next    = current + 1;
  localStorage.setItem(COUNT_KEY(), String(next));
  return `lance${next}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
  localStorage.removeItem(COUNT_KEY());
}
