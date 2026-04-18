// =============================================================================
// CAMERA SERVICE — Buffer Circular via timeslice contínuo (Web)
// =============================================================================
// ✅ CORRETO: um único MediaRecorder contínuo com timeslice
//    → timeslice = 200ms → ondataavailable dispara a cada 200ms
//    → chunks[0] (init segment com headers) é SEMPRE preservado
//    → Demais chunks são filtrados pelo tempo configurado (20-50s)
//    → Ao salvar: juntamos todos os chunks em um único Blob válido
// =============================================================================

const TIMESLICE_MS   = 200;
const DURATION_KEY   = 'tenis_max_seconds';
const DEFAULT_SEC    = 20;
const VALID_DURATIONS = [20, 30, 40, 50] as const;
export type BufferDuration = typeof VALID_DURATIONS[number];

export interface ClipResult {
  success: boolean;
  blob?: Blob;
  durationMs?: number;
  error?: string;
}

interface TimedChunk {
  data: BlobPart;
  time: number;
}

function getSupportedMimeType(): string {
  const types = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function loadMaxMs(): number {
  const saved = parseInt(localStorage.getItem(DURATION_KEY) ?? '', 10);
  return VALID_DURATIONS.includes(saved as BufferDuration) ? saved * 1000 : DEFAULT_SEC * 1000;
}

class CameraService {
  private stream:   MediaStream | null     = null;
  private recorder: MediaRecorder | null   = null;
  private chunks:   TimedChunk[]           = [];
  private wakeLock: WakeLockSentinel | null = null;
  private mimeType  = '';
  private active    = false;
  private maxMs     = loadMaxMs();

  // ── Duração configurável ────────────────────────────────────────────────────
  get maxSeconds(): BufferDuration {
    return (this.maxMs / 1000) as BufferDuration;
  }

  setMaxDuration(seconds: BufferDuration): void {
    this.maxMs = seconds * 1000;
    localStorage.setItem(DURATION_KEY, String(seconds));
  }

  // ── start — abre câmera + microfone e inicia buffer contínuo ────────────────
  async start(previewElement: HTMLVideoElement): Promise<void> {
    this.maxMs = loadMaxMs(); // relê ao iniciar (garante valor atualizado)

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:      { ideal: 1280 },
        height:     { ideal: 720 },
        frameRate:  { ideal: 30 },
      },
      audio: true,
    });

    previewElement.srcObject = this.stream;
    previewElement.setAttribute('playsinline', 'true');
    previewElement.muted = true;
    await previewElement.play();

    this.mimeType = getSupportedMimeType();
    this.active   = true;
    this.chunks   = [];

    await this.acquireWakeLock();
    this.startRecorder();
  }

  // ── startRecorder ────────────────────────────────────────────────────────────
  private startRecorder(): void {
    if (!this.stream) return;

    const options = this.mimeType ? { mimeType: this.mimeType } : {};
    this.recorder = new MediaRecorder(this.stream, options);

    this.recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;

      const now    = Date.now();
      const cutoff = now - this.maxMs;

      this.chunks.push({ data: e.data, time: now });

      // chunks[0] = init segment (headers do container — NUNCA descartar)
      // Filtramos apenas a partir do índice 1 para manter o arquivo válido
      if (this.chunks.length > 1) {
        this.chunks = [
          this.chunks[0],
          ...this.chunks.slice(1).filter((c) => c.time >= cutoff),
        ];
      }
    };

    this.recorder.onerror = () => {
      if (this.active) setTimeout(() => this.startRecorder(), 500);
    };

    this.recorder.start(TIMESLICE_MS);
  }

  // ── saveClip — consolida o buffer em um único Blob válido ───────────────────
  async saveClip(): Promise<ClipResult> {
    if (!this.active || !this.recorder || this.chunks.length === 0) {
      return { success: false, error: 'Buffer vazio — aguarde alguns segundos.' };
    }

    this.recorder.requestData();
    await new Promise((r) => setTimeout(r, 300));

    const snapshot  = [...this.chunks];
    const totalMs   = snapshot.length * TIMESLICE_MS;
    const clampedMs = Math.min(totalMs, this.maxMs);

    const merged = new Blob(snapshot.map((c) => c.data), {
      type: this.mimeType || 'video/webm',
    });

    return { success: true, blob: merged, durationMs: clampedMs };
  }

  // ── stop — encerra tudo e libera recursos ───────────────────────────────────
  async stop(): Promise<void> {
    this.active = false;
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream   = null;
    this.recorder = null;
    this.chunks   = [];
    await this.releaseWakeLock();
  }

  // ── Wake Lock ────────────────────────────────────────────────────────────────
  private async acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* não crítico */ }
  }

  private async releaseWakeLock(): Promise<void> {
    await this.wakeLock?.release();
    this.wakeLock = null;
  }

  async reacquireWakeLockIfNeeded(): Promise<void> {
    if (this.stream && !this.wakeLock) await this.acquireWakeLock();
  }

  // ── Getters ──────────────────────────────────────────────────────────────────
  get bufferSeconds(): number {
    if (this.chunks.length === 0) return 0;
    const oldest = this.chunks[0].time;
    const newest = this.chunks[this.chunks.length - 1].time;
    return Math.min(Math.round((newest - oldest) / 1000), this.maxMs / 1000);
  }

  get isActive(): boolean { return this.active; }
}

export const cameraService = new CameraService();
export { VALID_DURATIONS };
