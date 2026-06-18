import { Pipe } from '../types/network';

export interface Pt {
  x: number;
  y: number;
}

/** Coefficients de perte de charge singulière des coudes. */
export const FITTING_K: Record<'E90' | 'E45', number> = {
  E90: 0.9,
  E45: 0.4,
};

export const FITTING_LABEL: Record<'E90' | 'E45', string> = {
  E90: 'Coude 90°',
  E45: 'Coude 45°',
};

/** Somme des pertes singulières des coudes d'une conduite. */
export function fittingsMinorLoss(pipe: Pipe): number {
  if (!pipe.fittings) return 0;
  let k = 0;
  for (const kind of Object.values(pipe.fittings)) k += FITTING_K[kind] ?? 0;
  return k;
}

/**
 * Construit un chemin SVG arrondi (arcs de rayon r) aux sommets intermédiaires.
 * Les sommets « vifs » (coudes ou violations) restent anguleux.
 * `r` est en unités d'écran ; `isSharp(i)` indique si le sommet intermédiaire i reste vif.
 */
export function roundedPath(pts: Pt[], r: number, isSharp: (interiorIndex: number) => boolean): string {
  if (pts.length < 2) return '';
  let d = `M${fmt(pts[0].x)},${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const A = pts[i - 1];
    const P = pts[i];
    const B = pts[i + 1];
    if (r <= 0 || isSharp(i - 1)) {
      d += `L${fmt(P.x)},${fmt(P.y)}`;
      continue;
    }
    const v1x = P.x - A.x;
    const v1y = P.y - A.y;
    const v2x = B.x - P.x;
    const v2y = B.y - P.y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 < 1e-3 || l2 < 1e-3) {
      d += `L${fmt(P.x)},${fmt(P.y)}`;
      continue;
    }
    const u1x = v1x / l1;
    const u1y = v1y / l1;
    const u2x = v2x / l2;
    const u2y = v2y / l2;
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
    const delta = Math.acos(dot); // angle de déviation (0 = droit)
    if (delta < 0.02) {
      d += `L${fmt(P.x)},${fmt(P.y)}`;
      continue;
    }
    let tan = r * Math.tan(delta / 2);
    tan = Math.min(tan, l1 * 0.5, l2 * 0.5);
    const effR = tan / Math.tan(delta / 2);
    const t1x = P.x - u1x * tan;
    const t1y = P.y - u1y * tan;
    const t2x = P.x + u2x * tan;
    const t2y = P.y + u2y * tan;
    const cross = u1x * u2y - u1y * u2x;
    const sweep = cross < 0 ? 0 : 1;
    d += `L${fmt(t1x)},${fmt(t1y)}A${fmt(effR)},${fmt(effR)} 0 0 ${sweep} ${fmt(t2x)},${fmt(t2y)}`;
  }
  const last = pts[pts.length - 1];
  d += `L${fmt(last.x)},${fmt(last.y)}`;
  return d;
}

/**
 * Pour chaque sommet intermédiaire, indique si le rayon de courbure mini ne peut
 * pas être respecté (segments trop courts) — il faudrait alors insérer un coude.
 * `pts` et `minR` sont dans la même unité (modèle).
 */
export function bendViolations(pts: Pt[], minR: number, isElbow: (interiorIndex: number) => boolean): number[] {
  const bad: number[] = [];
  if (minR <= 0) return bad;
  for (let i = 1; i < pts.length - 1; i++) {
    if (isElbow(i - 1)) continue; // un coude assume l'angle, pas de contrainte de rayon
    const A = pts[i - 1];
    const P = pts[i];
    const B = pts[i + 1];
    const l1 = Math.hypot(P.x - A.x, P.y - A.y);
    const l2 = Math.hypot(B.x - P.x, B.y - P.y);
    const u1x = (P.x - A.x) / (l1 || 1);
    const u1y = (P.y - A.y) / (l1 || 1);
    const u2x = (B.x - P.x) / (l2 || 1);
    const u2y = (B.y - P.y) / (l2 || 1);
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
    const delta = Math.acos(dot);
    if (delta < 0.02) continue;
    const reqTan = minR * Math.tan(delta / 2);
    if (l1 < reqTan || l2 < reqTan) bad.push(i - 1);
  }
  return bad;
}

function fmt(v: number): number {
  return Math.round(v * 100) / 100;
}
