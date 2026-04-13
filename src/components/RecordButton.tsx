// =============================================================================
// RECORD BUTTON — Botão de clipping (Frontend only)
// =============================================================================

import React, { useRef } from 'react';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  bufferSeconds: number;
}

export function RecordButton({ onPress, disabled = false, bufferSeconds }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    btnRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
      { duration: 200, easing: 'ease-in-out' }
    );
    onPress();
  };

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>
        {bufferSeconds > 0 ? `${bufferSeconds}s no buffer` : 'aguardando...'}
      </span>
      <button
        ref={btnRef}
        onClick={handleClick}
        disabled={disabled}
        style={{ ...styles.button, opacity: disabled ? 0.35 : 1 }}
      >
        <div style={styles.ring}>
          <div style={styles.inner} />
        </div>
      </button>
      <span style={styles.hint}>SALVAR LANCE</span>
      <span style={styles.remote}>ou play/pause no controle BT</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#aaffaa',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  button: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    width: 80,
    height: 80,
    transition: 'opacity .2s',
  },
  ring: {
    width: 76,
    height: 76,
    borderRadius: '50%',
    border: '4px solid #ff4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#ff4444',
  },
  hint: {
    color: '#ffffff88',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: 700,
  },
  remote: {
    color: '#ffffff44',
    fontSize: 9,
    textAlign: 'center',
    maxWidth: 90,
  },
};
