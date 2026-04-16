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
  synced: 'No Drive', pending: 'Na fila', uploading: 'Enviando', error: 'Erro',
};
const STATUS_COLOR: Record<string, string> = {
  synced: '#2e7d32', pending: '#555', uploading: '#f9a825', error: '#c62828',
};

function fromDrive(c: ClipRecord): DisplayClip {
  return {
    id: c.id, timestamp: Number(c.timestamp),
    videoDurationMs: c.videoDurationMs ?? 0,
    audioDurationMs: c.audioDurationMs,
    driveVideoUrl: c.driveVideoUrl,
    syncStatus: c.syncStatus,
  };
}

function fromLocal(c: LocalClipRecord): DisplayClip {
  return {
    id: c.id, timestamp: c.timestamp,
    videoDurationMs: c.videoDurationMs,
    audioDurationMs: c.audioDurationMs,
    label: c.lanceName,
  };
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
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Câmera</button>
        <h1 style={s.title}>Lances Gravados</h1>
      </div>

      {loading && (
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={s.msg}>Carregando lances...</p>
        </div>
      )}

      {error && (
        <div style={s.center}>
          <p style={s.errorMsg}>{error}</p>
          <button onClick={onBack} style={s.actionBtn}>← Voltar para Câmera</button>
        </div>
      )}

      {isEmpty && (
        <div style={s.center}>
          <span style={{ fontSize: 52 }}>🎾</span>
          <p style={s.emptyTitle}>Nenhum lance gravado ainda</p>
          <p style={s.emptyHint}>
            Pressione o botão vermelho ou o controle{'\n'}remoto BT durante a gravação.
          </p>
          <button onClick={onBack} style={s.actionBtn}>← Voltar para Câmera</button>
        </div>
      )}

      {!loading && !error && clips.length > 0 && (
        <div style={s.list}>
          {clips.map((c) => {
            const date = new Date(c.timestamp).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit',
            });
            const vSec = Math.round(c.videoDurationMs / 1000);
            const aSec = c.audioDurationMs != null ? Math.round(c.audioDurationMs / 1000) : null;

            return (
              <div key={c.id} style={s.card}>
                <div style={s.cardRow}>
                  <div>
                    {c.label && <span style={s.lanceName}>{c.label}</span>}
                    <span style={s.date}>{date}</span>
                  </div>
                  {c.syncStatus && (
                    <span style={{ ...s.badge, background: STATUS_COLOR[c.syncStatus] ?? '#555' }}>
                      {STATUS_LABEL[c.syncStatus] ?? c.syncStatus}
                    </span>
                  )}
                </div>

                <div style={s.pills}>
                  <span style={s.pill}>🎬 {vSec}s de vídeo</span>
                  {aSec !== null
                    ? <span style={s.pill}>🎙 {aSec}s de áudio</span>
                    : <span style={{ ...s.pill, opacity: 0.45 }}>sem comentário</span>
                  }
                </div>

                {c.driveVideoUrl && (
                  <a href={c.driveVideoUrl} target="_blank" rel="noreferrer" style={s.link}>
                    Ver no Drive →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Spinner via style tag (React inline styles não suportam @keyframes)
if (!document.getElementById('tenis-spinner-style')) {
  const el = document.createElement('style');
  el.id = 'tenis-spinner-style';
  el.textContent = `@keyframes tenis-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(el);
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh', background: '#0d0d1a', color: '#fff',
    fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: 'max(48px, env(safe-area-inset-top, 48px)) 20px 16px',
    borderBottom: '1px solid #222',
  },
  backBtn: {
    background: 'none', border: '1px solid #444', color: '#aaa',
    padding: '10px 18px', borderRadius: 20, cursor: 'pointer',
    fontSize: 13, minHeight: 44,
  },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },

  center: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: '40px 24px', textAlign: 'center',
  },
  msg:        { color: '#888', fontSize: 14, margin: 0 },
  errorMsg:   { color: '#ff6666', fontSize: 14, margin: 0 },
  emptyTitle: { color: '#ddd', fontSize: 18, fontWeight: 600, margin: 0 },
  emptyHint:  { color: '#777', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 },
  actionBtn: {
    background: '#ffffff11', border: '1px solid #444', color: '#ccc',
    padding: '12px 24px', borderRadius: 20, cursor: 'pointer',
    fontSize: 14, minHeight: 44, marginTop: 8,
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #333', borderTopColor: '#4fc3f7',
    animation: 'tenis-spin 0.8s linear infinite',
  },

  list: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#1a1a2e', borderRadius: 16, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  cardRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  lanceName: { display: 'block', color: '#fff', fontSize: 15, fontWeight: 700 },
  date:      { display: 'block', color: '#888', fontSize: 12, marginTop: 2 },
  badge: {
    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: '#fff',
  },
  pills: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pill: {
    background: '#ffffff11', padding: '6px 12px',
    borderRadius: 20, fontSize: 12, color: '#ddd',
  },
  link: { color: '#4fc3f7', fontSize: 12 },
};
