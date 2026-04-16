// =============================================================================
// CAMERA SCREEN — Suporta saveMode: 'drive' (Google) ou 'local' (ADM)
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SaveMode } from '../App';
import { cameraService }   from '@services/cameraService';
import { audioService }    from '@services/audioService';
import { bluetoothRemote } from '@services/bluetoothRemote';
import { uploadVideo, uploadAudio } from '@services/driveService';
import { saveVideoLocally, saveAudioLocally } from '@services/localSaveService';
import { saveVideo, saveAudio }     from '@services/apiService';
import { AudioRecorderModal }       from '@components/AudioRecorderModal';

type VideoPhase = 'init' | 'buffering' | 'saving_video' | 'error';
type AudioPhase = 'idle' | 'recording' | 'saving_audio';

export default function CameraScreen({
  saveMode,
  onGoHistory,
}: {
  saveMode: SaveMode;
  onGoHistory: () => void;
}) {
  const videoEl       = useRef<HTMLVideoElement>(null);
  const videoPhaseRef = useRef<VideoPhase>('init');

  const [videoPhase, setVideoPhaseState] = useState<VideoPhase>('init');
  const [audioPhase, setAudioPhase]      = useState<AudioPhase>('idle');
  const [bufSec,     setBufSec]          = useState(0);
  const [lastSaved,  setLastSaved]       = useState<string | null>(null);
  const [isSyncing,  setIsSyncing]       = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [volume,  setVolume]  = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentLanceRef = useRef<string | null>(null);

  const setVideoPhase = (p: VideoPhase) => { videoPhaseRef.current = p; setVideoPhaseState(p); };

  // -------------------------------------------------------------------------
  // Inicializa câmera
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!videoEl.current) return;
    cameraService.start(videoEl.current)
      .then(() => setVideoPhase('buffering'))
      .catch(() => setVideoPhase('error'));

    return () => { cameraService.stop(); bluetoothRemote.stop(); };
  }, []);

  useEffect(() => {
    if (videoPhase !== 'buffering') return;
    const id = setInterval(() => setBufSec(cameraService.bufferSeconds), 500);
    return () => clearInterval(id);
  }, [videoPhase]);

  useEffect(() => {
    const fn = () => cameraService.reacquireWakeLockIfNeeded();
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, []);

  useEffect(() => {
    if (videoPhase === 'buffering') {
      bluetoothRemote.start(() => {
        if (videoPhaseRef.current === 'buffering') handleSaveVideo();
      });
    } else {
      bluetoothRemote.stop();
    }
  }, [videoPhase]);

  // -------------------------------------------------------------------------
  // BOTÃO VÍDEO
  // -------------------------------------------------------------------------
  const handleSaveVideo = useCallback(async () => {
    if (videoPhaseRef.current !== 'buffering') return;
    setVideoPhase('saving_video');
    setIsSyncing(true);

    const result = await cameraService.saveClip();
    if (!result.success || !result.blob) {
      setVideoPhase('buffering');
      setIsSyncing(false);
      return;
    }

    const timestamp = Date.now();

    if (saveMode === 'local') {
      const lance = saveVideoLocally(result.blob, result.durationMs ?? 0);
      currentLanceRef.current = lance;
      setLastSaved(lance);
    } else {
      try {
        const driveVideoUrl = await uploadVideo(result.blob, timestamp);
        await saveVideo({
          id: uuidv4(),
          timestamp,
          videoDurationMs: result.durationMs ?? 0,
          driveVideoUrl,
        });
        setLastSaved(new Date(timestamp).toLocaleTimeString('pt-BR'));
        currentLanceRef.current = String(timestamp);
      } catch (e) {
        console.error('[Video] Erro no upload Drive:', e);
        setLastSaved('Erro no upload');
      }
    }

    setIsSyncing(false);
    setVideoPhase('buffering');
  }, [saveMode]);

  // -------------------------------------------------------------------------
  // BOTÃO ÁUDIO
  // -------------------------------------------------------------------------
  const handleStartAudio = useCallback(async () => {
    if (audioPhase !== 'idle') return;
    const started = await audioService.startRecording();
    if (!started) return;

    setAudioPhase('recording');
    setElapsed(0);
    let secs = 0;
    timerRef.current = setInterval(() => { secs++; setElapsed(secs); }, 1_000);
    meterRef.current = setInterval(() => setVolume(audioService.getVolume()), 100);
  }, [audioPhase]);

  const handleStopAudio = useCallback(async () => {
    clearInterval(timerRef.current!);
    clearInterval(meterRef.current!);
    setAudioPhase('saving_audio');
    setIsSyncing(true);

    const result    = await audioService.stopRecording();
    const timestamp = Date.now();

    if (result.success && result.blob) {
      if (saveMode === 'local') {
        const lance = currentLanceRef.current ?? `lance_audio_${timestamp}`;
        saveAudioLocally(result.blob, lance, result.durationMs ?? 0);
      } else {
        try {
          const driveAudioUrl = await uploadAudio(result.blob, timestamp);
          await saveAudio({
            timestamp,
            audioDurationMs: result.durationMs ?? 0,
            driveAudioUrl,
          });
        } catch (e) {
          console.error('[Audio] Erro no upload Drive:', e);
        }
      }
    }

    setIsSyncing(false);
    setAudioPhase('idle');
  }, [saveMode]);

  const handleCancelAudio = useCallback(() => {
    clearInterval(timerRef.current!);
    clearInterval(meterRef.current!);
    audioService.cancelRecording();
    setAudioPhase('idle');
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const videoDisabled = videoPhase !== 'buffering' || bufSec < 5;
  const audioDisabled = audioPhase !== 'idle' || videoPhase === 'init';

  return (
    <div style={s.container}>
      <video ref={videoEl} autoPlay playsInline muted style={s.video} />

      <div style={s.overlay}>
        {/* Status */}
        <div style={s.topBar}>
          <Pill color={videoPhase === 'buffering' ? '#44ff88' : '#ffaa00'}>
            {videoPhase === 'buffering'
              ? `BUFFER ${bufSec}s / 20s`
              : videoPhase === 'saving_video' ? 'SALVANDO...' : 'INICIANDO...'}
          </Pill>
          {isSyncing && (
            <Pill color="#ffcc00">
              {saveMode === 'local' ? 'BAIXANDO...' : 'ENVIANDO...'}
            </Pill>
          )}
          {lastSaved && (
            <Pill color="#4fc3f7">
              {saveMode === 'local' ? `✓ ${lastSaved} salvo` : `✓ salvo às ${lastSaved}`}
            </Pill>
          )}
          <Pill color={saveMode === 'drive' ? '#1a73e8' : '#2e7d32'}>
            {saveMode === 'drive' ? 'DRIVE' : 'LOCAL'}
          </Pill>
        </div>

        <button onClick={onGoHistory} style={s.histBtn}>Histórico</button>

        {/* Botões */}
        <div style={s.controls}>

          {/* LANCE — vídeo retroativo */}
          <div style={s.btnGroup}>
            <span style={s.btnLabel}>LANCE</span>
            <button
              onClick={handleSaveVideo}
              disabled={videoDisabled}
              style={{
                ...s.circleBtn,
                background: '#ff4444',
                boxShadow: videoDisabled ? 'none' : '0 0 24px #ff444488',
                opacity: videoDisabled ? 0.4 : 1,
                filter: videoDisabled ? 'grayscale(0.6)' : 'none',
              }}
            >
              <div style={s.circleBtnInner} />
            </button>
            <span style={s.btnHint}>
              {bufSec < 5 ? `aguardando...\n${bufSec}s / 5s` : 'últimos 20s'}
            </span>
          </div>

          {/* COMENTÁRIO — áudio separado */}
          <div style={s.btnGroup}>
            <span style={s.btnLabel}>COMENTÁRIO</span>
            <button
              onClick={handleStartAudio}
              disabled={audioDisabled}
              style={{
                ...s.circleBtn,
                background: '#1a73e8',
                boxShadow: audioDisabled ? 'none' : '0 0 24px #1a73e888',
                opacity: audioDisabled ? 0.4 : 1,
                filter: audioDisabled ? 'grayscale(0.6)' : 'none',
              }}
            >
              <span style={{ fontSize: 28 }}>🎙</span>
            </button>
            <span style={s.btnHint}>gravar{'\n'}comentário</span>
          </div>

        </div>
      </div>

      <AudioRecorderModal
        visible={audioPhase === 'recording' || audioPhase === 'saving_audio'}
        isRecording={audioPhase === 'recording'}
        volume={volume}
        elapsedSeconds={elapsed}
        onStop={handleStopAudio}
        onCancel={handleCancelAudio}
      />
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: '#000000aa', padding: '6px 12px', borderRadius: 20,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{children}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative', width: '100vw', height: '100dvh',
    background: '#000', overflow: 'hidden',
  },
  video: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
  },
  overlay: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    padding: 16,
    paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
  },
  topBar: { display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100% - 100px)' },
  histBtn: {
    position: 'absolute', top: 16, right: 16,
    background: '#00000088', border: '1px solid #ffffff33',
    color: '#fff', padding: '10px 18px',
    borderRadius: 20, fontSize: 13, cursor: 'pointer',
    minHeight: 44, backdropFilter: 'blur(4px)',
  },
  controls: {
    position: 'absolute', right: 24, top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center',
  },
  btnGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  btnLabel: { color: '#ffffffdd', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 },
  btnHint:  { color: '#ffffffaa', fontSize: 11, textAlign: 'center', whiteSpace: 'pre-line', maxWidth: 90 },
  circleBtn: {
    width: 76, height: 76, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity .2s, filter .2s, box-shadow .2s',
  },
  circleBtnInner: { width: 54, height: 54, borderRadius: '50%', background: '#fff' },
};
