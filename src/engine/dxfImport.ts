import DxfParser from 'dxf-parser';

export interface BackdropBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BackdropText {
  x: number;
  y: number;
  text: string;
  height: number;
  rotation: number; // degrés
}

export interface BackdropLayer {
  name: string;
  pathData: string;
  circles: { cx: number; cy: number; r: number }[];
  texts: BackdropText[];
  visible: boolean;
}

export interface Backdrop {
  layers: BackdropLayer[];
  /** Emprise totale (toutes entités). */
  bounds: BackdropBounds;
  /** Emprise « utile » (aberrants éloignés filtrés) — pour le zoom étendu. */
  contentBounds: BackdropBounds;
  /** Échelle : nombre de mètres par unité de dessin (1 = dessin en mètres). */
  metersPerUnit: number;
  visible: boolean;
  opacity: number;
  name: string;
  entityCount: number;
}

const ARC_SEGMENTS = 36;
const MAX_BLOCK_DEPTH = 10;

interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function mul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}
const ax = (m: Mat, x: number, y: number) => m.a * x + m.c * y + m.e;
const ay = (m: Mat, x: number, y: number) => m.b * x + m.d * y + m.f;
const sclX = (m: Mat) => Math.hypot(m.a, m.b);
const sclY = (m: Mat) => Math.hypot(m.c, m.d);

interface LayerBuf {
  segs: string[];
  circles: { cx: number; cy: number; r: number }[];
  texts: BackdropText[];
}

