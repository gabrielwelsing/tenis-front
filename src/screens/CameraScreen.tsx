// =============================================================================
// CAMERA SCREEN — Buffer circular com duração configurável
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SaveMode } from '../App';
import { cameraService, VALID_DURATIONS, type BufferDuration } from '@services/cameraService';
import { audioService }    from '@services/audioService';
import { bluetoothRemote } from '@services/bluetoothRemote';
import { uploadVideo, uploadAudio } from '@services/driveService';
import { saveVideoLocally, saveAudioLocally } from '@services/localSaveService';
import { saveVideo, saveAudio } from '@services/apiService';
import { AudioRecorderModal } from '@components/AudioRecorderModal';

type VideoPhase = 'init' | 'buffering' | 'saving_video' | 'error';
type AudioPhase = 'idle' | 'recording' | 'saving_audio';

export default function CameraScreen({
  saveMode,
  username,
  onGoHistory,
  onLogout,
}: {
  saveMode: SaveMode;
  username: string;
  onGoHistory: () => void;
  onLogout: () => void;
}) {
  const videoEl       = useRef<HTMLVideoElement>(null);
  const videoPhaseRef = useRef<VideoPhase>('init');

  const [videoPhase, setVideoPhaseState] = useState<VideoPhase>('init');
  const [audioPhase, setAudioPhase]      = useState<AudioPhase>('idle');
  const [bufSec,     setBufSec]          = useState(0);
  const [lastSaved,  setLastSaved]       = useState<string | null>(null);
  const [isSyncing,  setIsSyncing]       = useState(false);
  const [showSettings, setShowSettings]  = useState(false);
  const [maxSec,     setMaxSec]          = useState<BufferDuration>(cameraService.maxSeconds);

  const [elapsed, setElapsed] = useState(0);
  const [volume,  setVolume]  = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // currentVideoRef: ID/nome do vídeo mais recente — para vincular o áudio corretamente
  const currentVideoRef = useRef<string | null>(null);

  const setVideoPhase = (p: VideoPhase) => { videoPhaseRef.current = p; setVideoPhaseState(p); };

  // ── Inicializa câmera ──────────────────────────────────────────────────────
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

  // ── Engrenagem — altera duração do buffer ──────────────────────────────────
  const handleSetDuration = (sec: BufferDuration) => {
    cameraService.setMaxDuration(sec);
    setMaxSec(sec);
    setShowSettings(false);
  };

  // ── BOTÃO VÍDEO ────────────────────────────────────────────────────────────
  const handleSaveVideo = useCallback(async () => {
    if (videoPhaseRef.current !== 'buffering') return;
    setVideoPhase('saving_video');
    setIsSyncing(true);

    const result = await cameraService.saveClip();
    if (!result.success || !result.blob) {
      setVideoPhase('buffering'); setIsSyncing(false); return;
    }

    const timestamp = Date.now();

    if (saveMode === 'local') {
      const lance = saveVideoLocally(result.blob, result.durationMs ?? 0);
      currentVideoRef.current = lance;          // guarda para vincular áudio
      setLastSaved(lance);
    } else {
      try {
        const videoId       = uuidv4();
        const driveVideoUrl = await uploadVideo(result.blob, timestamp);
        await saveVideo({ id: videoId, timestamp, videoDurationMs: result.durationMs ?? 0, driveVideoUrl });
        currentVideoRef.current = videoId;      // guarda UUID para vincular áudio
        setLastSaved(new Date(timestamp).toLocaleTimeString('pt-BR'));
      } catch (e) {
        console.error('[Video] Erro no upload Drive:', e);
        setLastSaved('Erro no upload');
      }
    }

    setIsSyncing(false);
    setVideoPhase('buffering');
  }, [saveMode]);

  // ── BOTÃO ÁUDIO ────────────────────────────────────────────────────────────
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
        // Usa o nome do vídeo mais recente (currentVideoRef) — vínculo garantido
        const lance = currentVideoRef.current ?? `lance_audio_${timestamp}`;
        saveAudioLocally(result.blob, lance, result.durationMs ?? 0);
      } else {
        try {
          const driveAudioUrl = await uploadAudio(result.blob, timestamp);
          await saveAudio({
            timestamp,
            audioDurationMs: result.durationMs ?? 0,
            driveAudioUrl,
            videoId: currentVideoRef.current ?? undefined, // vincula ao vídeo exato
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

  // ── Render ─────────────────────────────────────────────────────────────────
  const videoDisabled = videoPhase !== 'buffering' || bufSec < 5;
  const audioDisabled = audioPhase !== 'idle' || videoPhase === 'init';

  return (
    <div style={s.container}>
      <video ref={videoEl} autoPlay playsInline muted style={s.video} />

      <div style={s.overlay}>

        {/* ── Top bar ── */}
        <div style={s.topBar}>
          <Pill color={videoPhase === 'buffering' ? '#44ff88' : '#ffaa00'}>
            {videoPhase === 'buffering'
              ? `BUFFER ${bufSec}s / ${maxSec}s`
              : videoPhase === 'saving_video' ? 'SALVANDO...' : 'INICIANDO...'}
          </Pill>
          {isSyncing && <Pill color="#ffcc00">{saveMode === 'local' ? 'BAIXANDO...' : 'ENVIANDO...'}</Pill>}
          {lastSaved && <Pill color="#4fc3f7">{saveMode === 'local' ? `✓ ${lastSaved}` : `✓ ${lastSaved}`}</Pill>}
          <Pill color={saveMode === 'drive' ? '#1a73e8' : '#2e7d32'}>
            {saveMode === 'drive' ? 'DRIVE' : username || 'LOCAL'}
          </Pill>
        </div>

        {/* ── Botões de cabeçalho ── */}
        <div style={s.headerBtns}>
          <button onClick={onGoHistory}       style={s.headerBtn}>Histórico</button>
          <button onClick={() => setShowSettings(true)} style={s.headerBtn}>⚙️</button>
          <button onClick={onLogout}          style={s.headerBtn}>Sair</button>
        </div>

        {/* ── Botões de gravação ── */}
        <div style={s.controls}>

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
                filter:  videoDisabled ? 'grayscale(0.6)' : 'none',
              }}
            >
              <div style={s.circleBtnInner} />
            </button>
            <span style={s.btnHint}>
              {bufSec < 5 ? `aguardando...\n${bufSec}s / 5s` : `últimos ${maxSec}s`}
            </span>
          </div>

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
                filter:  audioDisabled ? 'grayscale(0.6)' : 'none',
              }}
            >
              <span style={{ fontSize: 28 }}>🎙</span>
            </button>
            <span style={s.btnHint}>gravar{'\n'}comentário</span>
          </div>

        </div>
      </div>

      {/* ── Modal de configurações ── */}
      {showSettings && (
        <div style={s.settingsOverlay} onClick={() => setShowSettings(false)}>
          <div style={s.settingsCard} onClick={(e) => e.stopPropagation()}>
            <p style={s.settingsTitle}>Duração do vídeo</p>
            <p style={s.settingsSub}>Quantos segundos salvar ao pressionar LANCE</p>
            <div style={s.durationRow}>
              {VALID_DURATIONS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => handleSetDuration(sec)}
                  style={{
                    ...s.durationBtn,
                    background: maxSec === sec ? '#ff4444' : 'rgba(255,255,255,0.08)',
                    border:     maxSec === sec ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    fontWeight: maxSec === sec ? 700 : 400,
                  }}
                >
                  {sec}s
                </button>
              ))}
            </div>
            <button onClick={() => setShowSettings(false)} style={s.settingsClose}>Fechar</button>
          </div>
        </div>
      )}

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#000000aa', padding: '6px 12px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{children}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { position: 'relative', width: '100vw', height: '100dvh', background: '#000', overflow: 'hidden' },
  video:     { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  overlay:   {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    padding: 16, paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
  },
  topBar:    { display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100% - 120px)' },

  headerBtns: { position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 },
  headerBtn: {
    background: '#00000088', border: '1px solid #ffffff33', color: '#fff',
    padding: '8px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
    minHeight: 36, backdropFilter: 'blur(4px)',
  },

  controls:       { position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center' },
  btnGroup:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  btnLabel:       { color: '#ffffffdd', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 },
  btnHint:        { color: '#ffffffaa', fontSize: 11, textAlign: 'center', whiteSpace: 'pre-line', maxWidth: 90 },
  circleBtn:      { width: 76, height: 76, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .2s, filter .2s, box-shadow .2s' },
  circleBtnInner: { width: 54, height: 54, borderRadius: '50%', background: '#fff' },

  // ── Settings Modal
  settingsOverlay: {
    position: 'fixed', inset: 0, background: '#000000bb', zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  settingsCard: {
    width: '100%', maxWidth: 420, background: '#1a1a2e',
    borderRadius: '24px 24px 0 0', padding: 32,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  settingsTitle: { color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 },
  settingsSub:   { color: '#888', fontSize: 13, margin: 0, textAlign: 'center' },
  durationRow:   { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  durationBtn: {
    padding: '14px 22px', borderRadius: 14, color: '#fff',
    fontSize: 16, cursor: 'pointer', minWidth: 72, textAlign: 'center' as const,
    transition: 'background .15s',
  },
  settingsClose: {
    marginTop: 8, padding: '12px 32px', borderRadius: 14,
    background: 'none', border: '1px solid #444', color: '#aaa',
    fontSize: 14, cursor: 'pointer',
  },
};
