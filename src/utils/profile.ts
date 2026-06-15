import { Network, SimulationResults } from '../types/network';

export interface ProfilePoint {
  id: string;
  /** Distance cumulée depuis le départ (unité de longueur du modèle). */
  distance: number;
  /** Cote terrain / niveau de référence du nœud. */
  ground: number;
  /** Ligne piézométrique (charge hydraulique). */
  head: number | null;
  /** Pression au nœud (charge − cote). */
  pressure: number | null;
}

/** Cote de référence d'un nœud pour le profil (terrain). */
function nodeGround(network: Network, id: string): number {
  const nd = network.nodes[id];
  if (!nd) return 0;
  if (nd.type === 'junction') return nd.elevation;
  if (nd.type === 'tank') return nd.elevation;
  return nd.head; // réservoir : niveau d'eau = cote de référence
}

/** Cherche une conduite reliant directement deux nœuds (pour la longueur réelle). */
function linkBetween(network: Network, a: string, b: string) {
  return Object.values(network.links).find(
    (l) => (l.node1 === a && l.node2 === b) || (l.node1 === b && l.node2 === a),
  );
}

/**
 * Construit le profil en long le long d'un tracé de nœuds, au pas de temps donné.
 * Utilise la longueur de conduite si les nœuds sont directement reliés,
 * sinon la distance euclidienne entre coordonnées.
 */
export function computeProfile(
  network: Network,
  results: SimulationResults | null,
  path: string[],
  timeIndex: number,
): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  let dist = 0;

  for (let i = 0; i < path.length; i++) {
    const id = path[i];
    const node = network.nodes[id];
    if (!node) continue;

    if (i > 0) {
      const prev = network.nodes[path[i - 1]];
      const link = linkBetween(network, path[i - 1], id);
      if (link && link.type === 'pipe') {
        dist += link.length;
      } else if (prev) {
        dist += Math.hypot(node.x - prev.x, node.y - prev.y);
      }
    }

    const head = results?.nodes[id]?.head[timeIndex];
    const pressure = results?.nodes[id]?.pressure[timeIndex];
    points.push({
      id,
      distance: dist,
      ground: nodeGround(network, id),
      head: head != null && isFinite(head) ? head : null,
      pressure: pressure != null && isFinite(pressure) ? pressure : null,
    });
  }

  return points;
}
