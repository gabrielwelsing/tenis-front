// =============================================================================
// BLUETOOTH REMOTE — Captura botão Play/Pause de qualquer controle BT
// =============================================================================
// O browser recebe eventos de mídia de qualquer dispositivo HID conectado:
//   - Fone de ouvido BT (botão central = play/pause)
//   - Controle remoto BT de apresentação
//   - Controle de câmera BT
//   - Qualquer teclado BT com teclas de mídia
//
// Eventos capturados: MediaPlayPause, MediaPlay, MediaPause
// Também captura 'p' como atalho de teclado para testes no desktop.
//
// A MediaSession API registra handlers que o SO chama quando o usuário
// pressiona botões de mídia — funciona mesmo com a tela do Samsung bloqueada
// (enquanto o browser estiver em foreground/ativo).
// =============================================================================

type TriggerCallback = () => void;

const DEBOUNCE_MS = 1500;

class BluetoothRemoteService {
  private onTrigger: TriggerCallback | null = null;
  private lastTrigger = 0;
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;

  // -------------------------------------------------------------------------
  // start — registra os listeners de eventos de mídia
  // -------------------------------------------------------------------------
  start(onTrigger: TriggerCallback): void {
    this.onTrigger = onTrigger;

    // Handler de teclado: captura MediaPlayPause vindo do controle BT
    this.boundHandler = (e: KeyboardEvent) => {
      const isBtButton =
        e.code === 'MediaPlayPause' ||
        e.code === 'MediaPlay'      ||
        e.code === 'MediaPause'     ||
        e.key  === 'p';             // atalho para testar no desktop

      if (isBtButton) {
        e.preventDefault();
        this.fire();
      }
    };
    document.addEventListener('keydown', this.boundHandler);

    // MediaSession API: o SO chama esses handlers quando botões de mídia
    // são pressionados no controle BT (funciona mesmo com tela bloqueada)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play',  () => this.fire());
      navigator.mediaSession.setActionHandler('pause', () => this.fire());

      // Metadados exibidos na notificação do Android quando o app está em background
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Tenis Coach Cam',
        artist: 'Gravando lance...',
        album: 'Pressione play/pause para salvar',
      });
    }
  }

  // -------------------------------------------------------------------------
  // stop — remove todos os listeners
  // -------------------------------------------------------------------------
  stop(): void {
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
      this.boundHandler = null;
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play',  null);
      navigator.mediaSession.setActionHandler('pause', null);
    }

    this.onTrigger = null;
  }

  // -------------------------------------------------------------------------
  // fire — dispara o clipping com debounce
  // -------------------------------------------------------------------------
  private fire(): void {
    const now = Date.now();
    if (now - this.lastTrigger < DEBOUNCE_MS) return;
    this.lastTrigger = now;
    this.onTrigger?.();
  }
}

export const bluetoothRemote = new BluetoothRemoteService();
