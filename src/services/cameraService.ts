// =============================================================================
// CAMERA SERVICE — Buffer Circular via MediaRecorder API (Web)
// =============================================================================

const SEGMENT_MS   = 5_000;
const MAX_SEGMENTS = 4; // 4 × 5s = 20s de buffer

export interface ClipResult {
  success: boolean;
  blob?: Blob;
  durationMs?: number;
  error?: string;
}

// Detecta o mimeType suportado — iOS Safari só aceita mp4, Chrome prefere webm
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

class CameraService {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private segments: Blob[] = [];
  private wakeLock: WakeLockSentinel | null = null;
  private rotationTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private mimeType = '';

  async start(previewElement: HTMLVideoElement): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });

    previewElement.srcObject = this.stream;
    previewElement.setAttribute('playsinline', 'true'); // obrigatório no iOS
    await previewElement.play();

    this.mimeType = getSupportedMimeType();
    this.active   = true;
    this.segments = [];

    await this.acquireWakeLock();
    this.startSegment();
  }

  private startSegment(): void {
    if (!this.active || !this.stream) return;

    const chunks: BlobPart[] = [];
    const options = this.mimeType ? { mimeType: this.mimeType } : {};
    this.recorder = new MediaRecorder(this.stream, options);

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(chunks, { type: this.mimeType || 'video/webm' });
      if (blob.size > 0) {
        this.segments.push(blob);
        if (this.segments.length > MAX_SEGMENTS) this.segments.shift();
      }
      // Encadeia o próximo chunk automaticamente
      if (this.active) this.startSegment();
    };

    this.recorder.start();

    // Para o chunk após SEGMENT_MS → dispara onstop → inicia próximo
    this.rotationTimer = setTimeout(() => {
      if (this.recorder?.state === 'recording') this.recorder.stop();
    }, SEGMENT_MS);
  }

  // ---------------------------------------------------------------------------
  // saveClip — retorna os últimos ~20s gravados ANTES do botão ser apertado
  // ---------------------------------------------------------------------------
  async saveClip(): Promise<ClipResult> {
    if (!this.active || !this.stream) {
      return { success: false, error: 'Buffer inativo.' };
    }

    // Pausa o loop para capturar o chunk corrente sem iniciar outro
    this.active = false;
    if (this.rotationTimer) { clearTimeout(this.rotationTimer); this.rotationTimer = null; }

    // Para o recorder atual e aguarda o blob ser entregue
    if (this.recorder?.state === 'recording') {
      await new Promise<void>((resolve) => {
        const prev = this.recorder!.onstop;
        this.recorder!.onstop = (e) => {
          prev?.call(this.recorder, e as Event);
          resolve();
        };
        this.recorder!.stop();
      });
    }

    const snapshot = [...this.segments];

    // Retoma o buffer imediatamente
    this.active = true;
    this.startSegment();

    if (snapshot.length === 0) {
      return { success: false, error: 'Buffer vazio — aguarde pelo menos 5 segundos.' };
    }

    const merged  = new Blob(snapshot, { type: this.mimeType || 'video/webm' });
    const totalMs = snapshot.length * SEGMENT_MS;
    return { success: true, blob: merged, durationMs: totalMs };
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.rotationTimer) clearTimeout(this.rotationTimer);
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.segments = []; this.recorder = null;
    await this.releaseWakeLock();
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* não crítico */ }
  }

  private async releaseWakeLock(): Promise<void> {
    await this.wakeLock?.release();
    this.wakeLock = null;
  }

  async reacquireWakeLockIfNeeded(): Promise<void> {
    if (this.stream && !this.wakeLock) await this.acquireWakeLock();
  }

  get bufferSeconds(): number { return this.segments.length * (SEGMENT_MS / 1000); }
  get isActive(): boolean     { return this.active; }
}

export const cameraService = new CameraService();
