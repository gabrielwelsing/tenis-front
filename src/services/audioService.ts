// =============================================================================
// AUDIO SERVICE — Gravação de comentário com prioridade Bluetooth
// =============================================================================
// No browser, o roteamento para fone BT é feito via constraints de áudio.
// Ao usar echoCancellation:false e noiseSuppression:false, o browser prefere
// o dispositivo de maior qualidade disponível (fone BT > microfone interno).
// =============================================================================

export interface AudioResult {
  success: boolean;
  blob?: Blob;
  durationMs?: number;
  error?: string;
}

class AudioService {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private startTime = 0;

  // -------------------------------------------------------------------------
  // startRecording — abre o microfone com preferência por Bluetooth
  // -------------------------------------------------------------------------
  async startRecording(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Desabilitar processamentos de voz força o browser a usar o
          // dispositivo de áudio de maior fidelidade (geralmente o BT)
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // channelCount: 1 = mono (suficiente para comentários de voz)
          channelCount: 1,
          sampleRate: 44100,
        },
      });
    } catch {
      // Fallback: tenta com configuração padrão (sem restrições)
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        return false;
      }
    }

    this.chunks = [];
    this.startTime = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100); // coleta chunks a cada 100ms para medição de volume
    return true;
  }

  // -------------------------------------------------------------------------
  // stopRecording — finaliza e retorna o Blob de áudio
  // -------------------------------------------------------------------------
  async stopRecording(): Promise<AudioResult> {
    if (!this.recorder || !this.stream) {
      return { success: false, error: 'Nenhuma gravação ativa.' };
    }

    const durationMs = Date.now() - this.startTime;

    return new Promise((resolve) => {
      this.recorder!.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder!.mimeType });
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.recorder = null;
        resolve({ success: true, blob, durationMs });
      };
      this.recorder!.stop();
    });
  }

  // -------------------------------------------------------------------------
  // cancelRecording — descarta sem salvar
  // -------------------------------------------------------------------------
  cancelRecording(): void {
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }

  // -------------------------------------------------------------------------
  // getVolume — nível de volume atual 0..1 (para animação da UI)
  // Usa AnalyserNode da Web Audio API para leitura em tempo real
  // -------------------------------------------------------------------------
  getVolume(): number {
    if (!this.stream) return 0;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(this.stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      ctx.close();
      return avg / 255;
    } catch {
      return 0;
    }
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }
}

export const audioService = new AudioService();
