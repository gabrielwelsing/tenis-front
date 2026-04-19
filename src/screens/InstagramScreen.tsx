// =============================================================================
// INSTAGRAM SCREEN — Recorte 9:16 para Stories/Reels com FFmpeg WASM
// =============================================================================

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = 'select' | 'trim' | 'processing' | 'done';

interface CropBox {
  x: number; // normalized 0-1 relative to video display
  y: number;
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

export default function InstagramScreen({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Crop box state (normalized 0-1)
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0.5, y: 0.5 });

  // Processing
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Drag state
  const dragStartRef = useRef<{ px: number; py: number; bx: number; by: number } | null>(null);

  // ---------------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------------

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setPhase('trim');
    setCropBox({ x: 0.5, y: 0.5 });
    setTrimStart(0);
    setTrimEnd(0);
    setOutputUrl(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('video/')) return;
    const synth = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileChange(synth);
  };

  // ---------------------------------------------------------------------------
  // Video metadata
  // ---------------------------------------------------------------------------

  const handleVideoLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDuration(v.duration);
    setTrimEnd(v.duration);
  };

  // ---------------------------------------------------------------------------
  // Trim sliders (simple dual range via two overlapping inputs)
  // ---------------------------------------------------------------------------

  const trimDuration = trimEnd - trimStart;
  const tooLong = trimDuration > 90;

  // ---------------------------------------------------------------------------
  // Crop box drag
  // ---------------------------------------------------------------------------

  const getCropBoxPx = (): { left: number; top: number; width: number; height: number } => {
    const container = videoContainerRef.current;
    if (!container) return { left: 0, top: 0, width: 100, height: 178 };
    const { clientWidth: w, clientHeight: h } = container;
    // 9:16 box: width = h*(9/16), clamped to container
    const boxW = Math.min(h * (9 / 16), w);
    const boxH = boxW * (16 / 9);
    const left = clamp(cropBox.x * w - boxW / 2, 0, w - boxW);
    const top = clamp(cropBox.y * h - boxH / 2, 0, h - boxH);
    return { left, top, width: boxW, height: boxH };
  };

  const boxPx = getCropBoxPx();

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = videoContainerRef.current;
    if (!container) return;
    const { clientWidth: w, clientHeight: h } = container;
    const px = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const py = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragStartRef.current = { px, py, bx: cropBox.x * w, by: cropBox.y * h };
  };

  const onDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragStartRef.current || !videoContainerRef.current) return;
    const container = videoContainerRef.current;
    const { clientWidth: w, clientHeight: h } = container;
    const px = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const py = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    const dx = px - dragStartRef.current.px;
    const dy = py - dragStartRef.current.py;
    const newBx = dragStartRef.current.bx + dx;
    const newBy = dragStartRef.current.by + dy;
    setCropBox({
      x: clamp(newBx / w, 0, 1),
      y: clamp(newBy / h, 0, 1),
    });
  }, []);

  const onDragEnd = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  // ---------------------------------------------------------------------------
  // FFmpeg processing
  // ---------------------------------------------------------------------------

  const handleProcess = async () => {
    if (!videoFile || tooLong) return;
    setPhase('processing');
    setProgress(0);
    setProgressMsg('Carregando FFmpeg...');

    try {
      let ffmpeg = ffmpegRef.current;
      if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
      }

      if (!ffmpeg.loaded) {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
        setProgressMsg(`Processando... ${Math.round(p * 100)}%`);
      });

      ffmpeg.on('log', ({ message }) => {
        if (message.includes('frame=') || message.includes('time=')) {
          setProgressMsg(`Convertendo...`);
        }
      });

      setProgressMsg('Lendo arquivo...');
      const inputData = await fetchFile(videoFile);
      await ffmpeg.writeFile('input.mp4', inputData);

      // Compute FFmpeg crop values from normalized crop box
      const container = videoContainerRef.current;
      const v = videoRef.current;
      let cropX = 0, cropY = 0, cropW = 0, cropH = 0;

      if (container && v) {
        const dispW = container.clientWidth;
        const dispH = container.clientHeight;
        const intrinsicW = v.videoWidth || dispW;
        const intrinsicH = v.videoHeight || dispH;
        const scaleX = intrinsicW / dispW;
        const scaleY = intrinsicH / dispH;

        const boxW_px = Math.min(dispH * (9 / 16), dispW);
        const boxH_px = boxW_px * (16 / 9);
        const boxLeft = clamp(cropBox.x * dispW - boxW_px / 2, 0, dispW - boxW_px);
        const boxTop = clamp(cropBox.y * dispH - boxH_px / 2, 0, dispH - boxH_px);

        cropX = Math.round(boxLeft * scaleX);
        cropY = Math.round(boxTop * scaleY);
        cropW = Math.round(boxW_px * scaleX);
        cropH = Math.round(boxH_px * scaleY);
        // Clamp to intrinsic
        cropW = Math.min(cropW, intrinsicW - cropX);
        cropH = Math.min(cropH, intrinsicH - cropY);
      } else {
        cropW = 1080; cropH = 1920; cropX = 0; cropY = 0;
      }

      const duration = trimEnd - trimStart;

      setProgressMsg('Processando vídeo...');
      await ffmpeg.exec([
        '-ss', String(trimStart.toFixed(3)),
        '-i', 'input.mp4',
        '-t', String(duration.toFixed(3)),
        '-vf', `crop=${cropW}:${cropH}:${cropX}:${cropY},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        'output.mp4',
      ]);

      setProgressMsg('Finalizando...');
      const outputData = await ffmpeg.readFile('output.mp4');
      const rawData = outputData as Uint8Array;
      const copyBuf = new ArrayBuffer(rawData.byteLength);
      new Uint8Array(copyBuf).set(rawData);
      const blob = new Blob([copyBuf], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setPhase('done');
    } catch (err) {
      console.error('[FFmpeg]', err);
      alert('Erro ao processar vídeo. Tente um arquivo menor.');
      setPhase('trim');
    }
  };

  // ---------------------------------------------------------------------------
  // Share / Download
  // ---------------------------------------------------------------------------

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = 'reel_tenis.mp4';
    a.click();
  };

  const handleShare = async () => {
    if (!outputUrl || !navigator.share) return;
    try {
      const resp = await fetch(outputUrl);
      const blob = await resp.blob();
      const file = new File([blob], 'reel_tenis.mp4', { type: 'video/mp4' });
      await navigator.share({ files: [file], title: 'Reel de Tênis' });
    } catch {
      alert('Compartilhamento não disponível neste dispositivo.');
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Select phase
  // ---------------------------------------------------------------------------

  if (phase === 'select') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button onClick={onBack} style={s.backBtn}>← Voltar</button>
          <h1 style={s.pageTitle}>Instagram Reels</h1>
        </div>
        <div
          style={s.dropZone}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <span style={{ fontSize: 48 }}>📁</span>
          <p style={s.dropText}>Escolher Vídeo</p>
          <p style={s.dropHint}>Selecione um vídeo horizontal (da câmera ou galeria)</p>
          <p style={s.dropHint}>Arraste e solte aqui (desktop)</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Processing phase
  // ---------------------------------------------------------------------------

  if (phase === 'processing') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <h1 style={s.pageTitle}>Processando...</h1>
        </div>
        <div style={s.processingArea}>
          <div style={{ fontSize: 56 }}>⚙️</div>
          <p style={s.progressMsg}>{progressMsg}</p>
          <div style={s.progressBarBg}>
            <div style={{ ...s.progressBarFill, width: `${progress}%` }} />
          </div>
          <p style={s.progressPct}>{progress}%</p>
          <p style={s.processingNote}>
            O processamento é feito localmente no seu aparelho. Não feche o aplicativo.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Done phase
  // ---------------------------------------------------------------------------

  if (phase === 'done' && outputUrl) {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button onClick={() => setPhase('trim')} style={s.backBtn}>← Voltar</button>
          <h1 style={s.pageTitle}>Pronto! 🎉</h1>
        </div>
        <div style={s.doneArea}>
          <video
            src={outputUrl}
            style={s.outputVideo}
            controls
            playsInline
          />
          <div style={s.doneActions}>
            <button onClick={handleDownload} style={{ ...s.primaryBtn, background: '#1565c0' }}>
              ⬇️ Baixar para o celular
            </button>
            {typeof navigator.share === 'function' && (
              <button onClick={handleShare} style={{ ...s.primaryBtn, background: '#c2185b' }}>
                📤 Compartilhar
              </button>
            )}
            <button onClick={() => { setPhase('select'); setVideoFile(null); setVideoUrl(null); setOutputUrl(null); }} style={s.secondaryBtn}>
              🔄 Processar outro vídeo
            </button>
          </div>
          <div style={s.instagramNote}>
            <p style={s.noteText}>
              Após baixar, abra o Instagram → Nova publicação → Selecione o vídeo
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Trim phase
  // ---------------------------------------------------------------------------

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button onClick={() => setPhase('select')} style={s.backBtn}>← Voltar</button>
        <h1 style={s.pageTitle}>Recortar para Reels</h1>
      </div>

      <div style={s.trimPage}>
        {/* Instructions */}
        <div style={s.instrRow}>
          <div style={s.instrBox}>
            <span style={s.instrIcon}>📐</span>
            <span style={s.instrText}>Arraste o quadro para focar no tenista.</span>
          </div>
          <div style={s.instrBox}>
            <span style={s.instrIcon}>✂️</span>
            <span style={s.instrText}>Use os marcadores para definir o trecho do vídeo.</span>
          </div>
        </div>

        {/* Video + crop overlay */}
        <div ref={videoContainerRef} style={s.videoContainer}>
          <video
            ref={videoRef}
            src={videoUrl!}
            style={s.video}
            controls={false}
            playsInline
            onLoadedMetadata={handleVideoLoaded}
            onLoadedData={handleVideoLoaded}
          />

          {/* Dark mask outside crop box */}
          <div style={{ ...s.mask, right: `${100 - boxPx.left / (videoContainerRef.current?.clientWidth || 1) * 100}%` }} />
          <div style={{ ...s.mask, left: `${(boxPx.left + boxPx.width) / (videoContainerRef.current?.clientWidth || 1) * 100}%` }} />
          <div style={{ ...s.maskH, bottom: `${100 - boxPx.top / (videoContainerRef.current?.clientHeight || 1) * 100}%`, left: `${boxPx.left / (videoContainerRef.current?.clientWidth || 1) * 100}%`, width: boxPx.width }} />
          <div style={{ ...s.maskH, top: `${(boxPx.top + boxPx.height) / (videoContainerRef.current?.clientHeight || 1) * 100}%`, left: `${boxPx.left / (videoContainerRef.current?.clientWidth || 1) * 100}%`, width: boxPx.width }} />

          {/* Crop box handle */}
          <div
            style={{
              ...s.cropBox,
              left: boxPx.left,
              top: boxPx.top,
              width: boxPx.width,
              height: boxPx.height,
            }}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <span style={s.cropLabel}>9:16</span>
          </div>

          {/* Play/pause overlay */}
          <button
            style={s.playOverlay}
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) v.play();
              else v.pause();
            }}
          >
            ▶/⏸
          </button>
        </div>

        {/* Trim sliders */}
        <div style={s.trimSection}>
          <p style={s.trimLabel}>Início: {fmtTime(trimStart)}</p>
          <input
            type="range"
            min={0}
            max={videoDuration || 1}
            step={0.1}
            value={trimStart}
            style={s.slider}
            onChange={e => {
              const v = Math.min(Number(e.target.value), trimEnd - 1);
              setTrimStart(v);
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
          />
          <p style={s.trimLabel}>Fim: {fmtTime(trimEnd)}</p>
          <input
            type="range"
            min={0}
            max={videoDuration || 1}
            step={0.1}
            value={trimEnd}
            style={s.slider}
            onChange={e => {
              const v = Math.max(Number(e.target.value), trimStart + 1);
              setTrimEnd(v);
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
          />
          <p style={s.trimInfo}>
            De {fmtTime(trimStart)} até {fmtTime(trimEnd)} ({trimDuration.toFixed(1)}s)
          </p>
          {tooLong && (
            <div style={s.warnBanner}>
              ⚠️ Reels aceitam até 90s. Selecione um trecho menor.
            </div>
          )}
        </div>

        {/* Process button */}
        <div style={s.processFooter}>
          <button
            onClick={handleProcess}
            disabled={tooLong || trimDuration < 1}
            style={{
              ...s.primaryBtn,
              background: '#c2185b',
              opacity: tooLong || trimDuration < 1 ? 0.4 : 1,
            }}
          >
            🎬 Processar para Instagram
          </button>
        </div>
      </div>
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
    flexShrink: 0,
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

  // Select phase
  dropZone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    margin: 24,
    border: '2px dashed rgba(255,255,255,0.25)',
    borderRadius: 20,
    cursor: 'pointer',
    padding: 32,
    background: 'rgba(255,255,255,0.04)',
  },
  dropText: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: '#fff',
  },
  dropHint: {
    color: '#888',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },

  // Trim phase
  trimPage: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  instrRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    flexShrink: 0,
  },
  instrBox: {
    flex: 1,
    display: 'flex',
    gap: 6,
    alignItems: 'flex-start',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '8px 10px',
  },
  instrIcon: { fontSize: 16, flexShrink: 0 },
  instrText: { color: '#bbb', fontSize: 12, lineHeight: 1.4 },

  videoContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#000',
    minHeight: 200,
    maxHeight: 380,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 2,
    pointerEvents: 'none',
  },
  maskH: {
    position: 'absolute',
    background: 'rgba(0,0,0,0.55)',
    height: '50%',
    zIndex: 2,
    pointerEvents: 'none',
  },
  cropBox: {
    position: 'absolute',
    border: '2px solid #fff',
    zIndex: 3,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    touchAction: 'none',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
  },
  cropLabel: {
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 10,
    padding: '2px 6px',
    fontWeight: 700,
  },
  playOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 20,
    fontSize: 14,
    cursor: 'pointer',
    zIndex: 4,
    minHeight: 44,
  },

  trimSection: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.3)',
  },
  trimLabel: {
    color: '#cce0ff',
    fontSize: 13,
    margin: 0,
    fontWeight: 600,
  },
  slider: {
    width: '100%',
    accentColor: '#c2185b',
    height: 32,
  },
  trimInfo: {
    color: '#b3e5fc',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },
  warnBanner: {
    background: 'rgba(255,152,0,0.15)',
    border: '1px solid rgba(255,152,0,0.4)',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#ffcc80',
    fontSize: 13,
    textAlign: 'center',
  },

  processFooter: {
    padding: '12px 16px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
    flexShrink: 0,
  },
  primaryBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 14,
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
  },
  secondaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#ccc',
    fontSize: 14,
    cursor: 'pointer',
    minHeight: 44,
  },

  // Processing phase
  processingArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 32,
  },
  progressMsg: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    maxWidth: 360,
    height: 12,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #c2185b, #7b1fa2)',
    borderRadius: 6,
    transition: 'width 0.3s ease',
  },
  progressPct: {
    color: '#e040fb',
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
  },
  processingNote: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.5,
  },

  // Done phase
  doneArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 16,
    overflowY: 'auto',
  },
  outputVideo: {
    width: '100%',
    maxHeight: 400,
    borderRadius: 14,
    background: '#000',
    objectFit: 'contain',
  },
  doneActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  instagramNote: {
    background: 'rgba(194,24,91,0.1)',
    border: '1px solid rgba(194,24,91,0.3)',
    borderRadius: 12,
    padding: '12px 16px',
  },
  noteText: {
    color: '#f48fb1',
    fontSize: 13,
    margin: 0,
    lineHeight: 1.5,
    textAlign: 'center',
  },
};
