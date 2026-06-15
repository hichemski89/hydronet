import { SimulationResults } from '../types/network';
import { ResultMetric } from '../store/networkStore';
import { Domain } from './colorScale';

const NODE_KEYS: Record<string, keyof SimulationResults['nodes'][string]> = {
  pressure: 'pressure',
  head: 'head',
  demand: 'demand',
};

const LINK_KEYS: Record<string, keyof SimulationResults['links'][string]> = {
  flow: 'flow',
  velocity: 'velocity',
  headloss: 'headloss',
};

export function isNodeMetric(metric: ResultMetric): boolean {
  return metric === 'pressure' || metric === 'head' || metric === 'demand';
}

export function nodeValue(
  results: SimulationResults,
  nodeId: string,
  metric: ResultMetric,
  timeIndex: number,
): number | undefined {
  const key = NODE_KEYS[metric];
  if (!key) return undefined;
  const series = results.nodes[nodeId]?.[key] as number[] | undefined;
  return series?.[timeIndex];
}

export function linkValue(
  results: SimulationResults,
  linkId: string,
  metric: ResultMetric,
  timeIndex: number,
): number | undefined {
  const key = LINK_KEYS[metric];
  if (!key) return undefined;
  const series = results.links[linkId]?.[key] as number[] | undefined;
  const v = series?.[timeIndex];
  // Le débit peut être négatif (sens d'écoulement) ; on garde le signe pour les flèches
  // mais la magnitude pour la couleur est gérée à l'affichage.
  return v;
}

/** Domaine [min,max] d'une métrique nœud sur l'ensemble du réseau au temps donné. */
export function nodeDomain(
  results: SimulationResults,
  metric: ResultMetric,
  timeIndex: number,
): Domain {
  let min = Infinity;
  let max = -Infinity;
  for (const id of Object.keys(results.nodes)) {
    const v = nodeValue(results, id, metric, timeIndex);
    if (v == null || !isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min)) return { min: 0, max: 1 };
  return { min, max };
}

/** Domaine [min,max] d'une métrique lien (en magnitude pour le débit). */
export function linkDomain(
  results: SimulationResults,
  metric: ResultMetric,
  timeIndex: number,
): Domain {
  let min = Infinity;
  let max = -Infinity;
  for (const id of Object.keys(results.links)) {
    let v = linkValue(results, id, metric, timeIndex);
    if (v == null || !isFinite(v)) continue;
    v = Math.abs(v);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min)) return { min: 0, max: 1 };
  return { min, max };
}
