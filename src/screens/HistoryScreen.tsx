// =============================================================================
// HISTORY SCREEN — Lista de lances gravados
// Drive mode: busca do backend. Local mode: busca do localStorage.
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { SaveMode } from '../App';
import { getClips, type ClipRecord } from '@services/apiService';
import { getLocalClips, type LocalClipRecord } from '@services/localSaveService';

interface DisplayClip {
  id: string;
  timestamp: number;
  videoDurationMs: number;
  audioDurationMs?: number | null;
  label?: string;
  driveVideoUrl?: string;
  syncStatus?: string;
}

const STATUS_LABEL: Record<string, string> = {
  synced: 'No Drive',
  pending: 'Na fila',
  uploading: 'Enviando',
  error: 'Erro',
};

const STATUS_COLOR: Record<string, string> = {
  synced: '#3f8f5b',
  pending: '#8d7b70',
  uploading: '#b36a2f',
  error: '#c95441',
};

const STATUS_BG: Record<string, string> = {
  synced: '#edf8ef',
  pending: '#f1e9e4',
  uploading: '#fff4e8',
  error: '#fff4f0',
};

function fromDrive(c: ClipRecord): DisplayClip {
  return {
    id: c.id,
    timestamp: Number(c.timestamp),
    videoDurationMs: c.videoDurationMs ?? 0,
    audioDurationMs: c.audioDurationMs,
    driveVideoUrl: c.driveVideoUrl,
    syncStatus: c.syncStatus,
  };
}

function fromLocal(c: LocalClipRecord): DisplayClip {
  return {
    id: c.id,
    timestamp: c.timestamp,
    videoDurationMs: c.videoDurationMs,
    audioDurationMs: c.audioDurationMs,
    label: c.lanceName,
  };
}

function HistoryIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 6.5h5l1.5 2h8.5v9.2a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 13h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="11.5" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 10.2 20 8v8l-4.5-2.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 11.5c0 3.1 2.2 5.2 5.5 5.2s5.5-2.1 5.5-5.2M12 16.8V20M8.8 20h6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DriveIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 4h7l5 8.7-3.5 6.1H7L3.5 12.7 8.5 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 4 13.7 13M15.5 4 10.3 13M7 18.8 12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function HistoryScreen({ onBack, saveMode }: { onBack: () => void; saveMode: SaveMode }) {
  const [clips,   setClips]   = useState<DisplayClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (saveMode === 'local') {
      setClips(getLocalClips().map(fromLocal));
      setLoading(false);
      return;
    }

    getClips()
      .then((data) => setClips(data.map(fromDrive)))
      .catch(() => setError('Não foi possível carregar os lances. Verifique a conexão.'))
      .finally(() => setLoading(false));
  }, [saveMode]);

  const isEmpty = !loading && !error && clips.length === 0;

  return (
    <div style={s.container}>
      <div style={s.bgGlow1} />
      <div style={s.bgGlow2} />

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>‹</button>

        <div style={s.titleBlock}>
          <h1 style={s.title}>Histórico</h1>
          <p style={s.subtitle}>Lances gravados e comentários salvos</p>
        </div>

        <div style={s.headerIcon}>
          <HistoryIcon size={21} />
        </div>
      </div>

      <div style={s.scrollBody}>
        <div style={s.inner}>
          <section style={s.heroCard}>
            <span style={s.heroKicker}>
              {saveMode === 'local' ? 'ARMAZENAMENTO LOCAL' : 'ARMAZENAMENTO DRIVE'}
            </span>

            <h2 style={s.heroTitle}>Seus lances gravados</h2>

            <p style={s.heroText}>
              Revise vídeos capturados, acompanhe o envio e acesse os arquivos salvos quando disponíveis.
            </p>
          </section>

          {loading && (
            <div style={s.centerCard}>
              <div style={s.spinner} />
              <p style={s.msg}>Carregando lances...</p>
            </div>
          )}

          {error && (
            <div style={s.centerCard}>
              <div style={s.errorIcon}>!</div>
              <p style={s.errorMsg}>{error}</p>
              <button onClick={onBack} style={s.actionBtn}>Voltar para câmera</button>
            </div>
          )}

          {isEmpty && (
            <div style={s.centerCard}>
              <div style={s.emptyIcon}>🎾</div>

              <p style={s.emptyTitle}>Nenhum lance gravado ainda</p>

              <p style={s.emptyHint}>
                Pressione o botão vermelho ou o controle remoto BT durante a gravação.
              </p>

              <button onClick={onBack} style={s.actionBtn}>Voltar para câmera</button>
            </div>
          )}

          {!loading && !error && clips.length > 0 && (
            <div style={s.list}>
              <div style={s.sectionHead}>
                <h3 style={s.sectionTitle}>Lances recentes</h3>
                <span style={s.countPill}>
                  {clips.length} {clips.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {clips.map((c) => {
                const date = new Date(c.timestamp).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const vSec = Math.round(c.videoDurationMs / 1000);
                const aSec = c.audioDurationMs != null ? Math.round(c.audioDurationMs / 1000) : null;
                const statusColor = STATUS_COLOR[c.syncStatus ?? ''] ?? '#8d7b70';
                const statusBg = STATUS_BG[c.syncStatus ?? ''] ?? '#f1e9e4';

                return (
                  <div key={c.id} style={s.card}>
                    <div style={s.cardRow}>
                      <div style={s.clipMain}>
                        <div style={s.clipIcon}>
                          <VideoIcon size={19} />
                        </div>

                        <div style={s.clipText}>
                          <span style={s.lanceName}>{c.label || 'Lance gravado'}</span>
                          <span style={s.date}>{date}</span>
                        </div>
                      </div>

                      {c.syncStatus && (
                        <span
                          style={{
                            ...s.badge,
                            background: statusBg,
                            color: statusColor,
                            borderColor: `${statusColor}22`,
                          }}
                        >
                          {STATUS_LABEL[c.syncStatus] ?? c.syncStatus}
                        </span>
                      )}
                    </div>

                    <div style={s.pills}>
                      <span style={s.pill}>
                        <VideoIcon size={15} />
                        {vSec}s de vídeo
                      </span>

                      {aSec !== null ? (
                        <span style={s.pill}>
                          <MicIcon size={15} />
                          {aSec}s de áudio
                        </span>
                      ) : (
                        <span style={{ ...s.pill, opacity: 0.56 }}>
                          <MicIcon size={15} />
                          sem comentário
                        </span>
                      )}
                    </div>

                    {c.driveVideoUrl && (
                      <a href={c.driveVideoUrl} target="_blank" rel="noreferrer" style={s.link}>
                        <DriveIcon size={17} />
                        Ver no Drive
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Spinner via style tag (React inline styles não suportam @keyframes)
if (typeof document !== 'undefined' && !document.getElementById('tenis-spinner-style')) {
  const el = document.createElement('style');
  el.id = 'tenis-spinner-style';
  el.textContent = `@keyframes tenis-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(el);
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    background: '#fbf7f1',
    color: '#2d2521',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
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

  header: {
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

  titleBlock: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  title: {
    fontSize: 22,
    fontWeight: 950,
    margin: 0,
    color: '#2d2521',
    letterSpacing: -0.7,
    textAlign: 'center',
  },

  subtitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 650,
    color: '#94857a',
    textAlign: 'center',
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

  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    position: 'relative',
    zIndex: 2,
  },

  inner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '4px 16px 38px',
    maxWidth: 540,
    margin: '0 auto',
    boxSizing: 'border-box',
    width: '100%',
    minHeight: '100%',
  },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    minHeight: 128,
    background: 'linear-gradient(135deg, #c66b4d, #8f4635)',
    boxShadow: '0 16px 34px rgba(134,72,50,0.20)',
    padding: '19px 18px',
    boxSizing: 'border-box',
  },

  heroKicker: {
    display: 'block',
    color: 'rgba(255,245,235,0.82)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.35,
    marginBottom: 7,
  },

  heroTitle: {
    color: '#fff8ef',
    fontSize: 23,
    fontWeight: 950,
    lineHeight: 1.08,
    letterSpacing: -0.7,
    margin: 0,
  },

  heroText: {
    color: 'rgba(255,248,239,0.86)',
    fontSize: 12.5,
    fontWeight: 650,
    lineHeight: 1.38,
    margin: '8px 0 0',
    maxWidth: 390,
  },

  centerCard: {
    flex: 1,
    minHeight: 340,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    padding: '34px 22px',
    textAlign: 'center',
    boxShadow: '0 10px 28px rgba(117,76,56,0.07)',
  },

  msg: {
    color: '#94857a',
    fontSize: 13,
    fontWeight: 750,
    margin: 0,
  },

  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#fff4f0',
    color: '#c95441',
    border: '1px solid rgba(201,84,65,0.16)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    fontWeight: 950,
  },

  errorMsg: {
    color: '#c95441',
    fontSize: 13,
    fontWeight: 750,
    margin: 0,
    lineHeight: 1.45,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#fff1eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
  },

  emptyTitle: {
    color: '#2d2521',
    fontSize: 18,
    fontWeight: 950,
    margin: 0,
    letterSpacing: -0.3,
  },

  emptyHint: {
    color: '#94857a',
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.45,
    margin: 0,
    maxWidth: 300,
  },

  actionBtn: {
    background: 'linear-gradient(135deg, #c66b4d, #934836)',
    border: 'none',
    color: '#fff',
    padding: '13px 20px',
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 900,
    minHeight: 46,
    marginTop: 4,
    boxShadow: '0 12px 24px rgba(147,72,54,0.22)',
  },

  spinner: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '3px solid #eadfd6',
    borderTopColor: '#c66b4d',
    animation: 'tenis-spin 0.8s linear infinite',
  },

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '2px 2px 0',
  },

  sectionTitle: {
    margin: 0,
    color: '#342a24',
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: -0.2,
  },

  countPill: {
    padding: '6px 10px',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    color: '#8b5b49',
    fontSize: 11.5,
    fontWeight: 850,
    boxShadow: '0 8px 18px rgba(117,76,56,0.05)',
  },

  card: {
    background: '#fff',
    border: '1px solid rgba(130,82,62,0.08)',
    borderRadius: 22,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 10px 24px rgba(57,37,28,0.06)',
  },

  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  clipMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },

  clipIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    background: '#fff1eb',
    color: '#c66b4d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  clipText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  lanceName: {
    display: 'block',
    color: '#2d2521',
    fontSize: 14,
    fontWeight: 950,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  date: {
    display: 'block',
    color: '#94857a',
    fontSize: 11.5,
    fontWeight: 700,
    marginTop: 1,
  },

  badge: {
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 900,
    border: '1px solid',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  pills: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },

  pill: {
    background: '#fffaf7',
    border: '1px solid rgba(130,82,62,0.08)',
    padding: '7px 10px',
    borderRadius: 999,
    fontSize: 12,
    color: '#77665d',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },

  link: {
    color: '#a65440',
    background: '#fff4ed',
    border: '1px solid rgba(198,107,77,0.18)',
    fontSize: 13,
    fontWeight: 900,
    textDecoration: 'none',
    borderRadius: 15,
    padding: '11px 13px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};