/** Analyse un fichier DXF (blocs, calques, textes) et le convertit en fond de plan. */
export function parseDxf(text: string, name: string): Backdrop {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text) as DxfDocument | null;
  if (!dxf || !dxf.entities) throw new Error('Fichier DXF illisible ou vide.');

  const layerBufs = new Map<string, LayerBuf>();
  const repX: number[] = [];
  const repY: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  const bufFor = (layer: string): LayerBuf => {
    let b = layerBufs.get(layer);
    if (!b) {
      b = { segs: [], circles: [], texts: [] };
      layerBufs.set(layer, b);
    }
    return b;
  };
  const track = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const fmt = (v: number) => Number(v.toFixed(3));

  const polyline = (pts: { x: number; y: number }[], m: Mat, closed: boolean, layer: string) => {
    if (pts.length < 2) return;
    let d = '';
    let cxSum = 0;
    let cySum = 0;
    for (let i = 0; i < pts.length; i++) {
      const x = ax(m, pts[i].x, pts[i].y);
      const y = ay(m, pts[i].x, pts[i].y);
      d += `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
      track(x, y);
      cxSum += x;
      cySum += y;
    }
    if (closed) d += 'Z';
    bufFor(layer).segs.push(d);
    repX.push(cxSum / pts.length);
    repY.push(cySum / pts.length);
    count++;
  };

  const blocks = dxf.blocks ?? {};
  const effLayer = (e: DxfEntity, parent: string): string => {
    const l = e.layer;
    return l && l !== '0' ? l : parent;
  };

  const process = (entities: DxfEntity[], m: Mat, parentLayer: string, depth: number) => {
    for (const e of entities) {
      const layer = effLayer(e, parentLayer);
      switch (e.type) {
        case 'LINE':
          if (e.vertices && e.vertices.length >= 2) polyline([e.vertices[0], e.vertices[1]], m, false, layer);
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (e.vertices && e.vertices.length >= 2) polyline(e.vertices, m, !!e.shape, layer);
          break;
        case 'CIRCLE':
          if (e.center && typeof e.radius === 'number') {
            const cx = ax(m, e.center.x, e.center.y);
            const cy = ay(m, e.center.x, e.center.y);
            const r = e.radius * ((sclX(m) + sclY(m)) / 2);
            bufFor(layer).circles.push({ cx, cy, r });
            track(cx - r, cy - r);
            track(cx + r, cy + r);
            repX.push(cx);
            repY.push(cy);
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
            polyline(pts, m, false, layer);
          }
          break;
        case 'ELLIPSE':
          if (e.center && e.majorAxisEndPoint) {
            const ratio = e.axisRatio ?? 1;
            const major = Math.hypot(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y);
            const minor = major * ratio;
            const rot = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x);
            const s = e.startAngle ?? 0;
            let en = e.endAngle ?? Math.PI * 2;
            if (en <= s) en += Math.PI * 2;
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i <= ARC_SEGMENTS; i++) {
              const t = s + ((en - s) * i) / ARC_SEGMENTS;
              const lx = major * Math.cos(t);
              const ly = minor * Math.sin(t);
              pts.push({
                x: e.center.x + lx * Math.cos(rot) - ly * Math.sin(rot),
                y: e.center.y + lx * Math.sin(rot) + ly * Math.cos(rot),
              });
            }
            polyline(pts, m, false, layer);
          }
          break;
        case 'TEXT':
        case 'MTEXT': {
          const sp = e.startPoint ?? e.position;
          const content = cleanText(e.text ?? '');
          if (sp && content) {
            const x = ax(m, sp.x, sp.y);
            const y = ay(m, sp.x, sp.y);
            const h = (e.textHeight ?? e.height ?? 2.5) * ((sclX(m) + sclY(m)) / 2);
            const rot = (e.rotation ?? 0) + (Math.atan2(m.b, m.a) * 180) / Math.PI;
            bufFor(layer).texts.push({ x, y, text: content, height: h, rotation: rot });
            track(x, y);
            repX.push(x);
            repY.push(y);
            count++;
          }
          break;
        }
        case 'INSERT':
          if (e.name && depth < MAX_BLOCK_DEPTH) {
            const block = blocks[e.name];
            if (block && block.entities) {
              const p = e.position ?? { x: 0, y: 0 };
              const sx = e.xScale ?? 1;
              const sy = e.yScale ?? 1;
              const rot = ((e.rotation ?? 0) * Math.PI) / 180;
              const base = block.position ?? { x: 0, y: 0 };
              let im = mul(m, { a: 1, b: 0, c: 0, d: 1, e: p.x, f: p.y });
              im = mul(im, { a: Math.cos(rot), b: Math.sin(rot), c: -Math.sin(rot), d: Math.cos(rot), e: 0, f: 0 });
              im = mul(im, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
              im = mul(im, { a: 1, b: 0, c: 0, d: 1, e: -base.x, f: -base.y });
              process(block.entities, im, layer, depth + 1);
            }
          }
          break;
        default:
          break;
      }
    }
  };

  process(dxf.entities, IDENTITY, '0', 0);

  if (!isFinite(minX)) throw new Error('Aucune géométrie exploitable trouvée dans le DXF.');

  const layers: BackdropLayer[] = [...layerBufs.entries()]
    .map(([name, b]) => ({
      name,
      pathData: b.segs.join(' '),
      circles: b.circles,
      texts: b.texts,
      visible: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    layers,
    bounds: { minX, minY, maxX, maxY },
    contentBounds: robustBounds(repX, repY, { minX, minY, maxX, maxY }),
    metersPerUnit: 1,
    visible: true,
    opacity: 0.6,
    name,
    entityCount: count,
  };
}

/** Emprise robuste : ignore les entités très éloignées (percentiles 2 %–98 %). */
function robustBounds(xs: number[], ys: number[], full: BackdropBounds): BackdropBounds {
  if (xs.length < 12) return full;
  const sx = [...xs].sort((a, b) => a - b);
  const sy = [...ys].sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.floor((arr.length - 1) * p)];
  const minX = q(sx, 0.02);
  const maxX = q(sx, 0.98);
  const minY = q(sy, 0.02);
  const maxY = q(sy, 0.98);
  const padX = (maxX - minX) * 0.05 || 1;
  const padY = (maxY - minY) * 0.05 || 1;
  return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

function cleanText(s: string): string {
  return s
    .replace(/\\P/g, ' ')
    .replace(/\\[A-Za-z][^;\\]*;?/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

interface DxfPoint {
  x: number;
  y: number;
}
interface DxfEntity {
  type: string;
  layer?: string;
  vertices?: DxfPoint[];
  center?: DxfPoint;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  shape?: boolean;
  majorAxisEndPoint?: DxfPoint;
  axisRatio?: number;
  startPoint?: DxfPoint;
  position?: DxfPoint;
  text?: string;
  textHeight?: number;
  height?: number;
  rotation?: number;
  name?: string;
  xScale?: number;
  yScale?: number;
}
interface DxfBlock {
  name?: string;
  position?: DxfPoint;
  entities?: DxfEntity[];
}
interface DxfDocument {
  entities: DxfEntity[];
  blocks?: Record<string, DxfBlock>;
}
