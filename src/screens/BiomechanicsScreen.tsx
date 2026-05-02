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
  validatePosture,
  type JointAngles,
  type PoseFrame,
} from '@services/poseService';
import {
  fetchGabarito,
  NIVEL_LABELS,
  type GabaritoEntry,
  type NivelAluno,
} from '@services/apiService';
import { calcularPerformance, type PerformanceResult, type Mao } from '@utils/calcularPerformance';

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
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Análise comparativa
  const [gabarito, setGabarito]                       = useState<Record<string, GabaritoEntry> | null>(null);
  const [selectedGolpeFaseId, setSelectedGolpeFaseId] = useState('saque_preparacao');
  const [selectedNivel, setSelectedNivel]             = useState<NivelAluno>('intermediario');
  const [analysisResult, setAnalysisResult]           = useState<PerformanceResult | null>(null);
  const [snapshotUrl, setSnapshotUrl]                 = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen]               = useState(false);

  // Melhor pose — rastreada passivamente durante reprodução normal
  const [bestScore, setBestScore]   = useState<number | null>(null);
  const bestTrackedRef = useRef<{ score: number; time: number; frame: PoseFrame } | null>(null);
  const gabaritoRef    = useRef<Record<string, GabaritoEntry> | null>(null);
  const golpeFaseRef   = useRef('saque_preparacao');
  const nivelRef       = useRef<NivelAluno>('intermediario');
  const maoRef         = useRef<Mao>('destro');

  // Gabarito load state
  const [gabaritoError, setGabaritoError] = useState(false);

  // Lateralidade
  const [mao, setMao] = useState<Mao>(() => (localStorage.getItem('mao') as Mao | null) ?? 'destro');

  // Sync refs com estado para uso dentro do renderLoop (evita closure stale)
  useEffect(() => { gabaritoRef.current = gabarito; }, [gabarito]);
  useEffect(() => {
    golpeFaseRef.current   = selectedGolpeFaseId;
    bestTrackedRef.current = null; setBestScore(null);
  }, [selectedGolpeFaseId]);
  useEffect(() => {
    nivelRef.current       = selectedNivel;
    bestTrackedRef.current = null; setBestScore(null);
  }, [selectedNivel]);
  useEffect(() => {
    maoRef.current         = mao;
    bestTrackedRef.current = null; setBestScore(null);
  }, [mao]);

  // Seek bar
  const [videoDuration,    setVideoDuration]    = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const seekingRef = useRef(false);

  const ZOOM_LEVELS = [1, 1.5, 2, 3];
  const PAN_STEP = 60;

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panStartRef = useRef<{ px: number; py: number; sx: number; sy: number } | null>(null);

  // -------------------------------------------------------------------------
  // Init MediaPipe + fetch gabarito on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    initPoseLandmarker()
      .then(() => setLoadPhase('ready'))
      .catch(() => setLoadPhase('error'));

    const loadGabarito = async (attempt = 1) => {
      try {
        const data = await fetchGabarito();
        setGabarito(data);
        setGabaritoError(false);
      } catch {
        if (attempt < 5) {
          setTimeout(() => loadGabarito(attempt + 1), attempt * 2000);
        } else {
          setGabaritoError(true);
        }
      }
    };
    loadGabarito();

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

      // Rastreia passivamente o melhor frame enquanto o vídeo toca
      const entry = gabaritoRef.current?.[golpeFaseRef.current];
      if (entry && validatePosture(frame.landmarks, golpeFaseRef.current, maoRef.current)) {
        const result = calcularPerformance(
          entry, nivelRef.current, '', '', frame.angles, maoRef.current, golpeFaseRef.current,
        );
        if (result.scorePonderado > (bestTrackedRef.current?.score ?? -1)) {
          bestTrackedRef.current = { score: result.scorePonderado, time: v.currentTime, frame };
          setBestScore(result.scorePonderado);
        }
      }
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
    setBestScore(null);
    bestTrackedRef.current = null;
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
    const v = videoRef.current;
    if (!v) return;
    setVideoDuration(v.duration || 0);
    setVideoCurrentTime(v.currentTime || 0);
    const ro = new ResizeObserver(syncCanvas);
    ro.observe(v);
    (v as HTMLVideoElement & { _ro?: ResizeObserver })._ro?.disconnect();
    (v as HTMLVideoElement & { _ro?: ResizeObserver })._ro = ro;
  };

  const handleTimeUpdate = () => {
    if (!seekingRef.current) setVideoCurrentTime(videoRef.current?.currentTime ?? 0);
  };

  const handleSeekBar = async (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    seekingRef.current = true;
    setVideoCurrentTime(t);
    await handleSeek(Math.round(t * 1000));
    v.currentTime = t;
  };

  const handleSeekBarCommit = () => { seekingRef.current = false; };

  const handlePlay  = () => { setIsPlaying(true);  startLoop(); };
  const handlePause = () => { setIsPlaying(false); stopLoop();  };
  const handleEnded = () => { setIsPlaying(false); stopLoop();  };

  const handleSeeked = async () => {
    const v = videoRef.current;
    if (!v) return;
    await handleSeek(v.currentTime * 1000);
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
    if (v.paused) v.play().catch(() => null);
    else          v.pause();
  };

  const stepFrame = (direction: -1 | 1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + direction * (1 / 30)));
  };

  const toggleRate = () => setPlaybackRate(r => r === 1 ? 0.5 : 1);

  const changeZoom = (next: number) => {
    setZoom(next);
    if (next === 1) { setPanX(0); setPanY(0); }
  };

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handlePanStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (zoom <= 1) return;
    const px = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const py = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    panStartRef.current = { px, py, sx: panX, sy: panY };
  }, [zoom, panX, panY]);

  useEffect(() => {
    const onMove = (e: TouchEvent | MouseEvent) => {
      if (!panStartRef.current) return;
      const px = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const py = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      setPanX(panStartRef.current.sx + (px - panStartRef.current.px));
      setPanY(panStartRef.current.sy + (py - panStartRef.current.py));
    };
    const onEnd = () => { panStartRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Drag & drop (PC)
  // -------------------------------------------------------------------------
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
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
  // Análise comparativa
  // -------------------------------------------------------------------------
  const captureSnapshot = useCallback((): string | null => {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!video || video.readyState < 2) return null;
    const w = overlay?.width || video.videoWidth;
    const h = overlay?.height || video.videoHeight;
    if (!w || !h) return null;

    const tmp = document.createElement('canvas');
    tmp.width  = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) {
      const va = vw / vh;
      const ca = w / h;
      let dx = 0, dy = 0, dw = w, dh = h;
      if (va > ca) { dh = w / va; dy = (h - dh) / 2; }
      else         { dw = h * va; dx = (w - dw) / 2; }
      ctx.drawImage(video, dx, dy, dw, dh);
    }
    if (overlay) ctx.drawImage(overlay, 0, 0, w, h);
    return tmp.toDataURL('image/jpeg', 0.85);
  }, []);

  const handleAnalyze = () => {
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    if (!gabarito) return;

    const entry = gabarito[selectedGolpeFaseId];
    if (!entry) return;

    const snap = captureSnapshot();
    setSnapshotUrl(snap);

    const result = calcularPerformance(
      entry,
      selectedNivel,
      entry.label,
      NIVEL_LABELS[selectedNivel],
      currentAngles ?? { elbowLeft: null, elbowRight: null, kneeLeft: null, kneeRight: null, hipLeft: null, hipRight: null },
      mao,
      selectedGolpeFaseId,
    );
    setAnalysisResult(result);
    setAnalysisOpen(true);
  };

  // -------------------------------------------------------------------------
  // Melhor frame — jump instantâneo para o frame rastreado durante reprodução
  // -------------------------------------------------------------------------
  const handleFindBestPose = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !gabarito) return;
    const best = bestTrackedRef.current;
    if (!best) return;

    v.pause();
    await handleSeek(Math.round(best.time * 1000));
    v.currentTime = best.time;

    const c   = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) drawPoseFrame(ctx, best.frame, c.width, c.height, v);
    setCurrentAngles(best.frame.angles);

    const entry = gabarito[selectedGolpeFaseId];
    if (entry) {
      const result = calcularPerformance(
        entry, selectedNivel, entry.label, NIVEL_LABELS[selectedNivel],
        best.frame.angles, mao, selectedGolpeFaseId,
      );
      setAnalysisResult(result);
      const snap = captureSnapshot();
      if (snap) setSnapshotUrl(snap);
    }
  }, [gabarito, selectedGolpeFaseId, selectedNivel, mao, captureSnapshot]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const angles = currentAngles;
  const canAnalyze = !!gabarito && !!videoUrl;

  const retryGabarito = useCallback(() => {
    setGabaritoError(false);
    const load = async (attempt = 1) => {
      try {
        const data = await fetchGabarito();
        setGabarito(data);
        setGabaritoError(false);
      } catch {
        if (attempt < 5) setTimeout(() => load(attempt + 1), attempt * 2000);
        else setGabaritoError(true);
      }
    };
    load();
  }, []);

  // Strip de análise comparativa (sempre visível)
  const analysisStrip = (
    <div style={s.analysisStrip}>
      <p style={s.analysisHint}>
        Pause no frame desejado, selecione o golpe e toque em Analisar
      </p>
      <div style={s.selectsCol}>
        {/* Golpe + Fase */}
        {gabaritoError ? (
          <button onClick={retryGabarito} style={s.retryGabaritoBtn}>
            ⚠️ Erro ao carregar golpes — toque para tentar novamente
          </button>
        ) : (
          <select
            value={selectedGolpeFaseId}
            onChange={e => setSelectedGolpeFaseId(e.target.value)}
            style={s.select}
            disabled={!gabarito}
          >
            {gabarito
              ? Object.entries(gabarito).map(([id, g]) => (
                  <option key={id} value={id}>{g.label}</option>
                ))
              : <option>Carregando golpes...</option>
            }
          </select>
        )}

        {/* Nível */}
        <div style={s.nivelRow}>
          {(['iniciante', 'intermediario', 'avancado'] as NivelAluno[]).map(n => (
            <button
              key={n}
              onClick={() => setSelectedNivel(n)}
              style={{ ...s.nivelBtn, ...(selectedNivel === n ? s.nivelBtnActive : {}) }}
            >
              {NIVEL_LABELS[n]}
            </button>
          ))}
        </div>

        {/* Lateralidade */}
        <div style={s.nivelRow}>
          {(['destro', 'canhoto'] as Mao[]).map(m => (
            <button
              key={m}
              onClick={() => { setMao(m); localStorage.setItem('mao', m); }}
              style={{ ...s.nivelBtn, ...(mao === m ? s.nivelBtnActive : {}) }}
            >
              {m === 'destro' ? '🖐 Destro' : '🤚 Canhoto'}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        style={{ ...s.analyzeBtn, opacity: canAnalyze ? 1 : 0.4 }}
        disabled={!canAnalyze}
      >
        📊 Analisar
      </button>
    </div>
  );

  const anglePanel = (
    <div style={s.anglePanel}>
      {analysisStrip}
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
  // Loading / error states
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
        <div style={s.headerTitleBlock}>
          <span style={s.headerTitle}>Análise Biomecânica</span>
          <span style={s.headerSub}>Análise Profissional do Movimento e comparativos com estudos internacionais</span>
        </div>
        <button
          onClick={handleFindBestPose}
          style={{ ...s.trophyHeaderBtn, opacity: videoUrl && bestScore !== null ? 1 : 0.35 }}
          disabled={!videoUrl || bestScore === null}
          title={bestScore !== null ? `Ir para melhor frame (${bestScore}%)` : 'Reproduza o vídeo — o 🏆 rastreia automaticamente'}
        >
          {bestScore !== null ? `🏆 ${bestScore}%` : isPlaying ? '🏆 …' : '🏆'}
        </button>
      </div>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />

      {/* Modal de análise comparativa */}
      {analysisOpen && analysisResult && (
        <AnalysisModal
          result={analysisResult}
          snapshotUrl={snapshotUrl}
          golpeFaseId={selectedGolpeFaseId}
          onClose={() => setAnalysisOpen(false)}
        />
      )}

      {/* Body — mobile: todos os elementos filhos diretos do page (fixed), garantindo scroll do anglePanel */}
      {isMobile ? (
        <>
          <div style={s.videoWrapper} onMouseDown={handlePanStart} onTouchStart={handlePanStart}>
            <div style={{ ...s.zoomInner, transform: `translate(${panX}px,${panY}px) scale(${zoom})`, cursor: zoom > 1 ? 'grab' : 'default' }}>
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    style={s.video}
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
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

          <button onClick={() => fileInputRef.current?.click()} style={s.pickBtn}>
            📁 Escolher Vídeo
          </button>

          {videoUrl && (
            <div style={s.controls}>
              <button onClick={() => stepFrame(-1)} style={s.ctrlBtn}>◀</button>
              <button onClick={togglePlay} style={s.ctrlBtnMain}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={() => stepFrame(1)} style={s.ctrlBtn}>▶▶</button>
              <button onClick={toggleRate} style={s.rateBtn}>{playbackRate === 1 ? '1x' : '0.5x'}</button>
              <button
                onClick={() => changeZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.indexOf(zoom) + 1, ZOOM_LEVELS.length - 1)])}
                style={s.zoomBtn} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              >＋</button>
              <button
                onClick={() => changeZoom(ZOOM_LEVELS[Math.max(ZOOM_LEVELS.indexOf(zoom) - 1, 0)])}
                style={s.zoomBtn} disabled={zoom === 1}
              >－</button>
              {zoom > 1 && <span style={s.zoomLabel}>{zoom}x</span>}
            </div>
          )}

          {videoUrl && videoDuration > 0 && (
            <input
              type="range"
              min={0}
              max={videoDuration}
              step={0.033}
              value={videoCurrentTime}
              style={s.seekBar}
              onChange={e => handleSeekBar(Number(e.target.value))}
              onMouseUp={handleSeekBarCommit}
              onTouchEnd={handleSeekBarCommit}
            />
          )}

          {videoUrl && zoom > 1 && (
            <div style={s.panControls}>
              <button onClick={() => setPanY(p => p + PAN_STEP)} style={s.panBtn}>↑</button>
              <div style={s.panRow}>
                <button onClick={() => setPanX(p => p + PAN_STEP)} style={s.panBtn}>←</button>
                <button onClick={() => { setPanX(0); setPanY(0); }} style={s.panCenterBtn}>⊙</button>
                <button onClick={() => setPanX(p => p - PAN_STEP)} style={s.panBtn}>→</button>
              </div>
              <button onClick={() => setPanY(p => p - PAN_STEP)} style={s.panBtn}>↓</button>
            </div>
          )}

          {anglePanel}
        </>
      ) : (
        <div style={s.desktopBody}>
          <div style={s.desktopLeft}>
            {videoUrl ? (
              <div style={s.videoWrapper} onMouseDown={handlePanStart} onTouchStart={handlePanStart}>
                <div style={{ ...s.zoomInner, transform: `translate(${panX}px,${panY}px) scale(${zoom})`, cursor: zoom > 1 ? 'grab' : 'default' }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    style={s.video}
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
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

            <div style={s.controls}>
              <button onClick={() => stepFrame(-1)} style={s.ctrlBtn}>◀</button>
              <button onClick={togglePlay} style={s.ctrlBtnMain} disabled={!videoUrl}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={() => stepFrame(1)} style={s.ctrlBtn}>▶▶</button>
              <button onClick={toggleRate} style={s.rateBtn}>{playbackRate === 1 ? '1x' : '0.5x'}</button>
              <button onClick={() => changeZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.indexOf(zoom) + 1, ZOOM_LEVELS.length - 1)])} style={s.zoomBtn} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>＋</button>
              <button onClick={() => changeZoom(ZOOM_LEVELS[Math.max(ZOOM_LEVELS.indexOf(zoom) - 1, 0)])} style={s.zoomBtn} disabled={zoom === 1}>－</button>
              {zoom > 1 && <span style={s.zoomLabel}>{zoom}x</span>}
              {zoom > 1 && <button onClick={() => { setPanX(0); setPanY(0); }} style={s.panCenterBtn}>⊙</button>}
            </div>

            {videoUrl && videoDuration > 0 && (
              <input
                type="range"
                min={0}
                max={videoDuration}
                step={0.033}
                value={videoCurrentTime}
                style={s.seekBar}
                onChange={e => handleSeekBar(Number(e.target.value))}
                onMouseUp={handleSeekBarCommit}
                onTouchEnd={handleSeekBarCommit}
              />
            )}
          </div>

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
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    background: '#fbf7f1',
    color: '#2d2521',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  header: {
    display: 'grid',
    gridTemplateColumns: '88px 1fr 76px',
    alignItems: 'center',
    gap: 10,
    padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
    background: '#fbf7f1',
    borderBottom: '1px solid rgba(130,82,62,0.08)',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  },

  backBtn: {
    background: '#f3e8de',
    border: 'none',
    color: '#7a5142',
    padding: '10px 12px',
    borderRadius: 999,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 850,
    flexShrink: 0,
    boxShadow: '0 8px 18px rgba(117,76,56,0.06)',
  },

  headerTitleBlock: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
  },

  headerTitle: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: 950,
    color: '#2d2521',
    letterSpacing: -0.35,
  },

  headerSub: {
    textAlign: 'center' as const,
    fontSize: 10.5,
    fontWeight: 650,
    color: '#94857a',
    letterSpacing: 0.1,
    lineHeight: 1.25,
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  trophyHeaderBtn: {
    background: '#fff4df',
    border: '1px solid rgba(196,139,58,0.30)',
    color: '#a7671e',
    padding: '9px 10px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 900,
    cursor: 'pointer',
    flexShrink: 0,
    minWidth: 46,
    minHeight: 38,
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 20px rgba(167,103,30,0.10)',
  },

  centeredBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
    textAlign: 'center',
  },

  spinner: {
    width: 48,
    height: 48,
    border: '4px solid rgba(198,107,77,0.18)',
    borderTop: '4px solid #c66b4d',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },

  loadingText: { fontSize: 18, fontWeight: 900, margin: 0, color: '#2d2521' },
  loadingSub:  { fontSize: 13, color: '#94857a', margin: 0, fontWeight: 650 },
  errorText:   { fontSize: 18, fontWeight: 900, margin: 0, color: '#c95441' },
  errorSub:    { fontSize: 13, color: '#94857a', margin: 0, textAlign: 'center', fontWeight: 650 },

  retryBtn: {
    padding: '13px 26px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  backBtnSmall: {
    padding: '11px 20px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.10)',
    color: '#7a5142',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },

  videoWrapper: {
    position: 'relative',
    width: 'calc(100% - 28px)',
    margin: '10px auto 0',
    background: '#15100e',
    flexShrink: 0,
    minHeight: 190,
    maxHeight: '48dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    border: '1px solid rgba(130,82,62,0.12)',
    boxShadow: '0 14px 34px rgba(57,37,28,0.14)',
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
    background: '#111',
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
    background: 'linear-gradient(135deg, #251a15, #120e0c)',
  },

  emptyText: { color: 'rgba(255,248,239,0.64)', fontSize: 15, fontWeight: 750 },

  pickBtn: {
    margin: '10px 16px 0',
    padding: '13px 18px',
    borderRadius: 18,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    width: 'calc(100% - 32px)',
    flexShrink: 0,
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  dropZone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    border: '2px dashed',
    borderRadius: 26,
    minHeight: 300,
    margin: 16,
    transition: 'border-color 0.15s, background 0.15s',
    color: '#7a5142',
    boxShadow: '0 14px 34px rgba(57,37,28,0.08)',
  },

  dropText: { color: '#6f625b', fontSize: 16, margin: 0, fontWeight: 750 },

  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 12px',
    background: '#fbf7f1',
    borderTop: 'none',
    borderBottom: 'none',
    flexShrink: 0,
    flexWrap: 'wrap',
  },

  ctrlBtn: {
    padding: '10px 14px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.10)',
    color: '#7a5142',
    fontSize: 16,
    cursor: 'pointer',
    minWidth: 44,
    minHeight: 44,
    boxShadow: '0 8px 18px rgba(117,76,56,0.06)',
  },

  ctrlBtnMain: {
    padding: '10px 18px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 20,
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: 58,
    minHeight: 44,
    boxShadow: '0 10px 20px rgba(147,72,54,0.20)',
  },

  rateBtn: {
    padding: '10px 12px',
    borderRadius: 14,
    background: '#eef8ef',
    border: '1px solid rgba(63,143,91,0.22)',
    color: '#3f8f5b',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: 46,
    minHeight: 44,
  },

  zoomBtn: {
    padding: '8px 12px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.10)',
    color: '#7a5142',
    fontSize: 16,
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: 40,
    minHeight: 44,
    lineHeight: 1,
  },

  zoomLabel: {
    color: '#b65b43',
    fontSize: 13,
    fontWeight: 900,
    minWidth: 28,
    textAlign: 'center' as const,
  },

  panControls: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    padding: '6px 0 8px',
    background: '#fbf7f1',
    flexShrink: 0,
  },

  panRow: { display: 'flex', gap: 4, alignItems: 'center' },

  panBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: '#fff1eb',
    border: '1px solid rgba(198,107,77,0.20)',
    color: '#b65b43',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  panCenterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.10)',
    color: '#8f7769',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  anglePanel: {
    margin: '0 14px 18px',
    padding: 14,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 24,
    flex: 1,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  anglePanelTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: '#6f625b',
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  angleTable: { width: '100%', borderCollapse: 'collapse' },

  th: {
    padding: '7px 8px',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'center',
    borderBottom: '1px solid #efe4db',
    color: '#94857a',
  },

  td: {
    padding: '11px 8px',
    fontSize: 14,
    fontWeight: 800,
    borderBottom: '1px solid #f0e7df',
  },

  tdVal: {
    padding: '11px 8px',
    fontSize: 18,
    fontWeight: 900,
    textAlign: 'center',
    borderBottom: '1px solid #f0e7df',
    color: '#2d2521',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  },

  analysisStrip: {
    padding: '0 0 15px',
    borderBottom: '1px solid #efe4db',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },

  analysisHint: {
    margin: 0,
    fontSize: 12.5,
    color: '#8f7769',
    lineHeight: 1.45,
    fontWeight: 650,
  },

  selectsCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },

  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 15,
    background: '#fffaf7',
    border: '1px solid #eadfd6',
    color: '#332a25',
    fontSize: 14,
    fontWeight: 750,
    cursor: 'pointer',
    appearance: 'auto' as const,
    colorScheme: 'light' as React.CSSProperties['colorScheme'],
  },

  nivelRow: {
    display: 'flex',
    gap: 7,
  },

  nivelBtn: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: 14,
    background: '#fffaf7',
    border: '1px solid #eadfd6',
    color: '#8f7769',
    fontSize: 12.5,
    fontWeight: 850,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },

  nivelBtnActive: {
    background: '#fff1eb',
    border: '1.5px solid rgba(198,107,77,0.48)',
    color: '#b65b43',
  },

  seekBar: {
    width: 'calc(100% - 32px)',
    height: 4,
    accentColor: '#c66b4d',
    cursor: 'pointer',
    margin: '2px 16px 6px',
    flexShrink: 0,
  },

  analyzeBtn: {
    padding: '14px 20px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    width: '100%',
    minHeight: 48,
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  retryGabaritoBtn: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 14,
    background: '#fff4f0',
    border: '1px solid rgba(201,84,65,0.22)',
    color: '#c95441',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'left' as const,
  },

  trophyBtn: {
    padding: '10px 13px',
    borderRadius: 14,
    background: '#fff4df',
    border: '1px solid rgba(196,139,58,0.30)',
    color: '#a7671e',
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: 48,
    lineHeight: 1,
  },

  trophyScore: {
    color: '#a7671e',
    fontSize: 13,
    fontWeight: 900,
    minWidth: 36,
    textAlign: 'center' as const,
  },

  desktopBody: { flex: 1, display: 'flex', minHeight: 0, background: '#fbf7f1' },

  desktopLeft: {
    flex: '0 0 65%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(130,82,62,0.08)',
    overflow: 'hidden',
  },

  desktopRight: {
    flex: '0 0 35%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
};

