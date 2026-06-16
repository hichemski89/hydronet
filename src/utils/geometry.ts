import { Network, NetworkLink } from '../types/network';

/** Longueur géométrique d'un lien dans les unités du modèle (somme des segments via les sommets). */
export function linkModelLength(network: Network, link: NetworkLink): number {
  const a = network.nodes[link.node1];
  const b = network.nodes[link.node2];
  if (!a || !b) return 0;
  const pts = [a, ...(link.vertices ?? []), b];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

/** Longueur réelle (m) d'une conduite = longueur modèle × mètres par unité. */
export function linkRealLength(network: Network, link: NetworkLink, metersPerUnit: number): number {
  return linkModelLength(network, link) * metersPerUnit;
}
