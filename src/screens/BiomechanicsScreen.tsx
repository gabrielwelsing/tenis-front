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

  // Melhor pose
  const [findingBest, setFindingBest]   = useState(false);
  const [bestProgress, setBestProgress] = useState(0);
  const [bestScore, setBestScore]       = useState<number | null>(null);
  const scanCancelRef = useRef(false);

  // Gabarito load state
  const [gabaritoError, setGabaritoError] = useState(false);

  // Lateralidade
  const [mao, setMao] = useState<Mao>(() => (localStorage.getItem('mao') as Mao | null) ?? 'destro');

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
    scanCancelRef.current = true; // cancela scan em andamento
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentAngles(null);
    setBestScore(null);
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
    );
    setAnalysisResult(result);
    setAnalysisOpen(true);
  };

  // -------------------------------------------------------------------------
  // Busca do melhor frame (maior score) — varre o vídeo a cada 1s
  // -------------------------------------------------------------------------
  const handleFindBestPose = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !gabarito || findingBest) return;
    const entry = gabarito[selectedGolpeFaseId];
    if (!entry) return;

    v.pause();
    setFindingBest(true);
    setBestProgress(0);
    setBestScore(null);
    scanCancelRef.current = false;

    const duration = v.duration || 0;
    if (duration < 0.1) { setFindingBest(false); return; }

    // Aguarda o vídeo estar em estado seekable
    const waitReady = (): Promise<void> =>
      new Promise(resolve => {
        if (v.readyState >= 2) { resolve(); return; }
        const fn = () => { v.removeEventListener('canplay', fn); resolve(); };
        v.addEventListener('canplay', fn);
        setTimeout(resolve, 500);
      });

    // Seek confiável: aguarda 'seeked' + garante que o frame está pintado
    const seekTo = (t: number): Promise<void> =>
      new Promise(resolve => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            v.removeEventListener('seeked', finish);
            // Pequeno rAF para garantir que o frame está renderizado antes da detecção
            requestAnimationFrame(() => resolve());
          }
        };
        v.addEventListener('seeked', finish);
        v.currentTime = Math.min(Math.max(t, 0), duration - 0.05);
        setTimeout(finish, 400);
      });

    await waitReady();

    const STEP = 0.1; // varre a cada 100ms — captura golpes rápidos com precisão
    const times: number[] = [];
    for (let t = 0; t < duration; t += STEP) times.push(t);
    if (times.length === 0) times.push(0);

    const total = times.length;
    let bestSc         = -1;
    let bestT          = 0;
    let framesDetected = 0;
    let bestFrameData: PoseFrame | null = null;

    // Garante partida do início para timestamp monotônico
    await seekTo(0);
    await handleSeek(0);

    for (let i = 0; i < total; i++) {
      if (scanCancelRef.current) break;

      await seekTo(times[i]);
      if (scanCancelRef.current) break;

      const tsMs = Math.round(v.currentTime * 1000);
      await handleSeek(tsMs);
      const frame = detectFrame(v, tsMs);

      if (frame) {
        framesDetected++;
        const result = calcularPerformance(entry, selectedNivel, '', '', frame.angles, mao);
        if (result.scorePonderado > bestSc) {
          bestSc        = result.scorePonderado;
          bestT         = v.currentTime;
          bestFrameData = frame; // guarda o frame — sem re-detecção ao final
        }
      }

      setBestProgress(Math.round(((i + 1) / total) * 100));
    }

    if (!scanCancelRef.current) {
      if (framesDetected === 0 || !bestFrameData) {
        // Nenhuma pose detectada — permanece no frame atual
        setBestScore(null);
      } else {
        // Navega ao melhor instante e exibe o overlay já calculado
        await seekTo(bestT);
        const c   = canvasRef.current;
        const ctx = c?.getContext('2d');
        if (c && ctx) drawPoseFrame(ctx, bestFrameData, c.width, c.height, v);
        setCurrentAngles(bestFrameData.angles);
        setBestScore(bestSc);

        // Sincroniza analysisResult com o melhor frame para que nota, %
        // e ângulos no modal sejam idênticos aos exibidos no overlay do canvas
        const bestResult = calcularPerformance(
          entry,
          selectedNivel,
          entry.label,
          NIVEL_LABELS[selectedNivel],
          bestFrameData.angles,
          mao,
        );
        setAnalysisResult(bestResult);
        const snap = captureSnapshot();
        if (snap) setSnapshotUrl(snap);
      }
    }

    setFindingBest(false);
  }, [gabarito, selectedGolpeFaseId, selectedNivel, findingBest, captureSnapshot]);

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
        <span style={s.headerTitle}>Análise Biomecânica</span>
        <button
          onClick={findingBest ? () => { scanCancelRef.current = true; } : handleFindBestPose}
          style={{ ...s.trophyHeaderBtn, opacity: videoUrl && (canAnalyze || findingBest) ? 1 : 0.3 }}
          disabled={!videoUrl || (!canAnalyze && !findingBest)}
          title={findingBest ? `Cancelar (${bestProgress}%)` : 'Encontrar melhor posição'}
        >
          {findingBest ? `${bestProgress}%` : bestScore !== null ? `🏆 ${bestScore}%` : '🏆'}
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
    background: '#0d0d1a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
  },

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
  trophyHeaderBtn: {
    background: 'rgba(255,215,0,0.12)',
    border: '1.5px solid rgba(255,215,0,0.5)',
    color: '#ffd700',
    padding: '7px 12px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    minWidth: 44,
    minHeight: 36,
    whiteSpace: 'nowrap',
  },

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

  videoWrapper: {
    position: 'relative',
    width: '100%',
    background: '#000',
    flexShrink: 0,
    minHeight: 180,
    maxHeight: '48dvh',
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
    top: 0, left: 0,
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
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 15 },

  pickBtn: {
    margin: '8px 16px',
    padding: '12px 20px',
    borderRadius: 14,
    background: 'rgba(79,195,247,0.12)',
    border: '1.5px solid #4fc3f7',
    color: '#4fc3f7',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: 'calc(100% - 32px)',
    flexShrink: 0,
  },

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
  dropText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, margin: 0 },

  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.3)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  ctrlBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    minWidth: 44,
    minHeight: 44,
  },
  ctrlBtnMain: {
    padding: '10px 18px',
    borderRadius: 12,
    background: '#4fc3f7',
    border: 'none',
    color: '#000',
    fontSize: 20,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 56,
    minHeight: 44,
  },
  rateBtn: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(174,243,89,0.15)',
    border: '1.5px solid #aef359',
    color: '#aef359',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 46,
    minHeight: 44,
  },
  zoomBtn: {
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 40,
    minHeight: 44,
    lineHeight: 1,
  },
  zoomLabel: {
    color: '#4fc3f7',
    fontSize: 13,
    fontWeight: 700,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  panControls: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    padding: '6px 0 8px',
    background: 'rgba(0,0,0,0.3)',
    flexShrink: 0,
  },
  panRow: { display: 'flex', gap: 4, alignItems: 'center' },
  panBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(79,195,247,0.15)',
    border: '1px solid rgba(79,195,247,0.4)',
    color: '#4fc3f7',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panCenterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  anglePanel: {
    padding: '16px',
    background: 'rgba(0,0,0,0.25)',
    flex: 1,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
  anglePanelTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  angleTable: { width: '100%', borderCollapse: 'collapse' },
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

  // Analysis strip
  analysisStrip: {
    padding: '12px 0 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  analysisHint: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  selectsCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    background: '#1e2235',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    appearance: 'auto' as const,
  },
  nivelRow: {
    display: 'flex',
    gap: 6,
  },
  nivelBtn: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  nivelBtnActive: {
    background: 'rgba(174,243,89,0.18)',
    border: '1.5px solid #aef359',
    color: '#aef359',
  },
  seekBar: {
    width: '100%',
    height: 4,
    accentColor: '#4fc3f7',
    cursor: 'pointer',
    margin: '4px 0 0',
  },
  analyzeBtn: {
    padding: '14px 20px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #4a148c, #7b1fa2)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    width: '100%',
    minHeight: 48,
  },
  retryGabaritoBtn: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 12,
    background: 'rgba(255,100,100,0.12)',
    border: '1px solid rgba(255,100,100,0.4)',
    color: '#ff8a80',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
  },

  trophyBtn: {
    padding: '10px 13px',
    borderRadius: 10,
    background: 'rgba(255,215,0,0.15)',
    border: '1.5px solid rgba(255,215,0,0.5)',
    color: '#ffd700',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    minWidth: 48,
    lineHeight: 1,
  },
  trophyScore: {
    color: '#ffd700',
    fontSize: 13,
    fontWeight: 800,
    minWidth: 36,
    textAlign: 'center' as const,
  },
  desktopBody: { flex: 1, display: 'flex', minHeight: 0 },
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
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
};

