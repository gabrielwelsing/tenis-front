// =============================================================================
// CAMERA SERVICE — Buffer Circular via timeslice contínuo (Web)
// =============================================================================
// Abordagem correta para buffer circular na web:
//
// ❌ ERRADO: gravar em segmentos separados e concatenar os Blobs
//    → Cada segmento tem seu próprio cabeçalho WebM/MP4
//    → Concatenar Blobs gera arquivo inválido — player lê só o 1º segmento
//
// ✅ CORRETO: um único MediaRecorder contínuo com timeslice
//    → timeslice = 200ms → ondataavailable dispara a cada 200ms
//    → Guardamos cada chunk com seu timestamp em um array
//    → Descartamos chunks com mais de MAX_MS milissegundos
//    → Ao salvar: juntamos só os chunks dos últimos 20s em um único Blob
//    → Como é um stream contínuo, o Blob resultante é um vídeo válido
// =============================================================================

const TIMESLICE_MS = 200;    // coleta chunk a cada 200ms
const MAX_MS       = 20_000; // janela do buffer: últimos 20 segundos

export interface ClipResult {
  success: boolean;
  blob?: Blob;
  durationMs?: number;
  error?: string;
}

interface TimedChunk {
  data: BlobPart;
  time: number; // timestamp de quando o chunk chegou
}

function getSupportedMimeType(): string {
  const types = [
    'video/mp4;codecs=avc1,mp4a.40.2', // MP4/H.264 — aceito pelo WhatsApp
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

class CameraService {
  private stream: MediaStream | null   = null;
  private recorder: MediaRecorder | null = null;
  private chunks: TimedChunk[]         = [];
  private wakeLock: WakeLockSentinel | null = null;
  private mimeType = '';
  private active   = false;

  // -------------------------------------------------------------------------
  // start — abre câmera + microfone, exibe preview e inicia buffer contínuo
  // -------------------------------------------------------------------------
  async start(previewElement: HTMLVideoElement): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:     { ideal: 1280 },
        height:    { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: true, // captura áudio da quadra junto com o vídeo
    });

    previewElement.srcObject = this.stream;
    previewElement.setAttribute('playsinline', 'true');
    previewElement.muted = true; // mudo no preview para não criar eco
    await previewElement.play();

    this.mimeType = getSupportedMimeType();
    this.active   = true;
    this.chunks   = [];

    await this.acquireWakeLock();
    this.startRecorder();
  }

  // -------------------------------------------------------------------------
  // startRecorder — inicia o recorder contínuo com timeslice
  // -------------------------------------------------------------------------
  private startRecorder(): void {
    if (!this.stream) return;

    const options = this.mimeType ? { mimeType: this.mimeType } : {};
    this.recorder = new MediaRecorder(this.stream, options);

    this.recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;

      const now    = Date.now();
      const cutoff = now - MAX_MS;

      this.chunks.push({ data: e.data, time: now });

      // chunks[0] é o segmento de inicialização (cabeçalho WebM/MP4 com info de codec).
      // Sem ele o arquivo fica sem cabeçalho e não abre em nenhum player.
      // Por isso preservamos sempre o índice 0 e filtramos só a partir do índice 1.
      if (this.chunks.length > 1) {
        this.chunks = [
          this.chunks[0],
          ...this.chunks.slice(1).filter((c) => c.time >= cutoff),
        ];
      }
    };

    this.recorder.onerror = () => {
      // Se o recorder falhar, tenta reiniciar
      if (this.active) {
        setTimeout(() => this.startRecorder(), 500);
      }
    };

    // timeslice: dispara ondataavailable a cada TIMESLICE_MS
    this.recorder.start(TIMESLICE_MS);
  }

  // -------------------------------------------------------------------------
  // saveClip — consolida os últimos 20s em um único Blob válido
  // -------------------------------------------------------------------------
  async saveClip(): Promise<ClipResult> {
    if (!this.active || !this.recorder || this.chunks.length === 0) {
      return { success: false, error: 'Buffer vazio — aguarde alguns segundos.' };
    }

    // Pede o último pedaço de dados antes de montar o Blob
    this.recorder.requestData();
    await new Promise((r) => setTimeout(r, 300));

    const snapshot  = [...this.chunks];
    const totalMs   = snapshot.length * TIMESLICE_MS;
    const clampedMs = Math.min(totalMs, MAX_MS);

    // Todos os chunks do mesmo recorder formam um stream contínuo e válido
    const merged = new Blob(snapshot.map((c) => c.data), {
      type: this.mimeType || 'video/webm',
    });

    return { success: true, blob: merged, durationMs: clampedMs };
  }

  // -------------------------------------------------------------------------
  // stop — encerra tudo e libera recursos
  // -------------------------------------------------------------------------
  async stop(): Promise<void> {
    this.active = false;
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream   = null;
    this.recorder = null;
    this.chunks   = [];
    await this.releaseWakeLock();
  }

  // -------------------------------------------------------------------------
  // Wake Lock — mantém tela acesa
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

  // Segundos acumulados no buffer (0 a 20)
  get bufferSeconds(): number {
    if (this.chunks.length === 0) return 0;
    const oldest  = this.chunks[0].time;
    const newest  = this.chunks[this.chunks.length - 1].time;
    return Math.min(Math.round((newest - oldest) / 1000), 20);
  }

  get isActive(): boolean { return this.active; }
}

export const cameraService = new CameraService();
