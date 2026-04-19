// =============================================================================
// BiomechanicsScreen — Análise Biomecânica com MediaPipe Pose
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  initPoseLandmarker,
  detectFrame,
  drawPoseFrame,
  disposePoseLandmarker,
  handleSeek,
  type JointAngles,
} from '@services/poseService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadPhase = 'loading-model' | 'ready' | 'error';

interface Props {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || navigator.maxTouchPoints > 0);

function fmtAngle(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v}°`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BiomechanicsScreen({ onBack }: Props) {
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading-model');
  const [videoUrl, setVideoUrl]   = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<0.5 | 1>(1);
  const [currentAngles, setCurrentAngles] = useState<JointAngles | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [zoom, setZoom] = useState(1);

  const ZOOM_LEVELS = [1, 1.5, 2, 3];

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Init MediaPipe on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    initPoseLandmarker()
      .then(() => setLoadPhase('ready'))
      .catch(() => setLoadPhase('error'));

    return () => {
      disposePoseLandmarker();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Sync playback rate
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // -------------------------------------------------------------------------
  // Canvas sizing
  // -------------------------------------------------------------------------
  const syncCanvas = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const rect = v.getBoundingClientRect();
    c.width  = rect.width;
    c.height = rect.height;
  }, []);

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------
  const renderLoop = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.paused || v.ended) return;

    const ctx = c.getContext('2d');
    if (!ctx) return;

    const frame = detectFrame(v, v.currentTime * 1000);
    if (frame) {
      drawPoseFrame(ctx, frame, c.width, c.height, v);
      setCurrentAngles(frame.angles);
    }
    rafRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderLoop);
  }, [renderLoop]);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------
  const loadVideoFile = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentAngles(null);
    cancelAnimationFrame(rafRef.current);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadVideoFile(file);
  };

  // -------------------------------------------------------------------------
  // Video events
  // -------------------------------------------------------------------------
  const handleLoadedMetadata = () => {
    syncCanvas();
    // ResizeObserver to keep canvas in sync
    const v = videoRef.current;
    if (!v) return;
    const ro = new ResizeObserver(syncCanvas);
    ro.observe(v);
    // store on element to clean up on next load
    (v as HTMLVideoElement & { _ro?: ResizeObserver })._ro?.disconnect();
    (v as HTMLVideoElement & { _ro?: ResizeObserver })._ro = ro;
  };

  const handlePlay = () => {
    setIsPlaying(true);
    startLoop();
  };

  const handlePause = () => {
    setIsPlaying(false);
    stopLoop();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    stopLoop();
  };

  const handleSeeked = async () => {
    const v = videoRef.current;
    if (!v) return;
    await handleSeek(v.currentTime * 1000);
    // Draw one frame when paused & seeked
    if (v.paused) {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const frame = detectFrame(v, v.currentTime * 1000);
      if (frame) {
        drawPoseFrame(ctx, frame, c.width, c.height, v);
        setCurrentAngles(frame.angles);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => null);
    } else {
      v.pause();
    }
  };

  const stepFrame = (direction: -1 | 1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + direction * (1 / 30)));
  };

  const toggleRate = () => setPlaybackRate(r => r === 1 ? 0.5 : 1);

  // -------------------------------------------------------------------------
  // Drag & drop (PC)
  // -------------------------------------------------------------------------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) loadVideoFile(file);
  };

  // -------------------------------------------------------------------------
  // Retry
  // -------------------------------------------------------------------------
  const handleRetry = () => {
    setLoadPhase('loading-model');
    initPoseLandmarker()
      .then(() => setLoadPhase('ready'))
      .catch(() => setLoadPhase('error'));
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const angles = currentAngles;

  const anglePanel = (
    <div style={s.anglePanel}>
      <p style={s.anglePanelTitle}>Ângulos Articulares</p>
      <table style={s.angleTable}>
        <thead>
          <tr>
            <th style={s.th}></th>
            <th style={{ ...s.th, color: '#aef359' }}>Esq.</th>
            <th style={{ ...s.th, color: '#4fc3f7' }}>Dir.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...s.td, color: '#4fc3f7' }}>Cotovelo</td>
            <td style={s.tdVal}>{fmtAngle(angles?.elbowLeft)}</td>
            <td style={s.tdVal}>{fmtAngle(angles?.elbowRight)}</td>
          </tr>
          <tr>
            <td style={{ ...s.td, color: '#aef359' }}>Joelho</td>
            <td style={s.tdVal}>{fmtAngle(angles?.kneeLeft)}</td>
            <td style={s.tdVal}>{fmtAngle(angles?.kneeRight)}</td>
          </tr>
          <tr>
            <td style={{ ...s.td, color: '#ffb74d' }}>Quadril</td>
            <td style={s.tdVal}>{fmtAngle(angles?.hipLeft)}</td>
            <td style={s.tdVal}>{fmtAngle(angles?.hipRight)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loadPhase === 'loading-model') {
    return (
      <div style={s.page}>
        <div style={s.centeredBox}>
          <div style={s.spinner} />
          <p style={s.loadingText}>Carregando modelo de IA...</p>
          <p style={s.loadingSub}>MediaPipe Pose Landmarker</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (loadPhase === 'error') {
    return (
      <div style={s.page}>
        <div style={s.centeredBox}>
          <p style={s.errorText}>⚠️ Falha ao carregar o modelo de IA.</p>
          <p style={s.errorSub}>Verifique sua conexão e tente novamente.</p>
          <button onClick={handleRetry} style={s.retryBtn}>Tentar novamente</button>
          <button onClick={onBack} style={s.backBtnSmall}>← Voltar</button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <span style={s.headerTitle}>Análise Biomecânica</span>
        <span style={s.headerSpacer} />
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />

      {/* Body */}
      {isMobile ? (
        // ── Mobile layout ──────────────────────────────────────────────────
        <div style={s.mobileBody}>
          {/* Video area */}
          <div style={s.videoWrapper}>
            <div style={{ ...s.zoomInner, transform: `scale(${zoom})` }}>
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    style={s.video}
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    onSeeked={handleSeeked}
                  />
                  <canvas ref={canvasRef} style={s.canvas} />
                </>
              ) : (
                <div style={s.emptyVideo}>
                  <p style={s.emptyText}>Nenhum vídeo selecionado</p>
                </div>
              )}
            </div>
          </div>

          {/* Pick file button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={s.pickBtn}
          >
            📁 Escolher Vídeo
          </button>

          {/* Controls */}
          {videoUrl && (
            <div style={s.controls}>
              <button onClick={() => stepFrame(-1)} style={s.ctrlBtn}>◀</button>
              <button onClick={togglePlay} style={s.ctrlBtnMain}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={() => stepFrame(1)} style={s.ctrlBtn}>▶▶</button>
              <button onClick={toggleRate} style={s.rateBtn}>
                {playbackRate === 1 ? '1x' : '0.5x'}
              </button>
              <button
                onClick={() => {
                  const idx = ZOOM_LEVELS.indexOf(zoom);
                  setZoom(ZOOM_LEVELS[Math.min(idx + 1, ZOOM_LEVELS.length - 1)]);
                }}
                style={s.zoomBtn}
                disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              >＋</button>
              <button
                onClick={() => {
                  const idx = ZOOM_LEVELS.indexOf(zoom);
                  setZoom(ZOOM_LEVELS[Math.max(idx - 1, 0)]);
                }}
                style={s.zoomBtn}
                disabled={zoom === 1}
              >－</button>
              {zoom > 1 && (
                <span style={s.zoomLabel}>{zoom}x</span>
              )}
            </div>
          )}

          {/* Angle panel */}
          {anglePanel}
        </div>
      ) : (
        // ── Desktop layout ─────────────────────────────────────────────────
        <div style={s.desktopBody}>
          {/* Left: video */}
          <div style={s.desktopLeft}>
            {/* Drag & drop zone or video */}
            {videoUrl ? (
              <div style={s.videoWrapper}>
                <div style={{ ...s.zoomInner, transform: `scale(${zoom})` }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    style={s.video}
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    onSeeked={handleSeeked}
                  />
                  <canvas ref={canvasRef} style={s.canvas} />
                </div>
              </div>
            ) : (
              <div
                style={{
                  ...s.dropZone,
                  borderColor: isDraggingOver ? '#4fc3f7' : 'rgba(255,255,255,0.25)',
                  background: isDraggingOver ? 'rgba(79,195,247,0.08)' : 'rgba(255,255,255,0.03)',
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <p style={s.dropText}>
                  {isDraggingOver ? '📥 Solte o vídeo aqui' : '📁 Arraste um vídeo ou clique abaixo'}
                </p>
                <button onClick={() => fileInputRef.current?.click()} style={s.pickBtn}>
                  Escolher arquivo
                </button>
              </div>
            )}

            {/* Controls */}
            <div style={s.controls}>
              {videoUrl && (
                <button onClick={() => fileInputRef.current?.click()} style={{ ...s.ctrlBtn, fontSize: 12 }}>📁</button>
              )}
              <button onClick={() => stepFrame(-1)} style={s.ctrlBtn}>◀</button>
              <button onClick={togglePlay} style={s.ctrlBtnMain} disabled={!videoUrl}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={() => stepFrame(1)} style={s.ctrlBtn}>▶▶</button>
              <button onClick={toggleRate} style={s.rateBtn}>{playbackRate === 1 ? '1x' : '0.5x'}</button>
              <button
                onClick={() => { const i = ZOOM_LEVELS.indexOf(zoom); setZoom(ZOOM_LEVELS[Math.min(i + 1, ZOOM_LEVELS.length - 1)]); }}
                style={s.zoomBtn} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              >＋</button>
              <button
                onClick={() => { const i = ZOOM_LEVELS.indexOf(zoom); setZoom(ZOOM_LEVELS[Math.max(i - 1, 0)]); }}
                style={s.zoomBtn} disabled={zoom === 1}
              >－</button>
              {zoom > 1 && <span style={s.zoomLabel}>{zoom}x</span>}
            </div>
          </div>

          {/* Right: angles */}
          <div style={s.desktopRight}>
            {anglePanel}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: '#0d0d1a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    gap: 12,
    background: 'rgba(0,0,0,0.4)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#cce0ff',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  headerSpacer: {
    width: 80,
    flexShrink: 0,
  },

  // Centered states (loading / error)
  centeredBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  spinner: {
    width: 48,
    height: 48,
    border: '4px solid rgba(255,255,255,0.15)',
    borderTop: '4px solid #4fc3f7',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: { fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' },
  loadingSub:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 },
  errorText:   { fontSize: 18, fontWeight: 700, margin: 0, color: '#ff6b6b' },
  errorSub:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' },
  retryBtn: {
    padding: '12px 28px',
    borderRadius: 12,
    background: '#4fc3f7',
    border: 'none',
    color: '#000',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  backBtnSmall: {
    padding: '10px 20px',
    borderRadius: 12,
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#cce0ff',
    fontSize: 14,
    cursor: 'pointer',
  },

  // Mobile body
  mobileBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    overflow: 'hidden',
  },

  // Video wrapper
  videoWrapper: {
    position: 'relative',
    width: '100%',
    background: '#000',
    flexShrink: 0,
    minHeight: 220,
    maxHeight: '55vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  zoomInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
    transformOrigin: 'center center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  emptyVideo: {
    width: '100%',
    height: '100%',
    minHeight: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.03)',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
  },

  // Pick file button
  pickBtn: {
    margin: '10px 16px',
    padding: '14px 20px',
    borderRadius: 14,
    background: 'rgba(79,195,247,0.12)',
    border: '1.5px solid #4fc3f7',
    color: '#4fc3f7',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: 'calc(100% - 32px)',
  },

  // Drop zone (PC)
  dropZone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    border: '2px dashed',
    borderRadius: 16,
    minHeight: 300,
    margin: 16,
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    margin: 0,
  },

  // Controls bar
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '10px 16px',
    background: 'rgba(0,0,0,0.3)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  ctrlBtn: {
    padding: '12px 18px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    minWidth: 48,
  },
  ctrlBtnMain: {
    padding: '14px 24px',
    borderRadius: 14,
    background: '#4fc3f7',
    border: 'none',
    color: '#000',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 64,
  },
  rateBtn: {
    padding: '12px 16px',
    borderRadius: 10,
    background: 'rgba(174,243,89,0.15)',
    border: '1.5px solid #aef359',
    color: '#aef359',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 52,
  },
  zoomBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 44,
    lineHeight: 1,
  },
  zoomLabel: {
    color: '#4fc3f7',
    fontSize: 13,
    fontWeight: 700,
    minWidth: 28,
    textAlign: 'center' as const,
  },

  // Angle panel
  anglePanel: {
    padding: '16px',
    background: 'rgba(0,0,0,0.25)',
    flex: 1,
    overflow: 'auto',
  },
  anglePanelTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  angleTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.5)',
  },
  td: {
    padding: '10px 10px',
    fontSize: 14,
    fontWeight: 600,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  tdVal: {
    padding: '10px 10px',
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  },

  // Desktop layout
  desktopBody: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  desktopLeft: {
    flex: '0 0 65%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  desktopRight: {
    flex: '0 0 35%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
};

// Inject keyframe animation for spinner
if (typeof document !== 'undefined') {
  const styleId = 'bio-spin-keyframe';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
}