// ---------------------------------------------------------------------------
// AnalysisModal — Painel de comparação biomecânica
// ---------------------------------------------------------------------------

const LOCAL_GABARITO_IMAGES: Record<string, string> = {
  saque_preparacao:    '/gabarito/saque_preparacao.png',
  saque_contato:       '/gabarito/saque_contato.png',
  forehand_preparacao: '/gabarito/forehand_preparacao.png',
  forehand_contato:    '/gabarito/forehand_contato.png',
  backhand_preparacao: '/gabarito/backhand_preparacao.png',
  backhand_contato:    '/gabarito/backhand_contato.png',
};

function scoreBadgeStyle(pct: number | null): React.CSSProperties {
  if (pct === null) return { background: 'rgba(255,255,255,0.15)', color: '#aaa' };
  if (pct >= 90)   return { background: 'rgba(76,175,80,0.25)',  color: '#81c784', border: '1px solid rgba(76,175,80,0.4)'  };
  if (pct >= 75)   return { background: 'rgba(255,179,0,0.25)',  color: '#ffd54f', border: '1px solid rgba(255,179,0,0.4)'  };
  return             { background: 'rgba(244,67,54,0.25)',   color: '#ef9a9a', border: '1px solid rgba(244,67,54,0.4)'  };
}

function scoreLabel(pct: number): string {
  if (pct >= 90) return '🟢';
  if (pct >= 75) return '🟡';
  return '🔴';
}

