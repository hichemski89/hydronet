import { ResultMetric } from '../store/networkStore';

// Échelle de couleurs type "carte thermique" : bleu -> cyan -> vert -> jaune -> rouge.
const STOPS: [number, number, number][] = [
  [44, 123, 182], // bleu
  [44, 177, 196],
  [120, 198, 121],
  [255, 204, 51], // jaune
  [240, 90, 40], // orange-rouge
  [202, 0, 32], // rouge
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Couleur (hex) pour une valeur normalisée t ∈ [0,1]. */
export function colorFor(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const c0 = STOPS[i];
  const c1 = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const r = Math.round(lerp(c0[0], c1[0], f));
  const g = Math.round(lerp(c0[1], c1[1], f));
  const b = Math.round(lerp(c0[2], c1[2], f));
  return `rgb(${r}, ${g}, ${b})`;
}

export interface Domain {
  min: number;
  max: number;
}

/** Normalise une valeur dans le domaine, en gérant les domaines plats. */
export function normalize(value: number, domain: Domain): number {
  if (domain.max - domain.min < 1e-9) return 0.5;
  return (value - domain.min) / (domain.max - domain.min);
}

export const METRIC_LABELS: Record<ResultMetric, string> = {
  pressure: 'Pression',
  head: 'Charge',
  demand: 'Demande',
  flow: 'Débit',
  velocity: 'Vitesse',
  headloss: 'Perte de charge',
};

export function metricUnit(metric: ResultMetric, lengthUnit: string, pressureUnit: string, flowUnit: string): string {
  switch (metric) {
    case 'pressure':
      return pressureUnit;
    case 'head':
      return lengthUnit;
    case 'demand':
    case 'flow':
      return flowUnit;
    case 'velocity':
      return `${lengthUnit}/s`;
    case 'headloss':
      return `${lengthUnit}/km`;
  }
}

export const NODE_METRICS: ResultMetric[] = ['pressure', 'head', 'demand'];
export const LINK_METRICS: ResultMetric[] = ['flow', 'velocity', 'headloss'];
