// =============================================================================
// HISTORY SCREEN — Lista de lances gravados (Frontend only)
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { SaveMode } from '../App';
import { getClips, type ClipRecord } from '@services/apiService';

const STATUS_LABEL: Record<string, string> = {
  synced: 'No Drive', pending: 'Na fila', uploading: 'Enviando', error: 'Erro',
};
const STATUS_COLOR: Record<string, string> = {
  synced: '#2e7d32', pending: '#555', uploading: '#f9a825', error: '#c62828',
};

export default function HistoryScreen({ onBack, saveMode }: { onBack: () => void; saveMode: SaveMode }) {
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (saveMode === 'local') { setLoading(false); return; }
    getClips().then(setClips).finally(() => setLoading(false));
  }, [saveMode]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Câmera</button>
        <h1 style={styles.title}>Lances Gravados</h1>
      </div>

      {loading && <p style={styles.msg}>Carregando...</p>}

      {!loading && clips.length === 0 && (
        <div style={styles.empty}>
          <p>Nenhum lance gravado ainda.</p>
          <p style={{ color: '#555', fontSize: 13 }}>
            Pressione o botão vermelho ou o controle remoto BT na câmera.
          </p>
        </div>
      )}

      <div style={styles.list}>
        {clips.map((c) => {
          const date = new Date(c.timestamp).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
          });
          const vSec = Math.round((c.videoDurationMs ?? 0) / 1000);
          const aSec = c.audioDurationMs ? Math.round(c.audioDurationMs / 1000) : null;

          return (
            <div key={c.id} style={styles.card}>
              <div style={styles.cardRow}>
                <span style={styles.date}>{date}</span>
                <span style={{ ...styles.badge, background: STATUS_COLOR[c.syncStatus] ?? '#555' }}>
                  {STATUS_LABEL[c.syncStatus] ?? c.syncStatus}
                </span>
              </div>
              <div style={styles.pills}>
                <span style={styles.pill}>🎬 {vSec}s de vídeo</span>
                {aSec !== null
                  ? <span style={styles.pill}>🎙 {aSec}s de áudio</span>
                  : <span style={{ ...styles.pill, opacity: 0.4 }}>sem comentário</span>
                }
              </div>
              {c.driveVideoUrl && (
                <a href={c.driveVideoUrl} target="_blank" rel="noreferrer" style={styles.link}>
                  Ver no Drive →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100dvh', background: '#0d0d1a', color: '#fff', fontFamily: 'sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '48px 20px 16px', borderBottom: '1px solid #222' },
  backBtn: { background: 'none', border: '1px solid #444', color: '#aaa', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  msg: { padding: 32, color: '#888', textAlign: 'center' },
  empty: { padding: 80, textAlign: 'center', color: '#888' },
  list: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#1a1a2e', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#bbb', fontSize: 13 },
  badge: { padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 },
  pills: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pill: { background: '#ffffff11', padding: '5px 10px', borderRadius: 20, fontSize: 12, color: '#ddd' },
  link: { color: '#4fc3f7', fontSize: 11 },
};
