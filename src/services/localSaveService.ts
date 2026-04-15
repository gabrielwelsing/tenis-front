// =============================================================================
// LOCAL SAVE SERVICE — Salva arquivos diretamente no dispositivo
// Usado pelo login ADM para testes sem Google Drive
// Cria sequência: lance1, lance2, lance3...
// =============================================================================

const COUNT_KEY = 'tenis_lance_count';

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

export function saveVideoLocally(blob: Blob): string {
  const lance = nextLanceName();
  const ext   = blob.type.includes('mp4') ? 'mp4' : 'webm';
  downloadBlob(blob, `${lance}_video.${ext}`);
  return lance;
}

export function saveAudioLocally(blob: Blob, lanceName: string): void {
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  downloadBlob(blob, `${lanceName}_audio.${ext}`);
}

export function resetLanceCount(): void {
  localStorage.removeItem(COUNT_KEY);
}
