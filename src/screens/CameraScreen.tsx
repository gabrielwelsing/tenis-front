// =============================================================================
// CAMERA SCREEN — Tela principal (casca de UI — web)
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { cameraService }    from '@services/cameraService';
import { audioService }     from '@services/audioService';
import { bluetoothRemote }  from '@services/bluetoothRemote';
import { uploadClip }       from '@services/driveService';
import { saveClip }         from '@services/apiService';
import { RecordButton }     from '@components/RecordButton';
import { AudioRecorderModal } from '@components/AudioRecorderModal';

type Phase = 'init' | 'buffering' | 'clipping' | 'audio' | 'uploading' | 'error';

interface AudioState {
  pendingId: string | null;
  pendingVideoBlob: Blob | null;
  pendingVideoDurationMs: number;
  isRecording: boolean;
  elapsed: number;
  volume: number;
}

const INIT_AUDIO: AudioState = {
  pendingId: null, pendingVideoBlob: null, pendingVideoDurationMs: 0,
  isRecording: false, elapsed: 0, volume: 0,
};

export default function CameraScreen({ onGoHistory }: { onGoHistory: () => void }) {
  const videoEl  = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<Phase>('init');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase,      setPhaseState] = useState<Phase>('init');
  const [bufSec,     setBufSec]     = useState(0);
  const [btActive,   setBtActive]   = useState(false);
  const [isSyncing,  setIsSyncing]  = useState(false);
  const [audio,      setAudio]      = useState<AudioState>(INIT_AUDIO);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  // -------------------------------------------------------------------------
  // Inicializa câmera
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!videoEl.current) return;
    cameraService.start(videoEl.current)
      .then(() => setPhase('buffering'))
      .catch(() => setPhase('error'));

    return () => { cameraService.stop(); bluetoothRemote.stop(); };
  }, []);

  // Atualiza contador do buffer a cada segundo
  useEffect(() => {
    if (phase !== 'buffering') return;
    const id = setInterval(() => setBufSec(cameraService.bufferSeconds), 1_000);
    return () => clearInterval(id);
  }, [phase]);

  // Reativa Wake Lock quando a aba volta ao foco
  useEffect(() => {
    const onVisible = () => cameraService.reacquireWakeLockIfNeeded();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // -------------------------------------------------------------------------
  // Bluetooth remote
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase === 'buffering') {
      bluetoothRemote.start(() => {
        setBtActive(true);
        if (phaseRef.current === 'buffering') handleClip();
      });
    } else {
      bluetoothRemote.stop();
    }
  }, [phase]);

  // -------------------------------------------------------------------------
  // Fluxo: salvar lance
  // -------------------------------------------------------------------------
  const handleClip = useCallback(async () => {
    if (phaseRef.current !== 'buffering') return;
    setPhase('clipping');

    const result = await cameraService.saveClip();
    if (!result.success || !result.blob) { setPhase('buffering'); return; }

    const id = uuidv4();
    setAudio({ ...INIT_AUDIO, pendingId: id, pendingVideoBlob: result.blob, pendingVideoDurationMs: result.durationMs ?? 0 });
    setPhase('audio');

    // Inicia gravação de áudio automaticamente
    const started = await audioService.startRecording();
    if (!started) { setPhase('buffering'); return; }

    setAudio((a) => ({ ...a, isRecording: true }));

    let elapsed = 0;
    timerRef.current = setInterval(() => { elapsed++; setAudio((a) => ({ ...a, elapsed })); }, 1_000);
    meterRef.current = setInterval(() => {
      setAudio((a) => ({ ...a, volume: audioService.getVolume() }));
    }, 100);
  }, []);

  // -------------------------------------------------------------------------
  // Fluxo: salvar áudio → upload Drive → salvar metadados no backend
  // -------------------------------------------------------------------------
  const handleAudioStop = useCallback(async () => {
    clearInterval(timerRef.current!);
    clearInterval(meterRef.current!);
    setPhase('uploading');
    setIsSyncing(true);

    const audioResult = await audioService.stopRecording();
    const { pendingId, pendingVideoBlob, pendingVideoDurationMs } = audio;
    if (!pendingId || !pendingVideoBlob) { setPhase('buffering'); return; }

    const timestamp = Date.now();
    try {
      const { driveVideoUrl, driveAudioUrl } = await uploadClip({
        videoBlob: pendingVideoBlob,
        audioBlob: audioResult.blob ?? null,
        timestamp,
      });
      await saveClip({
        id: pendingId,
        timestamp,
        videoDurationMs: pendingVideoDurationMs,
        audioDurationMs: audioResult.durationMs ?? null,
        driveVideoUrl,
        driveAudioUrl,
      });
    } catch (e) {
      console.error('[CameraScreen] Erro no upload:', e);
    } finally {
      setIsSyncing(false);
    }

    setAudio(INIT_AUDIO);
    setPhase('buffering');
  }, [audio]);

  const handleAudioCancel = useCallback(async () => {
    clearInterval(timerRef.current!);
    clearInterval(meterRef.current!);
    audioService.cancelRecording();
    setAudio(INIT_AUDIO);
    setPhase('buffering');
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const statusLabel: Record<Phase, string> = {
    init:      'Iniciando...',
    buffering: 'BUFFER ATIVO',
    clipping:  'Salvando lance...',
    audio:     'Gravando comentário',
    uploading: 'Enviando para Drive...',
    error:     'ERRO DE CÂMERA',
  };
  const dotColor: Partial<Record<Phase, string>> = {
    buffering: '#44ff88',
    uploading: '#ffcc00',
    error:     '#ff4444',
  };

  return (
    <div style={styles.container}>
      {/* Preview da câmera — tela cheia */}
      <video ref={videoEl} autoPlay playsInline muted style={styles.video} />

      {/* Overlay de controles */}
      <div style={styles.overlay}>

        {/* Barra de status superior */}
        <div style={styles.topBar}>
          <StatusPill color={dotColor[phase] ?? '#ffaa00'} label={statusLabel[phase]} />
          <StatusPill color={btActive ? '#4fc3f7' : '#555'} label={btActive ? 'REMOTE BT' : 'SEM REMOTE'} />
          {isSyncing && <StatusPill color="#ffcc00" label="ENVIANDO..." />}
        </div>

        {/* Botão de histórico (canto superior direito) */}
        <button onClick={onGoHistory} style={styles.historyBtn}>Histórico</button>

        {/* Botão de clipping (canto direito, fácil acesso) */}
        <div style={styles.controls}>
          <RecordButton
            onPress={handleClip}
            disabled={phase !== 'buffering'}
            bufferSeconds={bufSec}
          />
        </div>

      </div>

      {/* Modal de áudio */}
      <AudioRecorderModal
        visible={phase === 'audio'}
        isRecording={audio.isRecording}
        volume={audio.volume}
        elapsedSeconds={audio.elapsed}
        onStop={handleAudioStop}
        onCancel={handleAudioCancel}
      />
    </div>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <div style={pillStyles.pill}>
      <div style={{ ...pillStyles.dot, background: color }} />
      <span style={pillStyles.text}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { position: 'relative', width: '100vw', height: '100dvh', background: '#000', overflow: 'hidden' },
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  overlay: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: 16 },
  topBar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  controls: { position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)' },
  historyBtn: {
    position: 'absolute', top: 16, right: 16,
    background: '#ffffff22', border: '1px solid #ffffff44',
    color: '#fff', padding: '6px 14px', borderRadius: 20,
    fontSize: 12, cursor: 'pointer',
  },
};
const pillStyles: Record<string, React.CSSProperties> = {
  pill: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#00000088', padding: '6px 12px', borderRadius: 20,
  },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  text: { color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 1 },
};
