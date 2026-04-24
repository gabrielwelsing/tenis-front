// =============================================================================
// calcularPerformance — Compara ângulos do aluno com o gabarito e retorna scores
// =============================================================================

import type { JointAngles } from '@services/poseService';
import type { GabaritoEntry, NivelAluno, NIVEL_LABELS } from '@services/apiService';

export type Mao = 'destro' | 'canhoto';

export interface JointResult {
  label:      string;
  ideal:      number;
  idealDir?:  number; // ideal específico do lado dir (quando difere do esq)
  esqVal:     number | null;
  esqPct:     number | null;
  dirVal:     number | null;
  dirPct:     number | null;
}

export interface PerformanceResult {
  golpeLabel:     string;
  nivelLabel:     string;
  imageUrl:       string;
  imageCredit:    string;
  joints:         JointResult[];
  scorePonderado: number;
}

function calcPct(val: number | null, ideal: number, tolerancia: number): number | null {
  if (val === null) return null;
  const diff = Math.abs(val - ideal);
  return Math.max(0, Math.round(100 - (diff / tolerancia) * 100));
}

// Para o saque — preparação, o braço da raquete e o de arremesso têm ângulos opostos.
// Destro: Dir = raquete (90°), Esq = arremesso (165°)
// Canhoto: Esq = raquete (90°), Dir = arremesso (165°)
function saquePreparacaoElbow(
  mao: Mao,
  elbowLeft: number | null,
  elbowRight: number | null,
  toleranciaBase: number,
  peso: number,
): { result: JointResult; weightedContrib: number; weightUsed: number } {
  const idealRaquete  = 90;
  const tolRaquete    = 25;
  const idealArremesso = 165;
  const tolArremesso  = 20;

  const [idealEsq, tolEsq, idealDir, tolDir] = mao === 'destro'
    ? [idealArremesso, tolArremesso, idealRaquete,  tolRaquete ]
    : [idealRaquete,  tolRaquete,  idealArremesso, tolArremesso];

  const esqPct = calcPct(elbowLeft,  idealEsq, tolEsq);
  const dirPct = calcPct(elbowRight, idealDir, tolDir);

  const valids = [esqPct, dirPct].filter((p): p is number => p !== null);
  let weightedContrib = 0;
  let weightUsed = 0;
  if (valids.length > 0) {
    const avg = valids.reduce((a, b) => a + b, 0) / valids.length;
    weightedContrib = avg * peso;
    weightUsed = peso;
  }

  return {
    result: { label: 'Cotovelo', ideal: idealEsq, idealDir, esqVal: elbowLeft, esqPct, dirVal: elbowRight, dirPct },
    weightedContrib,
    weightUsed,
  };
}

export function calcularPerformance(
  entry: GabaritoEntry,
  nivel: NivelAluno,
  golpeLabel: string,
  nivelLabel: string,
  angles: JointAngles,
  mao: Mao = 'destro',
): PerformanceResult {
  const config = entry.niveis[nivel];
  const isSaquePrep = entry.grupo === 'Saque' && entry.fase === 'Preparação';

  let weightedSum = 0;
  let totalWeight = 0;
  const joints: JointResult[] = [];

  if (isSaquePrep) {
    const { result, weightedContrib, weightUsed } = saquePreparacaoElbow(
      mao, angles.elbowLeft, angles.elbowRight, config.metas.elbow.tolerancia, config.metas.elbow.peso,
    );
    joints.push(result);
    weightedSum += weightedContrib;
    totalWeight += weightUsed;
  } else {
    const meta = config.metas.elbow;
    const esqPct = calcPct(angles.elbowLeft,  meta.ideal, meta.tolerancia);
    const dirPct = calcPct(angles.elbowRight, meta.ideal, meta.tolerancia);
    const valids = [esqPct, dirPct].filter((p): p is number => p !== null);
    if (valids.length > 0) {
      const avg = valids.reduce((a, b) => a + b, 0) / valids.length;
      weightedSum += avg * meta.peso;
      totalWeight += meta.peso;
    }
    joints.push({ label: meta.label, ideal: meta.ideal, esqVal: angles.elbowLeft, esqPct, dirVal: angles.elbowRight, dirPct });
  }

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
    joints.push({ label: meta.label, ideal: meta.ideal, esqVal, esqPct, dirVal, dirPct });
  }

  const scorePonderado = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { golpeLabel, nivelLabel, imageUrl: entry.imageUrl, imageCredit: entry.imageCredit, joints, scorePonderado };
}
