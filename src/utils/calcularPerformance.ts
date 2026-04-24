// =============================================================================
// calcularPerformance — Compara ângulos do aluno com o gabarito e retorna scores
// Ideais de cotovelo são diferenciados por lado (racket vs não-racket)
// para todos os golpes. Destro: Dir = braço da raquete. Canhoto: Esq = raquete.
// =============================================================================

import type { JointAngles } from '@services/poseService';
import type { GabaritoEntry, NivelAluno, NIVEL_LABELS } from '@services/apiService';

export type Mao = 'destro' | 'canhoto';

export interface JointResult {
  label:     string;
  ideal:     number;   // ideal do lado ESQ (mostrado na coluna esquerda)
  idealDir:  number;   // ideal do lado DIR (mostrado na coluna direita)
  esqVal:    number | null;
  esqPct:    number | null;
  dirVal:    number | null;
  dirPct:    number | null;
}

export interface PerformanceResult {
  golpeLabel:     string;
  nivelLabel:     string;
  imageUrl:       string;
  imageCredit:    string;
  joints:         JointResult[];
  scorePonderado: number;
}

// ---------------------------------------------------------------------------
// Ideais de cotovelo por lado e por golpe+fase
// Destro → Dir = braço da raquete, Esq = braço livre/arremesso
// Canhoto → espelhado
//
// Baseado em estudos biomecânicos de tênis (ITF, USTA, Knudson & Morrison):
// ---------------------------------------------------------------------------

interface ElbowSideIdeals { esq: number; dir: number }

