// =============================================================================
// AUDIO RECORDER MODAL — UI de comentário de áudio (Frontend only)
// =============================================================================

import React, { useEffect, useRef } from 'react';

interface Props {
  visible: boolean;
  isRecording: boolean;
  volume: number;       // 0..1
  elapsedSeconds: number;
  onStop: () => void;
  onCancel: () => void;
}

export function AudioRecorderModal({ visible, isRecording, volume, elapsedSeconds, onStop, onCancel }: Props) {
  const pulseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pulseRef.current) return;
    const scale = isRecording ? 1 + volume * 0.3 : 1;
    pulseRef.current.style.transform = `scale(${scale})`;
  }, [volume, isRecording]);

  if (!visible) return null;

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const barH = Math.round(volume * 100);

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <p style={styles.title}>Comentário de Áudio</p>
        <p style={styles.sub}>{isRecording ? 'Gravando...' : 'Iniciando...'}</p>
        <p style={styles.btHint}>🎧 Microfone: Bluetooth (se conectado)</p>

        <div ref={pulseRef} style={{ ...styles.micCircle, transition: 'transform .1s' }}>
          <span style={{ fontSize: 36 }}>🎙</span>
        </div>

        <div style={styles.meter}>
          <div style={{ ...styles.meterBar, height: `${barH}%` }} />
        </div>

        <p style={styles.timer}>{fmt(elapsedSeconds)}</p>

        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Descartar</button>
          <button onClick={onStop}   style={styles.stopBtn}>
            <span style={styles.stopSquare} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: '#000000bb',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: '100%', background: '#1a1a2e',
    borderRadius: '24px 24px 0 0',
    padding: 32,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 },
  sub:   { color: '#ff4444', fontSize: 14, fontWeight: 600, margin: 0 },
  btHint:{ color: '#4fc3f7', fontSize: 11, margin: 0 },
  micCircle: {
    width: 80, height: 80, borderRadius: '50%',
    background: '#ff4444',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  meter: {
    width: 24, height: 80, background: '#333',
    borderRadius: 12, overflow: 'hidden',
    display: 'flex', alignItems: 'flex-end',
  },
  meterBar: { width: '100%', background: '#44ff88', borderRadius: 12, transition: 'height .1s' },
  timer: { color: '#fff', fontSize: 32, fontWeight: 300, margin: 0, fontVariantNumeric: 'tabular-nums' },
  actions: { display: 'flex', gap: 24 },
  cancelBtn: {
    padding: '12px 24px', borderRadius: 12,
    border: '1px solid #555', background: 'transparent',
    color: '#aaa', fontSize: 15, cursor: 'pointer',
  },
  stopBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 28px', borderRadius: 12,
    background: '#ff4444', border: 'none',
    color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
  stopSquare: {
    display: 'inline-block',
    width: 14, height: 14,
    background: '#fff', borderRadius: 2,
  },
};