function AnalysisModal({
  result,
  snapshotUrl,
  golpeFaseId,
  onClose,
}: {
  result: PerformanceResult;
  snapshotUrl: string | null;
  golpeFaseId: string;
  onClose: () => void;
}) {
  const { golpeLabel, nivelLabel, imageUrl, imageCredit, joints, scorePonderado } = result;
  const localImg = LOCAL_GABARITO_IMAGES[golpeFaseId];
  const displayImageUrl = localImg ?? imageUrl;
  const displayCredit   = localImg ? '' : imageCredit;
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  return (
    <div style={sm.overlay}>
      {lightboxUrl && (
        <div style={sm.lightboxOverlay} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Ampliado" style={sm.lightboxImg} />
          <span style={sm.lightboxHint}>Toque para fechar</span>
        </div>
      )}

      <div style={sm.sheet}>
        {/* Header */}
        <div style={sm.header}>
          <button onClick={onClose} style={sm.closeBtn}>← Fechar</button>
          <div style={sm.headerCenter}>
            <div style={sm.headerTitles}>
              <span style={sm.golpeLabel}>{golpeLabel}</span>
              <span style={sm.atletaMeta}>{nivelLabel}</span>
            </div>
          </div>
          <div style={{ ...sm.scoreChip, ...scoreBadgeStyle(scorePonderado) }}>
            {scoreLabel(scorePonderado)} {scorePonderado}%
          </div>
        </div>

        {/* Side-by-side images */}
        <div style={sm.imageRow}>
          <div style={sm.imageBox}>
            <p style={sm.imageCaption}>
              SUA POSIÇÃO <span style={sm.zoomHint}>🔍 toque para ampliar</span>
            </p>
            {snapshotUrl
              ? <img src={snapshotUrl} alt="Snapshot" style={sm.img} onClick={() => setLightboxUrl(snapshotUrl)} />
              : <div style={sm.imgPlaceholder}><span>Sem frame</span></div>
            }
          </div>
          <div style={sm.imageBox}>
            <p style={sm.imageCaption}>
              POSIÇÃO IDEAL {displayImageUrl && <span style={sm.zoomHint}>🔍</span>}
            </p>
            {displayImageUrl ? (
              <>
                <img
                  src={displayImageUrl}
                  alt={golpeLabel}
                  style={sm.img}
                  onClick={() => setLightboxUrl(displayImageUrl)}
                />
                {displayCredit && <p style={sm.imageCredit}>{displayCredit}</p>}
              </>
            ) : (
              <div style={sm.imgPlaceholder}>
                <span>Imagem em breve</span>
              </div>
            )}
          </div>
        </div>

        {/* Comparison table */}
        <div style={sm.tableWrapper}>
          <table style={sm.table}>
            <thead>
              <tr>
                <th style={sm.th}>Articulação</th>
                <th style={{ ...sm.th, color: '#aef359' }}>Esq (Sua)</th>
                <th style={sm.th}>Ideal</th>
                <th style={sm.th}>% Acerto</th>
                <th style={{ ...sm.th, color: '#4fc3f7' }}>Dir (Sua)</th>
                <th style={sm.th}>Ideal</th>
                <th style={sm.th}>% Acerto</th>
              </tr>
            </thead>
            <tbody>
              {joints.map((j: import('@utils/calcularPerformance').JointResult) => (
                <tr key={j.label}>
                  <td style={sm.tdLabel}>{j.label}</td>
                  <td style={sm.tdVal}>{j.esqVal !== null ? `${j.esqVal}°` : '—'}</td>
                  <td style={sm.tdIdeal}>{j.ideal}°</td>
                  <td>
                    <span style={{ ...sm.pctBadge, ...scoreBadgeStyle(j.esqPct) }}>
                      {j.esqPct !== null ? `${j.esqPct}%` : '—'}
                    </span>
                  </td>
                  <td style={sm.tdVal}>{j.dirVal !== null ? `${j.dirVal}°` : '—'}</td>
                  <td style={sm.tdIdeal}>{j.ideal}°</td>
                  <td>
                    <span style={{ ...sm.pctBadge, ...scoreBadgeStyle(j.dirPct) }}>
                      {j.dirPct !== null ? `${j.dirPct}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={sm.legend}>
          <span style={{ color: '#81c784' }}>🟢 ≥ 90%</span>
          <span style={{ color: '#ffd54f' }}>🟡 75–89%</span>
          <span style={{ color: '#ef9a9a' }}>🔴 &lt; 75%</span>
        </div>
      </div>
    </div>
  );
}

const sm: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
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
    borderRadius: 12,
  },
  lightboxHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, flexShrink: 0 },
  zoomHint: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 4,
    fontWeight: 400,
  },
  sheet: {
    background: '#0f1221',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '28px 28px 0 0',
    width: '100%',
    maxWidth: 720,
    maxHeight: '92dvh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 16px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    background: '#0f1221',
    zIndex: 10,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#cce0ff',
    padding: '9px 14px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerCenter: { flex: 1, display: 'flex', justifyContent: 'center' },
  headerTitles: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
  },
  golpeLabel: { fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.3 },
  atletaMeta: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 },
  scoreChip: {
    padding: '8px 16px',
    borderRadius: 20,
    fontSize: 16,
    fontWeight: 800,
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
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase' as const,
  },
  img: {
    width: '100%',
    aspectRatio: '4/3',
    objectFit: 'cover',
    borderRadius: 12,
    background: '#000',
    cursor: 'zoom-in',
  },
  imgPlaceholder: {
    width: '100%',
    aspectRatio: '4/3',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    border: '1px dashed rgba(255,255,255,0.12)',
  },
  imageCredit: {
    margin: 0,
    fontSize: 9,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center' as const,
    lineHeight: 1.4,
  },
  tableWrapper: { overflowX: 'auto', padding: '0 16px', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 420 },
  th: {
    padding: '10px 8px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center' as const,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    whiteSpace: 'nowrap' as const,
  },
  tdLabel: {
    padding: '10px 8px',
    fontSize: 14,
    fontWeight: 700,
    color: '#e0e0e0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap' as const,
  },
  tdVal: {
    padding: '10px 8px',
    fontSize: 16,
    fontWeight: 800,
    textAlign: 'center' as const,
    color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontVariantNumeric: 'tabular-nums',
  },
  tdIdeal: {
    padding: '10px 8px',
    fontSize: 13,
    textAlign: 'center' as const,
    color: 'rgba(255,255,255,0.45)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  pctBadge: {
    display: 'inline-block',
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 800,
    textAlign: 'center' as const,
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: 20,
    padding: '12px 16px 0',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
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