const ELBOW_IDEALS: Record<string, { destro: ElbowSideIdeals; canhoto: ElbowSideIdeals }> = {
  // SAQUE — Preparação (Troféu):
  //   raquete: cotovelo ~90° (posição de troféu, clássico)
  //   arremesso: ~165° (braço estendido lançando a bola)
  saque_preparacao: {
    destro:  { esq: 165, dir: 90  },
    canhoto: { esq: 90,  dir: 165 },
  },

  // SAQUE — Contato (Impacto):
  //   raquete: ~155° (extensão quase completa no pico)
  //   arremesso: ~100° (braço desceu/dobrado durante rotação do tronco)
  saque_contato: {
    destro:  { esq: 100, dir: 155 },
    canhoto: { esq: 155, dir: 100 },
  },

  // FOREHAND — Preparação (Backswing):
  //   raquete: ~120° (cotovelo dobrado no backswing)
  //   guia: ~155° (braço esticado à frente guiando a rotação)
  forehand_preparacao: {
    destro:  { esq: 155, dir: 120 },
    canhoto: { esq: 120, dir: 155 },
  },

  // FOREHAND — Contato:
  //   raquete: ~148° (semi-extensão no ponto de contato)
  //   guia: ~110° (braço não-dominante aberto para trás na rotação)
  forehand_contato: {
    destro:  { esq: 110, dir: 148 },
    canhoto: { esq: 148, dir: 110 },
  },

  // BACKHAND — Preparação (one-handed reference):
  //   raquete (braço cruzado): ~100° (cotovelo dobrado no backswing)
  //   braço livre: ~130° (à frente ajudando a girar)
  backhand_preparacao: {
    destro:  { esq: 100, dir: 130 },
    canhoto: { esq: 130, dir: 100 },
  },

  // BACKHAND — Contato:
  //   raquete: ~150° (extensão no contato)
  //   braço livre: ~95° (puxado para trás como contrapeso)
  backhand_contato: {
    destro:  { esq: 95,  dir: 150 },
    canhoto: { esq: 150, dir: 95  },
  },

  // SLICE — Preparação:
  //   raquete: ~100° (backswing elevado, raquete acima do ombro)
  //   braço livre: ~130° (guiando/equilíbrio)
  slice_preparacao: {
    destro:  { esq: 100, dir: 130 },
    canhoto: { esq: 130, dir: 100 },
  },

  // SLICE — Contato:
  //   raquete: ~135° (descida do slice, cotovelo semi-flexionado)
  //   braço livre: ~110°
  slice_contato: {
    destro:  { esq: 110, dir: 135 },
    canhoto: { esq: 135, dir: 110 },
  },

  // VOLLEY — Preparação:
  //   ambos compactos próximos ao corpo (~90°)
  volley_preparacao: {
    destro:  { esq: 90, dir: 90 },
    canhoto: { esq: 90, dir: 90 },
  },

  // VOLLEY — Contato:
  //   raquete: ~145° (extensão no bloco)
  //   braço livre: ~95° (compacto, suporte)
  volley_contato: {
    destro:  { esq: 95,  dir: 145 },
    canhoto: { esq: 145, dir: 95  },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcPct(val: number | null, ideal: number, tolerancia: number): number | null {
  if (val === null) return null;
  const diff = Math.abs(val - ideal);
  return Math.max(0, Math.round(100 - (diff / tolerancia) * 100));
}

// ---------------------------------------------------------------------------
// calcularPerformance
// ---------------------------------------------------------------------------

export function calcularPerformance(
  entry: GabaritoEntry,
  nivel: NivelAluno,
  golpeLabel: string,
  nivelLabel: string,
  angles: JointAngles,
  mao: Mao = 'destro',
  golpeFaseId = '',
): PerformanceResult {
  const config   = entry.niveis[nivel];
  const sideMap  = ELBOW_IDEALS[golpeFaseId];
  const tol      = config.metas.elbow.tolerancia;
  const peso     = config.metas.elbow.peso;

  let weightedSum = 0;
  let totalWeight = 0;
  const joints: JointResult[] = [];

  // --- Cotovelo ---
  let idealEsq: number;
  let idealDir: number;

  if (sideMap) {
    idealEsq = sideMap[mao].esq;
    idealDir  = sideMap[mao].dir;
  } else {
    idealEsq = config.metas.elbow.ideal;
    idealDir  = config.metas.elbow.ideal;
  }

  const esqPctElbow = calcPct(angles.elbowLeft,  idealEsq, tol);
  const dirPctElbow = calcPct(angles.elbowRight, idealDir,  tol);
  const validsElbow = [esqPctElbow, dirPctElbow].filter((p): p is number => p !== null);
  if (validsElbow.length > 0) {
    const avg = validsElbow.reduce((a, b) => a + b, 0) / validsElbow.length;
    weightedSum += avg * peso;
    totalWeight += peso;
  }
  joints.push({ label: 'Cotovelo', ideal: idealEsq, idealDir, esqVal: angles.elbowLeft, esqPct: esqPctElbow, dirVal: angles.elbowRight, dirPct: dirPctElbow });

  // --- Joelho e Quadril (mesmo ideal ambos os lados) ---
  for (const { meta, esqVal, dirVal } of [
    { meta: config.metas.knee, esqVal: angles.kneeLeft,  dirVal: angles.kneeRight },
    { meta: config.metas.hip,  esqVal: angles.hipLeft,   dirVal: angles.hipRight  },
  ]) {
    const esqPct = calcPct(esqVal, meta.ideal, meta.tolerancia);
    const dirPct = calcPct(dirVal, meta.ideal, meta.tolerancia);
    const valids = [esqPct, dirPct].filter((p): p is number => p !== null);
    if (valids.length > 0) {
      const avg = valids.reduce((a, b) => a + b, 0) / valids.length;
      weightedSum += avg * meta.peso;
      totalWeight += meta.peso;
    }
    joints.push({ label: meta.label, ideal: meta.ideal, idealDir: meta.ideal, esqVal, esqPct, dirVal, dirPct });
  }

  const scorePonderado = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { golpeLabel, nivelLabel, imageUrl: entry.imageUrl, imageCredit: entry.imageCredit, joints, scorePonderado };
}
