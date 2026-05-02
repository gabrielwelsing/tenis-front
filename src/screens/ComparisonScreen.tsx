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

// Draw a video frame into a rectangle, maintaining aspect ratio (letterbox/pillarbox)
function drawVideoToRect(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const va = vw / vh;
  const ca = w / h;
  let dx = x, dy = y, dw = w, dh = h;
  if (va > ca) {
    dh = w / va;
    dy = y + (h - dh) / 2;
  } else {
    dw = h * va;
    dx = x + (w - dw) / 2;
  }
  ctx.drawImage(video, dx, dy, dw, dh);
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
  const syncRAFRef = useRef<number | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawActive, setDrawActive] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('pencil');
  const [drawColor, setDrawColor] = useState<DrawColor>('#ff4444');
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);       // draw tools overlay
  const displayCanvasRef = useRef<HTMLCanvasElement>(null); // video display
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

  const stopSyncRAF = useCallback(() => {
    if (syncRAFRef.current !== null) {
      cancelAnimationFrame(syncRAFRef.current);
      syncRAFRef.current = null;
    }
  }, []);

  const startSync = useCallback(() => {
    if (!videoARef.current || !videoBRef.current) return;
    if (slotA.startTime === null || slotB.startTime === null) return;
    if (slotA.endTime === null || slotB.endTime === null) return;

    const va = videoARef.current;
    const vb = videoBRef.current;
    const startA = slotA.startTime;
    const startB = slotB.startTime;
    const endA   = slotA.endTime;
    const endB   = slotB.endTime;
    const rate   = playbackRate;

    stopSyncRAF();

    va.currentTime = startA;
    vb.currentTime = startB;
    va.playbackRate = rate;
    vb.playbackRate = rate;

    // Play both in the same tick (required for iOS gesture policy)
    Promise.all([va.play(), vb.play()]).catch(() => {});
    setIsPlaying(true);

    // RAF loop — draws both videos to canvas so iOS "two simultaneous videos" restriction is bypassed.
    // We never check .paused here because it would fire before the async play() resolves, stopping
    // both videos on the very first frame. Instead we only check the end condition.
    const tick = () => {
      // Draw both videos into the display canvas
      const dc = displayCanvasRef.current;
      if (dc) {
        const ctx = dc.getContext('2d');
        if (ctx) {
          const w = dc.width;
          const h = dc.height;
          const halfH = Math.floor(h / 2);

          // Black fill + video A in top half
          if (va.readyState >= 2) drawVideoToRect(ctx, va, 0, 0, w, halfH);
          else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, halfH); }

          // Video B in bottom half
          if (vb.readyState >= 2) drawVideoToRect(ctx, vb, 0, halfH, w, h - halfH);
          else { ctx.fillStyle = '#000'; ctx.fillRect(0, halfH, w, h - halfH); }

          // Separator line
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(0, halfH - 1, w, 2);

          // Label A
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.roundRect(8, 8, 88, 22, 11);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('A — Aluno', 14, 23);

          // Label B
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.roundRect(8, halfH + 8, 108, 22, 11);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText('B — Referência', 14, halfH + 23);
        }
      }

      // End condition — use ended flag or time check
      if (va.ended || vb.ended || va.currentTime >= endA || vb.currentTime >= endB) {
        va.pause(); vb.pause();
        setIsPlaying(false);
        return;
      }

      // Drift correction: adjust vb playback rate only, never seek
      const elapsed   = va.currentTime - startA;
      const bExpected = startB + elapsed;
      const drift     = vb.currentTime - bExpected; // positive = vb ahead
      if (Math.abs(drift) < 0.15) {
        vb.playbackRate = rate;
      } else if (drift > 0) {
        vb.playbackRate = rate * 0.85; // slow down vb
      } else {
        vb.playbackRate = rate * 1.15; // speed up vb
      }
      syncRAFRef.current = requestAnimationFrame(tick);
    };
    syncRAFRef.current = requestAnimationFrame(tick);
  }, [slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime, playbackRate, stopSyncRAF]);

  const pauseSync = useCallback(() => {
    videoARef.current?.pause();
    videoBRef.current?.pause();
    setIsPlaying(false);
    stopSyncRAF();
  }, [stopSyncRAF]);

  const handlePlayPause = () => {
    if (isPlaying) pauseSync();
    else startSync();
  };

  const handleRestart = () => {
    pauseSync();
    if (videoARef.current && slotA.startTime !== null) videoARef.current.currentTime = slotA.startTime;
    if (videoBRef.current && slotB.startTime !== null) videoBRef.current.currentTime = slotB.startTime;
  };

  const seekBoth = (deltaSeconds: number) => {
    if (!videoARef.current || !videoBRef.current) return;
    if (slotA.startTime === null || slotB.startTime === null) return;
    if (slotA.endTime === null || slotB.endTime === null) return;
    const wasPlaying = isPlaying;
    pauseSync();
    const newA = clamp(videoARef.current.currentTime + deltaSeconds, slotA.startTime, slotA.endTime);
    const elapsed = newA - slotA.startTime;
    videoARef.current.currentTime = newA;
    videoBRef.current.currentTime = clamp(slotB.startTime + elapsed, slotB.startTime, slotB.endTime);
    if (wasPlaying) setTimeout(() => startSync(), 150);
  };

  const toggleRate = () => {
    const next = playbackRate === 1 ? 0.5 : 1;
    setPlaybackRate(next);
    if (videoARef.current) videoARef.current.playbackRate = next;
    if (videoBRef.current) videoBRef.current.playbackRate = next;
  };

  useEffect(() => { return () => stopSyncRAF(); }, [stopSyncRAF]);

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

  const resizeDisplayCanvas = useCallback(() => {
    const canvas = displayCanvasRef.current;
    const area = compareAreaRef.current;
    if (!canvas || !area) return;
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;
  }, []);

  useEffect(() => {
    if (phase === 'compare') {
      setTimeout(() => { resizeCanvas(); resizeDisplayCanvas(); }, 100);
      window.addEventListener('resize', resizeCanvas);
      window.addEventListener('resize', resizeDisplayCanvas);
      return () => {
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('resize', resizeDisplayCanvas);
      };
    }
  }, [phase, resizeCanvas, resizeDisplayCanvas]);

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
        <div style={s.bgGlow1} />
        <div style={s.bgGlow2} />

        <div style={s.topBar}>
          <button onClick={onBack} style={s.backBtn}>‹</button>
          <div style={s.titleBlock}>
            <h1 style={s.pageTitle}>Comparativo de Vídeos</h1>
            <p style={s.pageSub}>Sincronize dois vídeos e analise o movimento lado a lado</p>
          </div>
          <div style={s.headerSpacer} />
        </div>

        <div style={s.heroCard}>
          <span style={s.heroKicker}>PASSO 1</span>
          <h2 style={s.heroTitle}>Escolha os dois vídeos</h2>
          <p style={s.heroText}>
            Use um vídeo do aluno e outro de referência. Depois marque o mesmo gesto nos dois vídeos.
          </p>
        </div>

        <div style={s.infoBanner}>
          Para comparar corretamente, marque o mesmo momento nos dois vídeos, como o início do movimento do saque.
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
            style={{ ...s.primaryBtn, opacity: bothLoaded ? 1 : 0.42 }}
            onClick={() => setPhase('trim')}
          >
            Marcar pontos de início
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'trim') {
    return (
      <div style={s.page}>
        <div style={s.bgGlow1} />
        <div style={s.bgGlow2} />

        <div style={s.topBar}>
          <button onClick={() => setPhase('setup')} style={s.backBtn}>‹</button>
          <div style={s.titleBlock}>
            <h1 style={s.pageTitle}>Sincronizar Vídeos</h1>
            <p style={s.pageSub}>Defina início e fim do trecho de comparação</p>
          </div>
          <div style={s.headerSpacer} />
        </div>

        <div style={s.heroCard}>
          <span style={s.heroKicker}>PASSO 2</span>
          <h2 style={s.heroTitle}>Marque o mesmo gesto</h2>
          <p style={s.heroText}>
            Ajuste o início e o fim dos dois vídeos para que a comparação fique sincronizada.
          </p>
        </div>

        <div style={s.infoBanner}>
          Exemplo: marque os dois vídeos no momento em que a raquete começa a subir.
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
            style={{ ...s.primaryBtn, opacity: bothMarked ? 1 : 0.42 }}
            onClick={() => { pauseSync(); setPhase('compare'); }}
          >
            Comparar vídeos
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
        <button onClick={() => { pauseSync(); setPhase('trim'); }} style={s.compareBackBtn}>‹</button>
        <div style={s.compareTitleBlock}>
          <span style={s.compareTitle}>Comparativo</span>
          <span style={s.compareSub}>Aluno x Referência</span>
        </div>
        <div style={s.rateToggle}>
          <button onClick={toggleRate} style={s.rateBtn}>
            {playbackRate === 1 ? '1x' : '0.5x'}
          </button>
        </div>
      </div>

      {/* Video area */}
      <div ref={compareAreaRef} style={s.compareArea}>
        {/* Hidden video sources — full-size so iOS allocates decode buffer; muted so both can play simultaneously */}
        <video ref={videoARef} src={slotA.url!} style={s.hiddenVideo} playsInline muted />
        <video ref={videoBRef} src={slotB.url!} style={s.hiddenVideo} playsInline muted />

        {/* Display canvas — renders both videos in RAF loop */}
        <canvas ref={displayCanvasRef} style={s.displayCanvas} />

        {/* Draw tools overlay canvas */}
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
        <button onClick={handleRestart} style={s.controlBtn}>↺</button>
        <button
          onClick={toggleDrawMode}
          style={{ ...s.controlBtn, ...(drawActive ? s.controlBtnActive : {}) }}
        >
          ✏️
        </button>
        <button
          onClick={handleNarrate}
          style={{ ...s.controlBtn, ...(isNarrating ? s.recordingBtn : {}) }}
        >
          🎙
        </button>
        {narrationUrl && (
          <a href={narrationUrl} download="narracao.webm" style={s.controlBtn}>⬇️</a>
        )}
      </div>

      {/* Draw tools (visible when drawActive) */}
      {drawActive && (
        <div style={s.drawTools}>
          {(['pencil', 'circle', 'eraser'] as DrawTool[]).map(tool => (
            <button
              key={tool}
              onClick={() => setDrawTool(tool)}
              style={{ ...s.drawToolBtn, border: drawTool === tool ? '2px solid #fff8ef' : '2px solid transparent' }}
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
                border: drawColor === c ? '3px solid #fff8ef' : '3px solid transparent',
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
      <div style={sp.slotTop}>
        <p style={sp.slotLabel}>{label}</p>
        {url && <span style={sp.readyPill}>Pronto</span>}
      </div>

      {url ? (
        <video src={url} style={sp.previewVideo} controls playsInline />
      ) : (
        <div style={sp.emptyBox} onClick={() => inputRef.current?.click()}>
          <div style={sp.emptyIcon}>📹</div>
          <span style={sp.emptyTitle}>Selecionar vídeo</span>
          <span style={sp.emptySub}>Toque para escolher um arquivo</span>
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
        {url ? 'Trocar vídeo' : 'Escolher vídeo'}
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
          <div style={sp.trimLine}>
            <span style={sp.trimLabel}>Início</span>
            <strong style={sp.trimTime}>{fmtTime(start)}</strong>
          </div>

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

          <div style={sp.trimLine}>
            <span style={sp.trimLabel}>Fim</span>
            <strong style={sp.trimTime}>{fmtTime(end)}</strong>
          </div>

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
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    background: '#fbf7f1',
    display: 'flex',
    flexDirection: 'column',
    color: '#2d2521',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  bgGlow1: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(191,102,72,0.16) 0%, transparent 68%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  bgGlow2: {
    position: 'absolute',
    bottom: -130,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(116,80,58,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  topBar: {
    position: 'relative',
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '44px 1fr 44px',
    alignItems: 'center',
    gap: 10,
    padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
    background: '#fbf7f1',
    flexShrink: 0,
  },

  titleBlock: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  pageTitle: {
    fontSize: 21,
    fontWeight: 950,
    margin: 0,
    color: '#2d2521',
    letterSpacing: -0.7,
    textAlign: 'center',
  },

  pageSub: {
    margin: 0,
    fontSize: 11.5,
    fontWeight: 650,
    color: '#94857a',
    textAlign: 'center',
    lineHeight: 1.25,
  },

  headerSpacer: {
    width: 42,
    height: 42,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: '#f3e8de',
    border: 'none',
    color: '#7a5142',
    fontSize: 30,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroCard: {
    position: 'relative',
    zIndex: 2,
    margin: '0 16px 12px',
    padding: '18px',
    borderRadius: 24,
    background: 'linear-gradient(135deg, #c66b4d, #8f4635)',
    boxShadow: '0 16px 34px rgba(134,72,50,0.20)',
    overflow: 'hidden',
  },

  heroKicker: {
    display: 'block',
    color: 'rgba(255,245,235,0.82)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.4,
    marginBottom: 7,
  },

  heroTitle: {
    margin: 0,
    color: '#fff8ef',
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: -0.6,
    lineHeight: 1.1,
  },

  heroText: {
    margin: '7px 0 0',
    color: 'rgba(255,248,239,0.88)',
    fontSize: 12.8,
    fontWeight: 650,
    lineHeight: 1.42,
    maxWidth: 360,
  },

  infoBanner: {
    position: 'relative',
    zIndex: 2,
    margin: '0 16px 12px',
    padding: '12px 14px',
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 18,
    color: '#7b675d',
    fontSize: 12.5,
    fontWeight: 650,
    lineHeight: 1.45,
    boxShadow: '0 10px 24px rgba(117,76,56,0.06)',
  },

  slotRow: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '0 16px',
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },

  trimRow: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '0 16px',
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },

  setupFooter: {
    position: 'relative',
    zIndex: 3,
    padding: '14px 16px max(16px, env(safe-area-inset-bottom, 16px))',
    background: 'rgba(251,247,241,0.94)',
    borderTop: '1px solid rgba(130,82,62,0.08)',
    backdropFilter: 'blur(14px)',
  },

  primaryBtn: {
    width: '100%',
    padding: '15px',
    borderRadius: 17,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 950,
    cursor: 'pointer',
    minHeight: 52,
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  // Compare phase
  comparePage: {
    height: '100dvh',
    background: '#0d0907',
    display: 'flex',
    flexDirection: 'column',
    color: '#fff',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  compareHeader: {
    display: 'grid',
    gridTemplateColumns: '44px 1fr 52px',
    alignItems: 'center',
    gap: 10,
    padding: 'max(10px, env(safe-area-inset-top, 10px)) 12px 10px',
    background: 'rgba(28,20,16,0.88)',
    borderBottom: '1px solid rgba(255,248,239,0.08)',
    backdropFilter: 'blur(14px)',
    zIndex: 20,
    flexShrink: 0,
  },

  compareBackBtn: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: '1px solid rgba(255,248,239,0.12)',
    background: 'rgba(255,248,239,0.08)',
    color: '#fff8ef',
    fontSize: 30,
    lineHeight: 1,
    cursor: 'pointer',
  },

  compareTitleBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },

  compareTitle: {
    color: '#fff8ef',
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: -0.35,
  },

  compareSub: {
    color: 'rgba(255,248,239,0.52)',
    fontSize: 11,
    fontWeight: 700,
  },

  compareArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#000',
  },

  hiddenVideo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },

  displayCanvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    background: '#000',
    zIndex: 1,
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
    background: 'rgba(28,20,16,0.92)',
    borderTop: '1px solid rgba(255,248,239,0.08)',
    flexShrink: 0,
    flexWrap: 'wrap',
    backdropFilter: 'blur(14px)',
  },

  controlBtn: {
    background: 'rgba(255,248,239,0.10)',
    border: '1px solid rgba(255,248,239,0.13)',
    color: '#fff8ef',
    width: 44,
    height: 44,
    borderRadius: 22,
    fontSize: 17,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
  },

  controlBtnActive: {
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    borderColor: 'rgba(255,248,239,0.18)',
    boxShadow: '0 8px 18px rgba(147,72,54,0.28)',
  },

  recordingBtn: {
    background: 'linear-gradient(135deg, #c95441, #922f28)',
    borderColor: 'rgba(255,248,239,0.18)',
  },

  playBtn: {
    background: 'linear-gradient(135deg, #d0704e, #974735)',
    width: 54,
    height: 54,
    borderRadius: 27,
    fontSize: 22,
    boxShadow: '0 10px 22px rgba(147,72,54,0.30)',
  },

  rateToggle: {
    display: 'flex',
    justifyContent: 'flex-end',
  },

  rateBtn: {
    width: 48,
    height: 38,
    borderRadius: 999,
    border: '1px solid rgba(255,248,239,0.14)',
    background: 'rgba(255,248,239,0.09)',
    color: '#fff8ef',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },

  drawTools: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '10px 16px',
    background: 'rgba(18,12,10,0.94)',
    borderTop: '1px solid rgba(255,248,239,0.08)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },

  drawToolBtn: {
    background: 'rgba(255,248,239,0.10)',
    border: '2px solid transparent',
    color: '#fff8ef',
    width: 44,
    height: 44,
    borderRadius: 14,
    fontSize: 20,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  colorBtn: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    cursor: 'pointer',
    border: '3px solid transparent',
  },
};

const sp: Record<string, React.CSSProperties> = {
  slotBox: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
    boxShadow: '0 10px 24px rgba(117,76,56,0.06)',
  },

  slotTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  slotLabel: {
    color: '#2d2521',
    fontSize: 14,
    fontWeight: 900,
    margin: 0,
    letterSpacing: -0.15,
  },

  readyPill: {
    background: '#edf8ef',
    color: '#3f8f5b',
    border: '1px solid rgba(63,143,91,0.16)',
    borderRadius: 999,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 850,
    flexShrink: 0,
  },

  emptyBox: {
    height: 160,
    borderRadius: 18,
    border: '1.5px dashed rgba(130,82,62,0.18)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    background: '#fffaf7',
  },

  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: '50%',
    background: '#fff1eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    marginBottom: 2,
  },

  emptyTitle: {
    color: '#4b3d36',
    fontSize: 14,
    fontWeight: 850,
  },

  emptySub: {
    color: '#9b8a7f',
    fontSize: 12,
    fontWeight: 650,
  },

  previewVideo: {
    width: '100%',
    maxHeight: 210,
    borderRadius: 16,
    objectFit: 'contain',
    background: '#000',
    overflow: 'hidden',
  },

  pickBtn: {
    padding: '13px 0',
    borderRadius: 16,
    background: '#fff4ed',
    border: '1px solid rgba(198,107,77,0.18)',
    color: '#a65440',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    width: '100%',
    minHeight: 46,
  },

  trimBox: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 10px 24px rgba(117,76,56,0.06)',
  },

  trimVideo: {
    width: '100%',
    maxHeight: 210,
    borderRadius: 16,
    background: '#000',
    objectFit: 'contain',
  },

  trimLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },

  trimLabel: {
    color: '#8f7769',
    fontSize: 12,
    margin: 0,
    fontWeight: 850,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  trimTime: {
    color: '#2d2521',
    fontSize: 13,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },

  slider: {
    width: '100%',
    accentColor: '#c66b4d',
    height: 32,
  },

  timeInfo: {
    color: '#8b5b49',
    background: '#fff4ed',
    border: '1px solid rgba(198,107,77,0.14)',
    borderRadius: 999,
    padding: '8px 10px',
    fontSize: 12.5,
    margin: '2px 0 0',
    textAlign: 'center',
    fontWeight: 850,
  },
};
