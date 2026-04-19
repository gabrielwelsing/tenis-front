// =============================================================================
// COMPARISON SCREEN — Comparativo de vídeos lado a lado com sincronização
// =============================================================================

import React, { useRef, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = 'setup' | 'trim' | 'compare';
type DrawTool = 'pencil' | 'circle' | 'eraser';
type DrawColor = '#ff4444' | '#ffdd00' | '#ffffff';

interface VideoSlot {
  file: File | null;
  url: string | null;
  startTime: number | null;
  endTime: number | null;
}

interface DrawPath {
  tool: DrawTool;
  color: DrawColor;
  points: { x: number; y: number }[];
  circleStart?: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onBack: () => void;
}

export default function ComparisonScreen({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');

  const [slotA, setSlotA] = useState<VideoSlot>({ file: null, url: null, startTime: null, endTime: null });
  const [slotB, setSlotB] = useState<VideoSlot>({ file: null, url: null, startTime: null, endTime: null });

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<0.5 | 1>(1);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawActive, setDrawActive] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('pencil');
  const [drawColor, setDrawColor] = useState<DrawColor>('#ff4444');
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compareAreaRef = useRef<HTMLDivElement>(null);

  const [isNarrating, setIsNarrating] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------------

  const handleFileChange = (slot: 'A' | 'B') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const update = { file, url, startTime: null, endTime: null };
    if (slot === 'A') setSlotA(update);
    else setSlotB(update);
  };

  const bothLoaded = slotA.url !== null && slotB.url !== null;
  const bothMarked =
    slotA.startTime !== null && slotA.endTime !== null &&
    slotB.startTime !== null && slotB.endTime !== null;

  // ---------------------------------------------------------------------------
  // Trim phase — mark start/end on each video
  // ---------------------------------------------------------------------------

  const setSlotTime = (slot: 'A' | 'B', type: 'startTime' | 'endTime', t: number) => {
    const setter = slot === 'A' ? setSlotA : setSlotB;
    setter(prev => ({ ...prev, [type]: t }));
  };

  // ---------------------------------------------------------------------------
  // Comparison phase — playback sync
  // ---------------------------------------------------------------------------

  const startSync = useCallback(() => {
    if (!videoARef.current || !videoBRef.current) return;
    if (slotA.startTime === null || slotB.startTime === null) return;
    if (slotA.endTime === null || slotB.endTime === null) return;

    const va = videoARef.current;
    const vb = videoBRef.current;
    const startA = slotA.startTime;
    const startB = slotB.startTime;
    const endA = slotA.endTime;
    const endB = slotB.endTime;

    va.currentTime = startA;
    vb.currentTime = startB;
    va.playbackRate = playbackRate;
    vb.playbackRate = playbackRate;
    va.play().catch(() => {});
    vb.play().catch(() => {});
    setIsPlaying(true);

    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    syncIntervalRef.current = setInterval(() => {
      if (!va || !vb) return;
      const elapsed = va.currentTime - startA;
      const bExpected = startB + elapsed;
      if (Math.abs(vb.currentTime - bExpected) > 0.1) {
        vb.currentTime = bExpected;
      }
      if (va.currentTime >= endA || vb.currentTime >= endB) {
        va.pause();
        vb.pause();
        setIsPlaying(false);
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      }
    }, 500);
  }, [slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime, playbackRate]);

  const pauseSync = useCallback(() => {
    videoARef.current?.pause();
    videoBRef.current?.pause();
    setIsPlaying(false);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) pauseSync();
    else startSync();
  };

  const handleRestart = () => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    setIsPlaying(false);
    if (videoARef.current && slotA.startTime !== null) videoARef.current.currentTime = slotA.startTime;
    if (videoBRef.current && slotB.startTime !== null) videoBRef.current.currentTime = slotB.startTime;
  };

  const seekBoth = (deltaSeconds: number) => {
    if (!videoARef.current || !videoBRef.current) return;
    if (slotA.startTime === null || slotB.startTime === null) return;
    if (slotA.endTime === null || slotB.endTime === null) return;
    const newA = clamp(videoARef.current.currentTime + deltaSeconds, slotA.startTime, slotA.endTime);
    const elapsed = newA - slotA.startTime;
    videoARef.current.currentTime = newA;
    videoBRef.current.currentTime = clamp(slotB.startTime + elapsed, slotB.startTime, slotB.endTime);
  };

  const toggleRate = () => {
    const next = playbackRate === 1 ? 0.5 : 1;
    setPlaybackRate(next);
    if (videoARef.current) videoARef.current.playbackRate = next;
    if (videoBRef.current) videoBRef.current.playbackRate = next;
  };

  useEffect(() => {
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, []);

  // ---------------------------------------------------------------------------
  // Draw canvas
  // ---------------------------------------------------------------------------

  const redrawCanvas = useCallback((allPaths: DrawPath[], active: DrawPath | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawOne = (path: DrawPath) => {
      if (path.points.length === 0) return;
      ctx.lineWidth = path.tool === 'eraser' ? 20 : 3;
      ctx.strokeStyle = path.tool === 'eraser' ? 'rgba(0,0,0,1)' : path.color;
      ctx.fillStyle = path.color;
      ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (path.tool === 'circle' && path.circleStart && path.points.length > 0) {
        const last = path.points[path.points.length - 1];
        const rx = Math.abs(last.x - path.circleStart.x) / 2;
        const ry = Math.abs(last.y - path.circleStart.y) / 2;
        const cx = (path.circleStart.x + last.x) / 2;
        const cy = (path.circleStart.y + last.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    allPaths.forEach(drawOne);
    if (active) drawOne(active);
  }, []);

  useEffect(() => {
    redrawCanvas(paths, currentPath);
  }, [paths, currentPath, redrawCanvas]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const area = compareAreaRef.current;
    if (!canvas || !area) return;
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;
    redrawCanvas(paths, null);
  }, [paths, redrawCanvas]);

  useEffect(() => {
    if (phase === 'compare') {
      setTimeout(resizeCanvas, 100);
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [phase, resizeCanvas]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const handleDrawStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawActive) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    setIsDrawing(true);
    setCurrentPath({ tool: drawTool, color: drawColor, points: [pt], circleStart: pt });
  };

  const handleDrawMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawActive || !isDrawing || !currentPath) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    setCurrentPath(prev => prev ? { ...prev, points: [...prev.points, pt] } : null);
  };

  const handleDrawEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawActive || !isDrawing || !currentPath) return;
    e.preventDefault();
    setPaths(prev => [...prev, currentPath]);
    setCurrentPath(null);
    setIsDrawing(false);
  };

  const toggleDrawMode = () => {
    if (!drawActive) {
      pauseSync();
    }
    setDrawActive(prev => !prev);
  };

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const undoDraw = () => {
    setPaths(prev => prev.slice(0, -1));
  };

  // ---------------------------------------------------------------------------
  // Voice narration
  // ---------------------------------------------------------------------------

  const handleNarrate = async () => {
    if (isNarrating) {
      mediaRecorder?.stop();
      setIsNarrating(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setNarrationUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setMediaRecorder(mr);
      setIsNarrating(true);
      if (!isPlaying) startSync();
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (phase === 'setup') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button onClick={onBack} style={s.backBtn}>← Voltar</button>
          <h1 style={s.pageTitle}>Comparativo de Vídeos</h1>
        </div>

        <div style={s.infoBanner}>
          💡 Dica: Para comparar corretamente, marque o mesmo momento nos dois vídeos (ex: o início do movimento do saque). Os vídeos vão tocar em sincronia a partir desse ponto.
        </div>

        <div style={s.slotRow}>
          <VideoPickSlot
            label="Vídeo A — Saque do aluno"
            url={slotA.url}
            onChange={handleFileChange('A')}
          />
          <VideoPickSlot
            label="Vídeo B — Saque de referência"
            url={slotB.url}
            onChange={handleFileChange('B')}
          />
        </div>

        <div style={s.setupFooter}>
          <button
            disabled={!bothLoaded}
            style={{ ...s.primaryBtn, opacity: bothLoaded ? 1 : 0.4 }}
            onClick={() => setPhase('trim')}
          >
            ✂️ Marcar pontos de início
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'trim') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button onClick={() => setPhase('setup')} style={s.backBtn}>← Voltar</button>
          <h1 style={s.pageTitle}>Sincronizar Vídeos</h1>
        </div>

        <div style={s.infoBanner}>
          📌 Marque o mesmo gesto nos dois vídeos. Ex: ambos no momento em que a raquete começa a subir.
        </div>

        <div style={s.trimRow}>
          <TrimSlot
            label="A — Aluno"
            videoRef={videoARef}
            url={slotA.url!}
            startTime={slotA.startTime}
            endTime={slotA.endTime}
            onSetStart={(t) => setSlotTime('A', 'startTime', t)}
            onSetEnd={(t) => setSlotTime('A', 'endTime', t)}
          />
          <TrimSlot
            label="B — Referência"
            videoRef={videoBRef}
            url={slotB.url!}
            startTime={slotB.startTime}
            endTime={slotB.endTime}
            onSetStart={(t) => setSlotTime('B', 'startTime', t)}
            onSetEnd={(t) => setSlotTime('B', 'endTime', t)}
          />
        </div>

        <div style={s.setupFooter}>
          <button
            disabled={!bothMarked}
            style={{ ...s.primaryBtn, opacity: bothMarked ? 1 : 0.4 }}
            onClick={() => { pauseSync(); setPhase('compare'); }}
          >
            ▶ Comparar
          </button>
        </div>
      </div>
    );
  }

  // phase === 'compare'
  return (
    <div style={s.comparePage}>
      {/* Header */}
      <div style={s.compareHeader}>
        <button onClick={() => { pauseSync(); setPhase('trim'); }} style={s.backBtn}>← Voltar</button>
        <span style={s.pageTitle}>Comparativo</span>
        <div style={s.rateToggle}>
          <button onClick={toggleRate} style={s.controlBtn}>
            {playbackRate === 1 ? '1x' : '0.5x'}
          </button>
        </div>
      </div>

      {/* Video area */}
      <div ref={compareAreaRef} style={s.compareArea}>
        {/* Video A */}
        <div style={s.videoWrapper}>
          <video ref={videoARef} src={slotA.url!} style={s.video} playsInline />
          <div style={s.videoLabel}>A — Aluno</div>
        </div>
        {/* Video B */}
        <div style={s.videoWrapper}>
          <video ref={videoBRef} src={slotB.url!} style={s.video} playsInline />
          <div style={s.videoLabel}>B — Referência</div>
        </div>

        {/* Draw canvas */}
        <canvas
          ref={canvasRef}
          style={{
            ...s.drawCanvas,
            pointerEvents: drawActive ? 'auto' : 'none',
          }}
          onMouseDown={handleDrawStart}
          onMouseMove={handleDrawMove}
          onMouseUp={handleDrawEnd}
          onTouchStart={handleDrawStart}
          onTouchMove={handleDrawMove}
          onTouchEnd={handleDrawEnd}
        />
      </div>

      {/* Shared playback controls */}
      <div style={s.controls}>
        <button onClick={() => seekBoth(-5)} style={s.controlBtn}>◀◀</button>
        <button onClick={handlePlayPause} style={{ ...s.controlBtn, ...s.playBtn }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => seekBoth(5)} style={s.controlBtn}>▶▶</button>
        <button onClick={handleRestart} style={s.controlBtn}>🔄</button>
        <button
          onClick={toggleDrawMode}
          style={{ ...s.controlBtn, background: drawActive ? '#7b1fa2' : 'rgba(255,255,255,0.12)' }}
        >
          ✏️
        </button>
        <button
          onClick={handleNarrate}
          style={{ ...s.controlBtn, background: isNarrating ? '#c62828' : 'rgba(255,255,255,0.12)' }}
        >
          🎙
        </button>
        {narrationUrl && (
          <a href={narrationUrl} download="narracao.webm" style={s.controlBtn}>⬇️🎙</a>
        )}
      </div>

      {/* Draw tools (visible when drawActive) */}
      {drawActive && (
        <div style={s.drawTools}>
          {(['pencil', 'circle', 'eraser'] as DrawTool[]).map(tool => (
            <button
              key={tool}
              onClick={() => setDrawTool(tool)}
              style={{ ...s.drawToolBtn, border: drawTool === tool ? '2px solid #fff' : '2px solid transparent' }}
            >
              {tool === 'pencil' ? '✏️' : tool === 'circle' ? '⭕' : '🧹'}
            </button>
          ))}
          {(['#ff4444', '#ffdd00', '#ffffff'] as DrawColor[]).map(c => (
            <button
              key={c}
              onClick={() => setDrawColor(c)}
              style={{
                ...s.colorBtn,
                background: c,
                border: drawColor === c ? '3px solid #fff' : '3px solid transparent',
              }}
            />
          ))}
          <button onClick={undoDraw} style={s.drawToolBtn}>↩️</button>
          <button onClick={clearCanvas} style={s.drawToolBtn}>🗑️</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VideoPickSlot({
  label,
  url,
  onChange,
}: {
  label: string;
  url: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={sp.slotBox}>
      <p style={sp.slotLabel}>{label}</p>
      {url ? (
        <video src={url} style={sp.previewVideo} controls playsInline />
      ) : (
        <div style={sp.emptyBox} onClick={() => inputRef.current?.click()}>
          <span style={{ fontSize: 36 }}>📹</span>
          <span style={{ color: '#888', fontSize: 13 }}>Toque para escolher</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <button style={sp.pickBtn} onClick={() => inputRef.current?.click()}>
        {url ? '🔄 Trocar vídeo' : '📁 Escolher vídeo'}
      </button>
    </div>
  );
}

function TrimSlot({
  label,
  videoRef,
  url,
  startTime,
  endTime,
  onSetStart,
  onSetEnd,
}: {
  label: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  url: string;
  startTime: number | null;
  endTime: number | null;
  onSetStart: (t: number) => void;
  onSetEnd: (t: number) => void;
}) {
  const [duration, setDuration] = React.useState(0);

  const handleLoaded = () => {
    const d = videoRef.current?.duration ?? 0;
    if (!d || isNaN(d)) return;
    setDuration(d);
    if (startTime === null) onSetStart(0);
    if (endTime === null) onSetEnd(d);
  };

  const start = startTime ?? 0;
  const end = endTime ?? duration;
  const clip = end - start;

  return (
    <div style={sp.trimBox}>
      <p style={sp.slotLabel}>{label}</p>
      <video
        ref={videoRef}
        src={url}
        style={sp.trimVideo}
        controls
        playsInline
        onLoadedMetadata={handleLoaded}
        onLoadedData={handleLoaded}
      />

      {duration > 0 && (
        <>
          <p style={sp.trimLabel}>Início: {fmtTime(start)}</p>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={start}
            style={sp.slider}
            onChange={e => {
              const t = Math.min(Number(e.target.value), end - 0.5);
              onSetStart(t);
              if (videoRef.current) videoRef.current.currentTime = t;
            }}
          />
          <p style={sp.trimLabel}>Fim: {fmtTime(end)}</p>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={end}
            style={sp.slider}
            onChange={e => {
              const t = Math.max(Number(e.target.value), start + 0.5);
              onSetEnd(t);
              if (videoRef.current) videoRef.current.currentTime = t;
            }}
          />
          <p style={sp.timeInfo}>
            {fmtTime(start)} → {fmtTime(end)}{clip > 0 ? ` (${clip.toFixed(1)}s)` : ''}
          </p>
        </>
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
    display: 'flex',
    flexDirection: 'column',
    color: '#fff',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 16px 8px',
    paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    flex: 1,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 20,
    cursor: 'pointer',
    fontSize: 14,
    minHeight: 44,
  },
  infoBanner: {
    margin: '12px 16px',
    padding: '12px 16px',
    background: 'rgba(79,195,247,0.1)',
    border: '1px solid rgba(79,195,247,0.3)',
    borderRadius: 12,
    color: '#b3e5fc',
    fontSize: 13,
    lineHeight: 1.5,
  },
  slotRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '0 16px',
    flex: 1,
    overflowY: 'auto',
  },
  trimRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '0 16px',
    flex: 1,
    overflowY: 'auto',
  },
  setupFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  primaryBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 14,
    background: '#1565c0',
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
  },

  // Compare phase
  comparePage: {
    height: '100dvh',
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    color: '#fff',
    overflow: 'hidden',
  },
  compareHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
    background: 'rgba(0,0,0,0.6)',
    zIndex: 20,
    flexShrink: 0,
  },
  compareArea: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#000',
  },
  videoLabel: {
    position: 'absolute',
    top: 8,
    left: 10,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 12,
    backdropFilter: 'blur(4px)',
  },
  drawCanvas: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 12px',
    paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
    background: 'rgba(0,0,0,0.7)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  controlBtn: {
    background: 'rgba(255,255,255,0.12)',
    border: 'none',
    color: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
  },
  playBtn: {
    background: '#1565c0',
    width: 52,
    height: 52,
    borderRadius: 26,
    fontSize: 22,
  },
  rateToggle: {},
  drawTools: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.85)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  drawToolBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '2px solid transparent',
    color: '#fff',
    width: 44,
    height: 44,
    borderRadius: 10,
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    cursor: 'pointer',
    border: '3px solid transparent',
  },
};

const sp: Record<string, React.CSSProperties> = {
  slotBox: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  slotLabel: {
    color: '#cce0ff',
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
  },
  emptyBox: {
    height: 160,
    borderRadius: 12,
    border: '2px dashed rgba(255,255,255,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    background: 'rgba(0,0,0,0.3)',
  },
  previewVideo: {
    width: '100%',
    maxHeight: 200,
    borderRadius: 10,
    objectFit: 'contain',
    background: '#000',
  },
  pickBtn: {
    padding: '12px 0',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
    minHeight: 44,
  },
  trimBox: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  trimVideo: {
    width: '100%',
    maxHeight: 200,
    borderRadius: 10,
    background: '#000',
    objectFit: 'contain',
  },
  trimLabel: {
    color: '#cce0ff',
    fontSize: 13,
    margin: 0,
    fontWeight: 600,
  },
  slider: {
    width: '100%',
    accentColor: '#1565c0',
    height: 32,
  },
  timeInfo: {
    color: '#b3e5fc',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },
};