const sm: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(44,30,24,0.42)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
    backdropFilter: 'blur(6px)',
  },

  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.95)',
    zIndex: 400,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    cursor: 'zoom-out',
    padding: 16,
  },

  lightboxImg: {
    maxWidth: '100%',
    maxHeight: '85dvh',
    objectFit: 'contain',
    borderRadius: 16,
  },

  lightboxHint: { color: 'rgba(255,255,255,0.58)', fontSize: 13, flexShrink: 0 },

  zoomHint: {
    fontSize: 9,
    color: '#b59c8c',
    marginLeft: 4,
    fontWeight: 700,
  },

  sheet: {
    background: '#fffaf5',
    border: '1px solid rgba(130,82,62,0.12)',
    borderRadius: 28,
    width: '100%',
    maxWidth: 740,
    maxHeight: '92dvh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
    boxShadow: '0 24px 70px rgba(44,36,31,0.28)',
  },

  header: {
    display: 'grid',
    gridTemplateColumns: '96px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '18px 16px 14px',
    borderBottom: '1px solid #efe4db',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    background: '#fffaf5',
    zIndex: 10,
  },

  closeBtn: {
    background: '#f3e8de',
    border: 'none',
    color: '#7a5142',
    padding: '10px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 850,
    cursor: 'pointer',
    flexShrink: 0,
  },

  headerCenter: { flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 },

  headerTitles: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
  },

  golpeLabel: { fontSize: 16, fontWeight: 950, color: '#2d2521', letterSpacing: -0.3, textAlign: 'center' as const },
  atletaMeta: { fontSize: 12, color: '#94857a', fontWeight: 700 },

  scoreChip: {
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 950,
    flexShrink: 0,
  },

  imageRow: { display: 'flex', gap: 12, padding: '14px 16px', flexShrink: 0 },

  imageBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
  },

  imageCaption: {
    margin: 0,
    fontSize: 10.5,
    fontWeight: 950,
    letterSpacing: 1.1,
    color: '#8f7769',
    textTransform: 'uppercase' as const,
  },

  img: {
    width: '100%',
    aspectRatio: '4/3',
    objectFit: 'cover',
    borderRadius: 16,
    background: '#111',
    cursor: 'zoom-in',
    boxShadow: '0 10px 26px rgba(57,37,28,0.08)',
  },

  imgPlaceholder: {
    width: '100%',
    aspectRatio: '4/3',
    background: '#f4ebe3',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94857a',
    fontSize: 13,
    fontWeight: 750,
    border: '1px dashed #e3d5ca',
  },

  imageCredit: {
    margin: 0,
    fontSize: 9,
    color: '#b59c8c',
    textAlign: 'center' as const,
    lineHeight: 1.4,
  },

  tableWrapper: { overflowX: 'auto', padding: '0 16px', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 420 },

  th: {
    padding: '10px 8px',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.2,
    color: '#8f7769',
    textAlign: 'center' as const,
    borderBottom: '1px solid #efe4db',
    whiteSpace: 'nowrap' as const,
  },

  tdLabel: {
    padding: '11px 8px',
    fontSize: 14,
    fontWeight: 900,
    color: '#2d2521',
    borderBottom: '1px solid #f0e7df',
    whiteSpace: 'nowrap' as const,
  },

  tdVal: {
    padding: '11px 8px',
    fontSize: 16,
    fontWeight: 950,
    textAlign: 'center' as const,
    color: '#2d2521',
    borderBottom: '1px solid #f0e7df',
    fontVariantNumeric: 'tabular-nums',
  },

  tdIdeal: {
    padding: '11px 8px',
    fontSize: 13,
    textAlign: 'center' as const,
    color: '#94857a',
    borderBottom: '1px solid #f0e7df',
    fontWeight: 750,
  },

  pctBadge: {
    display: 'inline-block',
    padding: '6px 11px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    textAlign: 'center' as const,
  },

  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    padding: '14px 16px 0',
    fontSize: 12,
    color: '#8f7769',
    fontWeight: 750,
    flexShrink: 0,
    flexWrap: 'wrap',
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
