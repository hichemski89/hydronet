import DxfParser from 'dxf-parser';

export interface BackdropBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Backdrop {
  /** Données SVG (chemin) de tous les segments lignes/polylignes/arcs, en coordonnées du dessin. */
  pathData: string;
  /** Cercles à dessiner. */
  circles: { cx: number; cy: number; r: number }[];
  bounds: BackdropBounds;
  /** Échelle : nombre de mètres par unité de dessin (1 = dessin en mètres). */
  metersPerUnit: number;
  visible: boolean;
  opacity: number;
  name: string;
  entityCount: number;
}

const ARC_SEGMENTS = 40;

/** Analyse un fichier DXF et le convertit en fond de plan dessinable. */
export function parseDxf(text: string, name: string): Backdrop {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text);
  if (!dxf || !dxf.entities) throw new Error('Fichier DXF illisible ou vide.');

  const segs: string[] = [];
  const circles: { cx: number; cy: number; r: number }[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  const track = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const fmt = (v: number) => Number(v.toFixed(3));

  const polyline = (pts: { x: number; y: number }[], closed: boolean) => {
    if (pts.length < 2) return;
    let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    track(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      d += `L${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
      track(pts[i].x, pts[i].y);
    }
    if (closed) d += 'Z';
    segs.push(d);
    count++;
  };

  for (const e of dxf.entities as DxfEntity[]) {
    switch (e.type) {
      case 'LINE':
        if (e.vertices && e.vertices.length >= 2) {
          polyline([e.vertices[0], e.vertices[1]], false);
        }
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (e.vertices && e.vertices.length >= 2) {
          polyline(e.vertices, !!e.shape);
        }
        break;
      case 'CIRCLE':
        if (e.center && typeof e.radius === 'number') {
          circles.push({ cx: e.center.x, cy: e.center.y, r: e.radius });
          track(e.center.x - e.radius, e.center.y - e.radius);
          track(e.center.x + e.radius, e.center.y + e.radius);
          count++;
        }
        break;
      case 'ARC':
        if (e.center && typeof e.radius === 'number') {
          const start = e.startAngle ?? 0;
          let end = e.endAngle ?? Math.PI * 2;
          if (end < start) end += Math.PI * 2;
          const pts: { x: number; y: number }[] = [];
          for (let i = 0; i <= ARC_SEGMENTS; i++) {
            const a = start + ((end - start) * i) / ARC_SEGMENTS;
            pts.push({ x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) });
          }
          polyline(pts, false);
        }
        break;
      default:
        break;
    }
  }

  if (!isFinite(minX)) {
    throw new Error('Aucune géométrie exploitable (lignes, polylignes, cercles, arcs) dans le DXF.');
  }

  return {
    pathData: segs.join(' '),
    circles,
    bounds: { minX, minY, maxX, maxY },
    metersPerUnit: 1,
    visible: true,
    opacity: 0.5,
    name,
    entityCount: count,
  };
}

// Type minimal des entités renvoyées par dxf-parser (sous-ensemble utilisé).
interface DxfEntity {
  type: string;
  vertices?: { x: number; y: number }[];
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  shape?: boolean;
}
