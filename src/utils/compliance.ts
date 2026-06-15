import { Network, ComplianceCriteria, SimulationResults } from '../types/network';

export type Status = 'ok' | 'low' | 'high' | 'na';

export const STATUS_COLOR: Record<Status, string> = {
  ok: '#16a34a', // vert
  low: '#dc2626', // rouge (insuffisant)
  high: '#d97706', // orange (excessif)
  na: '#cbd5e1', // gris (non applicable)
};

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Conforme',
  low: 'Insuffisant',
  high: 'Excessif',
  na: 'N/A',
};

/** Statut de conformité d'une pression de nœud. */
export function pressureStatus(value: number | undefined, c: ComplianceCriteria): Status {
  if (value == null || !isFinite(value)) return 'na';
  if (value < c.minPressure) return 'low';
  if (value > c.maxPressure) return 'high';
  return 'ok';
}

/** Statut de conformité d'une vitesse de conduite (en magnitude). */
export function velocityStatus(value: number | undefined, c: ComplianceCriteria): Status {
  if (value == null || !isFinite(value)) return 'na';
  const v = Math.abs(value);
  if (v > c.maxVelocity) return 'high';
  if (c.minVelocity > 0 && v > 1e-6 && v < c.minVelocity) return 'low';
  return 'ok';
}

export interface Violation {
  id: string;
  type: string;
  kind: 'low' | 'high';
  metric: 'pression' | 'vitesse';
  value: number;
  threshold: number;
  timeIndex: number;
  time: number;
}

export interface ComplianceReport {
  violations: Violation[];
  nodesChecked: number;
  linksChecked: number;
  nodeOk: number;
  linkOk: number;
}

/**
 * Évalue la conformité sur toute la durée de simulation.
 * Pour chaque nœud de demande : la pire pression (min et max) sur la période.
 * Pour chaque conduite : la vitesse extrême sur la période.
 */
export function collectViolations(network: Network, results: SimulationResults): ComplianceReport {
  const c = network.criteria;
  const violations: Violation[] = [];
  let nodesChecked = 0;
  let nodeOk = 0;
  let linksChecked = 0;
  let linkOk = 0;

  for (const node of Object.values(network.nodes)) {
    if (node.type !== 'junction') continue; // pression non pertinente aux sources
    const series = results.nodes[node.id]?.pressure;
    if (!series || !series.length) continue;
    nodesChecked++;

    let minV = Infinity;
    let minI = 0;
    let maxV = -Infinity;
    let maxI = 0;
    series.forEach((v, i) => {
      if (!isFinite(v)) return;
      if (v < minV) {
        minV = v;
        minI = i;
      }
      if (v > maxV) {
        maxV = v;
        maxI = i;
      }
    });

    let conform = true;
    if (minV < c.minPressure) {
      conform = false;
      violations.push({
        id: node.id,
        type: 'Nœud',
        kind: 'low',
        metric: 'pression',
        value: minV,
        threshold: c.minPressure,
        timeIndex: minI,
        time: results.times[minI] ?? 0,
      });
    }
    if (maxV > c.maxPressure) {
      conform = false;
      violations.push({
        id: node.id,
        type: 'Nœud',
        kind: 'high',
        metric: 'pression',
        value: maxV,
        threshold: c.maxPressure,
        timeIndex: maxI,
        time: results.times[maxI] ?? 0,
      });
    }
    if (conform) nodeOk++;
  }

  for (const link of Object.values(network.links)) {
    if (link.type !== 'pipe') continue;
    const series = results.links[link.id]?.velocity;
    if (!series || !series.length) continue;
    linksChecked++;

    let maxV = -Infinity;
    let maxI = 0;
    series.forEach((v, i) => {
      const a = Math.abs(v);
      if (isFinite(a) && a > maxV) {
        maxV = a;
        maxI = i;
      }
    });

    if (maxV > c.maxVelocity) {
      violations.push({
        id: link.id,
        type: 'Conduite',
        kind: 'high',
        metric: 'vitesse',
        value: maxV,
        threshold: c.maxVelocity,
        timeIndex: maxI,
        time: results.times[maxI] ?? 0,
      });
    } else {
      linkOk++;
    }
  }

  // Tri : insuffisances d'abord, puis par écart au seuil décroissant.
  violations.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'low' ? -1 : 1;
    return Math.abs(b.value - b.threshold) - Math.abs(a.value - a.threshold);
  });

  return { violations, nodesChecked, linksChecked, nodeOk, linkOk };
}
