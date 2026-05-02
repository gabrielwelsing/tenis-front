// =============================================================================
// INSTAGRAM SCREEN — Recorte 9:16 para Stories/Reels com FFmpeg WASM
// =============================================================================

import React, { useRef, useState, useEffect, useCallback } from 'react';

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

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.8" cy="7.4" r="1" fill="currentColor" />
    </svg>
  );
}

function CropIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3.8v13.2h13.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7h13v13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="11.5" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 10.2 20 8v8l-4.5-2.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
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
  const [outputMime, setOutputMime] = useState('video/mp4');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // AudioContext kept alive across renders (createMediaElementSource can only be called once)
  const audioCtxRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);

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

  // Compute intrinsic crop coords from the overlay box position
  const computeCrop = () => {
    const container = videoContainerRef.current;
    const v = videoRef.current;
    if (!container || !v) return null;

    const dispW = container.clientWidth;
    const dispH = container.clientHeight;
    const intrW = v.videoWidth || dispW;
    const intrH = v.videoHeight || dispH;

    // letterbox/pillarbox offsets (objectFit: contain)
    const vidAspect = intrW / intrH;
    const conAspect = dispW / dispH;
    let vidDispW: number, vidDispH: number, vidOffX: number, vidOffY: number;
    if (vidAspect > conAspect) {
      vidDispW = dispW; vidDispH = dispW / vidAspect;
      vidOffX = 0; vidOffY = (dispH - vidDispH) / 2;
    } else {
      vidDispH = dispH; vidDispW = dispH * vidAspect;
      vidOffX = (dispW - vidDispW) / 2; vidOffY = 0;
    }

    const boxW = Math.min(dispH * (9 / 16), dispW);
    const boxH = boxW * (16 / 9);
    const boxLeft = clamp(cropBox.x * dispW - boxW / 2, 0, dispW - boxW);
    const boxTop  = clamp(cropBox.y * dispH - boxH / 2, 0, dispH - boxH);

    const scaleX = intrW / vidDispW;
    const scaleY = intrH / vidDispH;

    const cropX = Math.max(0, Math.round((boxLeft - vidOffX) * scaleX));
    const cropY = Math.max(0, Math.round((boxTop  - vidOffY) * scaleY));
    const cropW = Math.min(Math.round(boxW * scaleX), intrW - cropX);
    const cropH = Math.min(Math.round(boxH * scaleY), intrH - cropY);

    return { cropX, cropY, cropW, cropH, intrW, intrH };
  };

  const handleProcess = async () => {
    if (tooLong || trimDuration < 1) return;
    setPhase('processing');
    setProgress(0);
    setProgressMsg('Preparando...');

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      const v = videoRef.current!;
      const crop = computeCrop();
      if (!crop) throw new Error('Sem dados de vídeo');
      const { cropX, cropY, cropW, cropH } = crop;

      // Output canvas — 720×1280 (good quality, manageable on mobile)
      const OUT_W = 720, OUT_H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W; canvas.height = OUT_H;
      const ctx = canvas.getContext('2d')!;

      // Pick best supported MIME type
      const mimeType = (
        ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
          .find(m => MediaRecorder.isTypeSupported(m))
      ) ?? 'video/webm';

      setOutputMime(mimeType);
      const canvasStream = canvas.captureStream(30);

      // Capture audio from the video element via AudioContext
      try {
        if (!audioCtxRef.current) {
          const ctx2 = new AudioContext();
          const source = ctx2.createMediaElementSource(v);
          const dest = ctx2.createMediaStreamDestination();
          source.connect(dest);
          source.connect(ctx2.destination); // also play to speaker
          audioCtxRef.current = { ctx: ctx2, dest };
        }
        await audioCtxRef.current.ctx.resume();
        const audioTrack = audioCtxRef.current.dest.stream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);
      } catch {
        // Audio capture not available — continue without audio
      }

      const mr = new MediaRecorder(canvasStream, { mimeType });
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const duration = trimEnd - trimStart;

      // Seek to start
      await new Promise<void>((res) => {
        v.currentTime = trimStart;
        v.onseeked = () => res();
      });

      await new Promise<void>((resolve, reject) => {
        mr.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          setOutputUrl(URL.createObjectURL(blob));
          resolve();
        };
        mr.onerror = () => reject(new Error('MediaRecorder falhou'));

        // Draw first frame before starting recorder
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, OUT_W, OUT_H);
        ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, OUT_W, OUT_H);
        mr.start(200);

        // muted = true permite autoplay no iOS mesmo após await (contexto de gesture perdido)
        // O áudio vem pelo AudioContext independentemente do atributo muted do elemento
        v.muted = true;
        v.playbackRate = 1;
        v.play().catch(reject);

        const tick = () => {
          if (v.paused || v.ended || v.currentTime >= trimEnd) {
            v.pause();
            ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, OUT_W, OUT_H);
            if (mr.state === 'recording') mr.stop();
            return;
          }
          const elapsed = v.currentTime - trimStart;
          const pct = Math.round(clamp(elapsed / duration, 0, 1) * 100);
          setProgress(pct);
          setProgressMsg(`Processando... ${pct}%`);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, OUT_W, OUT_H);
          ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, OUT_W, OUT_H);
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      });

      // Restaura muted para que o vídeo original toque com áudio novamente
      if (videoRef.current) videoRef.current.muted = false;
      setPhase('done');
    } catch (err) {
      console.error('[Processing]', err);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current) videoRef.current.muted = false;
      alert('Erro ao processar vídeo. Verifique se o formato é suportado pelo seu navegador.');
      setPhase('trim');
    }
  };

  // ---------------------------------------------------------------------------
  // Share / Download
  // ---------------------------------------------------------------------------

  const outputExt = outputMime.includes('mp4') ? 'mp4' : 'webm';
  const outputFilename = `reel_tenis.${outputExt}`;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const canShareFiles = typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  const handleSaveOrShare = async () => {
    if (!outputUrl) return;
    try {
      const resp = await fetch(outputUrl);
      const blob = await resp.blob();
      const file = new File([blob], outputFilename, { type: outputMime });
      if (canShareFiles && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Reel de Tênis' });
      } else {
        // Fallback: trigger download
        const a = document.createElement('a');
        a.href = outputUrl;
        a.download = outputFilename;
        a.click();
      }
    } catch (err: unknown) {
      // User cancelled share — not an error
      if (err instanceof Error && err.name !== 'AbortError') {
        const a = document.createElement('a');
        a.href = outputUrl;
        a.download = outputFilename;
        a.click();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Select phase
  // ---------------------------------------------------------------------------

  if (phase === 'select') {
    return (
      <div style={s.page}>
        <div style={s.bgGlow1} />
        <div style={s.bgGlow2} />

        <div style={s.topBar}>
          <button onClick={onBack} style={s.backBtn}>‹</button>
          <div style={s.titleBlock}>
            <h1 style={s.pageTitle}>Instagram Reels</h1>
            <p style={s.pageSub}>Recorte vídeos em 9:16 para Stories/Reels</p>
          </div>
          <div style={s.headerIcon}>
            <InstagramIcon size={21} />
          </div>
        </div>

        <div style={s.inner}>
          <section style={s.heroCard}>
            <span style={s.heroKicker}>FORMATO 9:16</span>
            <h2 style={s.heroTitle}>Transforme seu vídeo em Reel</h2>
            <p style={s.heroText}>
              Escolha um vídeo, ajuste o enquadramento vertical e gere um arquivo pronto para publicar.
            </p>
          </section>

          <div
            style={s.dropZone}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
          >
            <div style={s.dropIcon}>
              <VideoIcon size={34} />
            </div>
            <p style={s.dropText}>Escolher vídeo</p>
            <p style={s.dropHint}>Selecione um vídeo horizontal da câmera ou galeria.</p>
            <p style={s.dropHint}>No desktop, também é possível arrastar e soltar aqui.</p>
          </div>
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
        <div style={s.bgGlow1} />
        <div style={s.bgGlow2} />

        <div style={s.topBar}>
          <div style={s.headerSpacer} />
          <div style={s.titleBlock}>
            <h1 style={s.pageTitle}>Processando</h1>
            <p style={s.pageSub}>Gerando o vídeo vertical</p>
          </div>
          <div style={s.headerIcon}>
            <CropIcon size={21} />
          </div>
        </div>

        <div style={s.processingArea}>
          <div style={s.processingIcon}>⚙️</div>
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
        <div style={s.bgGlow1} />
        <div style={s.bgGlow2} />

        <div style={s.topBar}>
          <button onClick={() => setPhase('trim')} style={s.backBtn}>‹</button>
          <div style={s.titleBlock}>
            <h1 style={s.pageTitle}>Pronto!</h1>
            <p style={s.pageSub}>Seu vídeo vertical foi gerado</p>
          </div>
          <div style={s.headerIcon}>
            <InstagramIcon size={21} />
          </div>
        </div>

        <div style={s.doneArea}>
          <video
            src={outputUrl}
            style={s.outputVideo}
            controls
            playsInline
          />

          <div style={s.doneActions}>
            <button onClick={handleSaveOrShare} style={s.primaryBtn}>
              {isIOS ? 'Salvar no Rolo da Câmera' : 'Salvar vídeo'}
            </button>

            <button
              onClick={() => { setPhase('select'); setVideoFile(null); setVideoUrl(null); setOutputUrl(null); }}
              style={s.secondaryBtn}
            >
              Processar outro vídeo
            </button>
          </div>

          <div style={s.instagramNote}>
            <p style={s.noteText}>
              {isIOS
                ? 'Toque em “Salvar no Rolo da Câmera” e escolha “Salvar Vídeo” para enviar às Fotos.'
                : 'Após salvar, abra o Instagram, crie uma nova publicação e selecione o vídeo.'}
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
      <div style={s.bgGlow1} />
      <div style={s.bgGlow2} />

      <div style={s.topBar}>
        <button onClick={() => setPhase('select')} style={s.backBtn}>‹</button>
        <div style={s.titleBlock}>
          <h1 style={s.pageTitle}>Recortar para Reels</h1>
          <p style={s.pageSub}>Ajuste enquadramento e duração</p>
        </div>
        <div style={s.headerIcon}>
          <CropIcon size={21} />
        </div>
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
            <span style={s.instrText}>Use os marcadores para definir o trecho.</span>
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
          <div style={s.trimLine}>
            <span style={s.trimLabel}>Início</span>
            <strong style={s.trimTime}>{fmtTime(trimStart)}</strong>
          </div>

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

          <div style={s.trimLine}>
            <span style={s.trimLabel}>Fim</span>
            <strong style={s.trimTime}>{fmtTime(trimEnd)}</strong>
          </div>

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
              Reels aceitam até 90s. Selecione um trecho menor.
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
              opacity: tooLong || trimDuration < 1 ? 0.42 : 1,
            }}
          >
            Gerar Reel 9:16
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
    zIndex: 5,
    display: 'grid',
    gridTemplateColumns: '44px 1fr 44px',
    alignItems: 'center',
    gap: 10,
    padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
    background: '#fbf7f1',
    flexShrink: 0,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: 'none',
    background: '#f3e8de',
    color: '#7a5142',
    fontSize: 30,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 42,
    height: 42,
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
    flex: 1,
    letterSpacing: -0.7,
    color: '#2d2521',
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

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: '#f3e8de',
    color: '#7a5142',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inner: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '4px 16px 32px',
    maxWidth: 540,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    minHeight: 132,
    background: 'linear-gradient(135deg, #c66b4d, #8f4635)',
    boxShadow: '0 16px 34px rgba(134,72,50,0.20)',
    padding: '20px 18px',
    boxSizing: 'border-box',
  },

  heroKicker: {
    color: 'rgba(255,245,235,0.82)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.3,
  },

  heroTitle: {
    color: '#fff8ef',
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1.08,
    letterSpacing: -0.7,
    margin: '7px 0 0',
  },

  heroText: {
    color: 'rgba(255,248,239,0.86)',
    fontSize: 12.5,
    fontWeight: 650,
    lineHeight: 1.38,
    margin: '8px 0 0',
  },

  // Select phase
  dropZone: {
    flex: 1,
    minHeight: 340,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    border: '1.5px dashed rgba(130,82,62,0.18)',
    borderRadius: 24,
    cursor: 'pointer',
    padding: '36px 24px',
    background: '#fff',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
    textAlign: 'center',
  },

  dropIcon: {
    width: 76,
    height: 76,
    borderRadius: '50%',
    background: '#fff1eb',
    color: '#c66b4d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  dropText: {
    fontSize: 21,
    fontWeight: 950,
    margin: 0,
    color: '#2d2521',
    letterSpacing: -0.4,
  },

  dropHint: {
    color: '#94857a',
    fontSize: 12.5,
    fontWeight: 650,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.35,
    maxWidth: 300,
  },

  // Trim phase
  trimPage: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },

  instrRow: {
    display: 'flex',
    gap: 8,
    padding: '4px 12px 10px',
    flexShrink: 0,
  },

  instrBox: {
    flex: 1,
    display: 'flex',
    gap: 7,
    alignItems: 'flex-start',
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 16,
    padding: '10px 11px',
    boxShadow: '0 8px 20px rgba(117,76,56,0.05)',
  },

  instrIcon: {
    fontSize: 16,
    flexShrink: 0,
  },

  instrText: {
    color: '#7b675d',
    fontSize: 12.2,
    fontWeight: 650,
    lineHeight: 1.35,
  },

  videoContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#000',
    minHeight: 220,
    maxHeight: 390,
    borderRadius: 24,
    margin: '0 12px',
    boxShadow: '0 14px 32px rgba(44,30,24,0.22)',
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
    background: 'rgba(0,0,0,0.58)',
    zIndex: 2,
    pointerEvents: 'none',
  },

  maskH: {
    position: 'absolute',
    background: 'rgba(0,0,0,0.58)',
    height: '50%',
    zIndex: 2,
    pointerEvents: 'none',
  },

  cropBox: {
    position: 'absolute',
    border: '2px solid #fff8ef',
    zIndex: 3,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    touchAction: 'none',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 0 24px rgba(255,248,239,0.24)',
  },

  cropLabel: {
    background: 'rgba(80,42,29,0.82)',
    color: '#fff8ef',
    fontSize: 10,
    padding: '3px 7px',
    fontWeight: 900,
    borderRadius: '0 0 8px 0',
  },

  playOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    background: 'rgba(80,42,29,0.78)',
    border: '1px solid rgba(255,248,239,0.22)',
    color: '#fff8ef',
    padding: '9px 13px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    zIndex: 4,
    minHeight: 44,
  },

  trimSection: {
    margin: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    flexShrink: 0,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    boxShadow: '0 10px 24px rgba(117,76,56,0.06)',
  },

  trimLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  trimLabel: {
    color: '#8f7769',
    fontSize: 11.5,
    margin: 0,
    fontWeight: 850,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
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
    height: 30,
  },

  trimInfo: {
    color: '#8b5b49',
    background: '#fff4ed',
    border: '1px solid rgba(198,107,77,0.14)',
    borderRadius: 999,
    padding: '8px 10px',
    fontSize: 12.5,
    margin: '3px 0 0',
    textAlign: 'center',
    fontWeight: 850,
  },

  warnBanner: {
    background: '#fff4e8',
    border: '1px solid rgba(179,106,47,0.22)',
    borderRadius: 14,
    padding: '10px 12px',
    color: '#b36a2f',
    fontSize: 12.5,
    fontWeight: 750,
    textAlign: 'center',
  },

  processFooter: {
    padding: '0 12px max(12px, env(safe-area-inset-bottom, 12px))',
    flexShrink: 0,
  },

  primaryBtn: {
    width: '100%',
    padding: '15px',
    borderRadius: 17,
    border: 'none',
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 950,
    cursor: 'pointer',
    minHeight: 52,
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  secondaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 16,
    background: '#fff',
    border: '1px solid rgba(198,107,77,0.18)',
    color: '#a65440',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    minHeight: 46,
  },

  // Processing phase
  processingArea: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 32,
    textAlign: 'center',
  },

  processingIcon: {
    width: 78,
    height: 78,
    borderRadius: '50%',
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 34,
  },

  progressMsg: {
    color: '#2d2521',
    fontSize: 20,
    fontWeight: 950,
    margin: 0,
    textAlign: 'center',
    letterSpacing: -0.4,
  },

  progressBarBg: {
    width: '100%',
    maxWidth: 360,
    height: 13,
    borderRadius: 999,
    background: '#eadfd6',
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #c66b4d, #934836)',
    borderRadius: 999,
    transition: 'width 0.3s ease',
  },

  progressPct: {
    color: '#c66b4d',
    fontSize: 30,
    fontWeight: 950,
    margin: 0,
  },

  processingNote: {
    color: '#94857a',
    fontSize: 12.5,
    fontWeight: 650,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.55,
    margin: 0,
  },

  // Done phase
  doneArea: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '4px 16px 28px',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    maxWidth: 540,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  outputVideo: {
    width: '100%',
    maxHeight: 430,
    borderRadius: 24,
    background: '#000',
    objectFit: 'contain',
    boxShadow: '0 14px 32px rgba(44,30,24,0.18)',
  },

  doneActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  instagramNote: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 20,
    padding: '13px 15px',
    boxShadow: '0 10px 24px rgba(117,76,56,0.06)',
  },

  noteText: {
    color: '#7b675d',
    fontSize: 13,
    fontWeight: 650,
    margin: 0,
    lineHeight: 1.5,
    textAlign: 'center',
  },
};
