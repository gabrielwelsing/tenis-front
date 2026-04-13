// =============================================================================
// CAMERA SERVICE — Buffer Circular via MediaRecorder API (Web)
// =============================================================================
// Estratégia:
//   - getUserMedia para acessar a câmera traseira do Samsung
//   - MediaRecorder grava em chunks de SEGMENT_MS milissegundos
//   - Array circular de MAX_SEGMENTS chunks (blobs em memória)
//   - saveClip(): concatena os blobs em um único Blob e gera arquivo .webm
//   - Wake Lock API: mantém a tela do Samsung acesa durante toda a sessão
// =============================================================================

const SEGMENT_MS   = 5_000;  // 5s por chunk
const MAX_SEGMENTS = 4;      // 4 × 5s = 20 segundos de buffer

export interface ClipResult {
  success: boolean;
  blob?: Blob;
  durationMs?: number;
  error?: string;
}

class CameraService {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private segments: Blob[] = [];
  private wakeLock: WakeLockSentinel | null = null;
  private previewEl: HTMLVideoElement | null = null;
  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private segmentStartTime = 0;

  // -------------------------------------------------------------------------
  // start — solicita câmera traseira, exibe preview e inicia o buffer
  // -------------------------------------------------------------------------
  async start(previewElement: HTMLVideoElement): Promise<void> {
    this.previewEl = previewElement;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }, // câmera traseira no Samsung
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false, // áudio gerenciado separadamente pelo AudioService
    });

    previewElement.srcObject = this.stream;
    previewElement.play();

    // Mantém tela acesa (Wake Lock)
    await this.acquireWakeLock();

    this.startRotation();
  }

  // -------------------------------------------------------------------------
  // startRotation — inicia o loop de gravação em chunks
  // -------------------------------------------------------------------------
  private startRotation(): void {
    this.startSegment();
    this.rotationTimer = setInterval(() => {
      this.recorder?.stop(); // dispara ondataavailable + onStop → próximo segmento
    }, SEGMENT_MS);
  }

  private startSegment(): void {
    if (!this.stream) return;

    // Prefere VP9 para melhor compressão; fallback para VP8 (suporte amplo no Android)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp8';

    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.segmentStartTime = Date.now();

    const chunks: BlobPart[] = [];

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      this.pushSegment(blob);
    };

    this.recorder.start();
  }

  private pushSegment(blob: Blob): void {
    this.segments.push(blob);
    if (this.segments.length > MAX_SEGMENTS) {
      this.segments.shift(); // descarta o mais antigo (sem necessidade de deletar disco)
    }
  }

  // -------------------------------------------------------------------------
  // saveClip — consolida o buffer em um único Blob .webm
  // Roda inteiramente na main thread mas é instantâneo pois só concatena
  // Blobs já em memória (sem re-encode, sem I/O de disco)
  // -------------------------------------------------------------------------
  async saveClip(): Promise<ClipResult> {
    if (this.segments.length === 0) {
      return { success: false, error: 'Buffer vazio.' };
    }

    // Para o segmento atual para fechar o blob
    this.recorder?.stop();
    await new Promise((r) => setTimeout(r, 200));

    const snapshot = [...this.segments];
    const totalMs  = snapshot.length * SEGMENT_MS;

    // Concatenação de Blobs — sem CPU extra (apenas ponteiros de memória)
    const merged = new Blob(snapshot, { type: snapshot[0].type });

    return { success: true, blob: merged, durationMs: totalMs };
  }

  // -------------------------------------------------------------------------
  // stop — para tudo e libera a câmera
  // -------------------------------------------------------------------------
  async stop(): Promise<void> {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.segments = [];
    await this.releaseWakeLock();
  }

  // -------------------------------------------------------------------------
  // Wake Lock — mantém a tela do Samsung acesa
  // -------------------------------------------------------------------------
  private async acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* dispositivo pode negar — não é crítico */ }
  }

  private async releaseWakeLock(): Promise<void> {
    await this.wakeLock?.release();
    this.wakeLock = null;
  }

  // Reaquire wake lock quando o app volta ao foco
  async reacquireWakeLockIfNeeded(): Promise<void> {
    if (this.stream && !this.wakeLock) {
      await this.acquireWakeLock();
    }
  }

  get bufferSeconds(): number {
    return Math.min(this.segments.length * (SEGMENT_MS / 1000), 20);
  }

  get isActive(): boolean {
    return this.stream !== null;
  }
}

export const cameraService = new CameraService();
