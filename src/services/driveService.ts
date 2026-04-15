// =============================================================================
// DRIVE SERVICE — Upload de vídeo e áudio separados para o Google Drive
// Pasta raiz: https://drive.google.com/drive/folders/1iNPmg03l_Ux4siRWZ4KY8tGKoGQJtZr_
// =============================================================================

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_API    = 'https://www.googleapis.com/drive/v3';
const ROOT_FOLDER  = '1iNPmg03l_Ux4siRWZ4KY8tGKoGQJtZr_';

let accessToken: string | null = null;

export function setAccessToken(token: string): void { accessToken = token; }
function getToken(): string {
  if (!accessToken) throw new Error('Não autenticado no Google.');
  return accessToken;
}

// Subpasta por mês: ex "2025-04"
async function ensureMonthFolder(): Promise<string> {
  const token = getToken();
  const now   = new Date();
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const q   = encodeURIComponent(`name='${label}' and '${ROOT_FOLDER}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.files?.length) return data.files[0].id as string;

  const create = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: label, mimeType: 'application/vnd.google-apps.folder', parents: [ROOT_FOLDER] }),
  });
  return (await create.json()).id as string;
}

async function uploadBlob(blob: Blob, fileName: string, folderId: string): Promise<string> {
  const token    = getToken();
  const boundary = `TenisCam${Date.now()}`;
  const buffer   = await blob.arrayBuffer();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const enc      = new TextEncoder();

  const pre  = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = new Uint8Array([...enc.encode(pre), ...new Uint8Array(buffer), ...enc.encode(post)]);

  const res = await fetch(DRIVE_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });

  if (!res.ok) throw new Error(`Upload falhou (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return `https://drive.google.com/file/d/${json.id}/view`;
}

// ---------------------------------------------------------------------------
// Exportações: vídeo e áudio separados
// ---------------------------------------------------------------------------

export async function uploadVideo(blob: Blob, timestamp: number): Promise<string> {
  const folderId = await ensureMonthFolder();
  const ext      = blob.type.includes('mp4') ? 'mp4' : 'webm';
  return uploadBlob(blob, `video_${timestamp}.${ext}`, folderId);
}

export async function uploadAudio(blob: Blob, timestamp: number): Promise<string> {
  const folderId = await ensureMonthFolder();
  const ext      = blob.type.includes('mp4') ? 'm4a' : 'webm';
  return uploadBlob(blob, `audio_${timestamp}.${ext}`, folderId);
}
