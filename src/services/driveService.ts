// =============================================================================
// DRIVE SERVICE — Upload direto do browser para o Google Drive
// =============================================================================
// O token OAuth é obtido via @react-oauth/google (Google Identity Services).
// O upload usa a API multipart do Drive v3 diretamente do browser —
// os arquivos de vídeo/áudio nunca passam pelo tenis-back (mais rápido).
// Apenas os metadados (paths, URLs, status) vão para o PostgreSQL via tenis-back.
// =============================================================================

const DRIVE_UPLOAD  = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_API     = 'https://www.googleapis.com/drive/v3';
const ROOT_FOLDER   = '1iNPmg03l_Ux4siRWZ4KY8tGKoGQJtZr_';

// Token armazenado em memória durante a sessão
let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

function getToken(): string {
  if (!accessToken) throw new Error('Usuário não autenticado no Google.');
  return accessToken;
}

// ---------------------------------------------------------------------------
// ensureMonthFolder — cria ou reutiliza subpasta do mês (ex: "2025-04")
// ---------------------------------------------------------------------------
async function ensureMonthFolder(): Promise<string> {
  const token = getToken();
  const now = new Date();
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const q = encodeURIComponent(
    `name='${label}' and '${ROOT_FOLDER}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
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
  const folder = await create.json();
  return folder.id as string;
}

// ---------------------------------------------------------------------------
// uploadBlob — faz upload de um Blob para uma pasta do Drive
// Retorna a URL de visualização
// ---------------------------------------------------------------------------
async function uploadBlob(
  blob: Blob,
  fileName: string,
  folderId: string
): Promise<string> {
  const token = getToken();
  const boundary = `TenisCam${Date.now()}`;

  // Lê o blob como ArrayBuffer para envio binário (sem conversão base64 — mais rápido)
  const buffer = await blob.arrayBuffer();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  // Constrói o corpo multipart manualmente com TextEncoder + ArrayBuffer
  const enc = new TextEncoder();
  const pre =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;

  const body = new Uint8Array([
    ...enc.encode(pre),
    ...new Uint8Array(buffer),
    ...enc.encode(post),
  ]);

  const res = await fetch(DRIVE_UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) throw new Error(`Upload falhou (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return `https://drive.google.com/file/d/${json.id}/view`;
}

// ---------------------------------------------------------------------------
// uploadClip — orquestra upload de vídeo + áudio
// ---------------------------------------------------------------------------
export async function uploadClip(params: {
  videoBlob: Blob;
  audioBlob: Blob | null;
  timestamp: number;
}): Promise<{ driveVideoUrl: string; driveAudioUrl: string | null }> {
  const folderId = await ensureMonthFolder();
  const ts = params.timestamp;

  const driveVideoUrl = await uploadBlob(params.videoBlob, `video_${ts}.webm`, folderId);

  let driveAudioUrl: string | null = null;
  if (params.audioBlob) {
    driveAudioUrl = await uploadBlob(params.audioBlob, `audio_${ts}.webm`, folderId);
  }

  return { driveVideoUrl, driveAudioUrl };
}
