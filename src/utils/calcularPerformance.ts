// =============================================================================
// calcularPerformance — Compara ângulos do aluno com o gabarito e retorna scores
// =============================================================================

import type { JointAngles } from '@services/poseService';
import type { ConfigNivel } from '@services/apiService';

export interface JointResult {
  label:  string;
  ideal:  number;
  esqVal: number | null;
  esqPct: number | null;
  dirVal: number | null;
  dirPct: number | null;
}

export interface PerformanceResult {
  golpeLabel:     string;
  atletaLabel:    string;
  nivelLabel:     string;
  imageUrl:       string;
  imageCredit:    string;
  joints:         JointResult[];
  scorePonderado: number; // 0-100, média ponderada pelo peso de cada articulação
}

// Percentual de acerto: 100% = no ideal, 0% = desvio >= tolerancia
function calcPct(val: number | null, ideal: number, tolerancia: number): number | null {
  if (val === null) return null;
  const diff = Math.abs(val - ideal);
  return Math.max(0, Math.round(100 - (diff / tolerancia) * 100));
}

export function calcularPerformance(
  config: ConfigNivel,
  golpeLabel: string,
  atletaLabel: string,
  nivelLabel: string,
  angles: JointAngles,
): PerformanceResult {
  const metaList = [
    { meta: config.metas.elbow, esqVal: angles.elbowLeft,  dirVal: angles.elbowRight },
    { meta: config.metas.knee,  esqVal: angles.kneeLeft,   dirVal: angles.kneeRight  },
    { meta: config.metas.hip,   esqVal: angles.hipLeft,    dirVal: angles.hipRight   },
  ];

  let weightedSum = 0;
  let totalWeight = 0;

  const joints: JointResult[] = metaList.map(({ meta, esqVal, dirVal }) => {
    const esqPct = calcPct(esqVal, meta.ideal, meta.tolerancia);
    const dirPct = calcPct(dirVal, meta.ideal, meta.tolerancia);

    const valids = [esqPct, dirPct].filter((p): p is number => p !== null);
    if (valids.length > 0) {
      const avg = valids.reduce((a, b) => a + b, 0) / valids.length;
      weightedSum += avg * meta.peso;
      totalWeight += meta.peso;
    }

    return { label: meta.label, ideal: meta.ideal, esqVal, esqPct, dirVal, dirPct };
  });

  const scorePonderado = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return {
    golpeLabel,
    atletaLabel,
    nivelLabel,
    imageUrl:    config.imageUrl,
    imageCredit: config.imageCredit,
    joints,
    scorePonderado,
  };
}
