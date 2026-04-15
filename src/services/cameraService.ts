// =============================================================================
// CAMERA SERVICE — Buffer Circular via MediaRecorder API (Web)
// =============================================================================
// Como funciona:
//   1. Câmera grava continuamente em chunks de SEGMENT_MS milissegundos
//   2. Cada chunk vira um Blob e entra num array circular de MAX_SEGMENTS posições
//   3. Quando o array enche, o chunk mais antigo é descartado (sem disco — só memória)
//   4. Ao apertar o botão: para o chunk atual, junta todos os blobs em um único
//      arquivo e devolve — são os ÚLTIMOS 20 segundos gravados ANTES do botão
//   5. O buffer retoma automaticamente após o saveClip()
// =============================================================================

const SEGMENT_MS   = 5_000; // 5s por chunk
const MAX_SEGMENTS = 4;     // 4 × 5s = 20 segundos de buffer

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
  private rotationTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private mimeType = '';

  // -------------------------------------------------------------------------
  // start — abre câmera traseira, exibe preview e inicia o buffer circular
  // -------------------------------------------------------------------------
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
    await previewElement.play();

    this.mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp8';

    this.active = true;
    this.segments = [];
    await this.acquireWakeLock();
    this.startSegment();
  }

  // -------------------------------------------------------------------------
  // startSegment — grava um chunk de SEGMENT_MS ms e agenda o próximo
  // Cada segmento encadeia automaticamente o próximo via onstop
  // -------------------------------------------------------------------------
  private startSegment(): void {
    if (!this.active || !this.stream) return;

    const chunks: BlobPart[] = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      // Adiciona o chunk ao buffer circular
      const blob = new Blob(chunks, { type: this.mimeType });
      if (blob.size > 0) {
        this.segments.push(blob);
        if (this.segments.length > MAX_SEGMENTS) {
          this.segments.shift(); // descarta o mais antigo
        }
      }

      // Inicia o próximo chunk automaticamente (loop do buffer)
      if (this.active) {
        this.startSegment();
      }
    };

    this.recorder.start();

    // Agenda o stop deste chunk após SEGMENT_MS — dispara onstop → próximo chunk
    this.rotationTimer = setTimeout(() => {
      if (this.recorder?.state === 'recording') {
        this.recorder.stop();
      }
    }, SEGMENT_MS);
  }

  // -------------------------------------------------------------------------
  // saveClip — consolida os últimos 20s em um único Blob
  //
  // Fluxo:
  //   1. Pausa o loop (active = false) para não iniciar novo chunk após o stop
  //   2. Para o chunk atual e aguarda o blob final ser adicionado ao array
  //   3. Copia todos os blobs do buffer
  //   4. Retoma o buffer (active = true → startSegment)
  //   5. Retorna o Blob concatenado
  // -------------------------------------------------------------------------
  async saveClip(): Promise<ClipResult> {
    if (!this.active || !this.stream) {
      return { success: false, error: 'Buffer inativo.' };
    }

    if (this.segments.length === 0 && this.recorder?.state !== 'recording') {
      return { success: false, error: 'Buffer vazio — aguarde alguns segundos.' };
    }

    // Pausa o loop para capturar o chunk atual sem iniciar outro
    this.active = false;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    // Para o gravador atual e aguarda o blob ser entregue via onstop
    if (this.recorder?.state === 'recording') {
      await new Promise<void>((resolve) => {
        const original = this.recorder!.onstop;
        this.recorder!.onstop = (e) => {
          original?.call(this.recorder, e as Event);
          resolve();
        };
        this.recorder!.stop();
      });
    }

    // Snapshot dos segmentos — estes são os últimos ~20s antes do botão
    const snapshot = [...this.segments];

    // Retoma o buffer para continuar gravando após o clipping
    this.active = true;
    this.startSegment();

    if (snapshot.length === 0) {
      return { success: false, error: 'Buffer vazio — aguarde alguns segundos.' };
    }

    const merged   = new Blob(snapshot, { type: this.mimeType });
    const totalMs  = snapshot.length * SEGMENT_MS;

    return { success: true, blob: merged, durationMs: totalMs };
  }

  // -------------------------------------------------------------------------
  // stop — encerra tudo e libera câmera
  // -------------------------------------------------------------------------
  async stop(): Promise<void> {
    this.active = false;
    if (this.rotationTimer) clearTimeout(this.rotationTimer);
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream   = null;
    this.segments = [];
    this.recorder = null;
    await this.releaseWakeLock();
  }

  // -------------------------------------------------------------------------
  // Wake Lock — mantém tela do Samsung acesa
  // -------------------------------------------------------------------------
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

  get bufferSeconds(): number {
    return this.segments.length * (SEGMENT_MS / 1000);
  }

  get isActive(): boolean {
    return this.active;
  }
}

export const cameraService = new CameraService();
