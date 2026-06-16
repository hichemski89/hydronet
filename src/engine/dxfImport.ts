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

export interface Backdrop {
  /** Données SVG (chemin) de tous les segments lignes/polylignes/arcs, en coordonnées du dessin. */
  pathData: string;
  /** Cercles à dessiner. */
  circles: { cx: number; cy: number; r: number }[];
  /** Textes à dessiner. */
  texts: BackdropText[];
  bounds: BackdropBounds;
  /** Échelle : nombre de mètres par unité de dessin (1 = dessin en mètres). */
  metersPerUnit: number;
  visible: boolean;
  opacity: number;
  name: string;
  entityCount: number;
}

const ARC_SEGMENTS = 36;
const MAX_BLOCK_DEPTH = 10;

// Matrice affine 2D : point' = (a·x + c·y + e, b·x + d·y + f)
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
function applyX(m: Mat, x: number, y: number): number {
  return m.a * x + m.c * y + m.e;
}
function applyY(m: Mat, x: number, y: number): number {
  return m.b * x + m.d * y + m.f;
}
function scaleX(m: Mat): number {
  return Math.hypot(m.a, m.b);
}
function scaleY(m: Mat): number {
  return Math.hypot(m.c, m.d);
}

/** Analyse un fichier DXF (y compris blocs et textes) et le convertit en fond de plan. */
export function parseDxf(text: string, name: string): Backdrop {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text) as DxfDocument | null;
  if (!dxf || !dxf.entities) throw new Error('Fichier DXF illisible ou vide.');

  const segs: string[] = [];
  const circles: { cx: number; cy: number; r: number }[] = [];
  const texts: BackdropText[] = [];
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

  const polyline = (pts: { x: number; y: number }[], m: Mat, closed: boolean) => {
    if (pts.length < 2) return;
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const x = applyX(m, pts[i].x, pts[i].y);
      const y = applyY(m, pts[i].x, pts[i].y);
      d += `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
      track(x, y);
    }
    if (closed) d += 'Z';
    segs.push(d);
    count++;
  };

  const blocks = dxf.blocks ?? {};

  const process = (entities: DxfEntity[], m: Mat, depth: number) => {
    for (const e of entities) {
      switch (e.type) {
        case 'LINE':
          if (e.vertices && e.vertices.length >= 2) polyline([e.vertices[0], e.vertices[1]], m, false);
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (e.vertices && e.vertices.length >= 2) polyline(e.vertices, m, !!e.shape);
          break;
        case 'CIRCLE':
          if (e.center && typeof e.radius === 'number') {
            const cx = applyX(m, e.center.x, e.center.y);
            const cy = applyY(m, e.center.x, e.center.y);
            const r = e.radius * ((scaleX(m) + scaleY(m)) / 2);
            circles.push({ cx, cy, r });
            track(cx - r, cy - r);
            track(cx + r, cy + r);
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
            polyline(pts, m, false);
          }
          break;
        case 'ELLIPSE':
          if (e.center && e.majorAxisEndPoint) {
            const ratio = e.axisRatio ?? 1;
            const ax = e.majorAxisEndPoint.x;
            const ay = e.majorAxisEndPoint.y;
            const major = Math.hypot(ax, ay);
            const minor = major * ratio;
            const rot = Math.atan2(ay, ax);
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
            polyline(pts, m, false);
          }
          break;
        case 'TEXT':
        case 'MTEXT': {
          const sp = e.startPoint ?? e.position;
          const raw = e.text ?? '';
          const content = cleanText(raw);
          if (sp && content) {
            const x = applyX(m, sp.x, sp.y);
            const y = applyY(m, sp.x, sp.y);
            const h = (e.textHeight ?? e.height ?? 2.5) * ((scaleX(m) + scaleY(m)) / 2);
            const rot = (e.rotation ?? 0) + (Math.atan2(m.b, m.a) * 180) / Math.PI;
            texts.push({ x, y, text: content, height: h, rotation: rot });
            track(x, y);
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
              // M = parent · T(p) · R(rot) · S(sx,sy) · T(-base)
              let im = mul(m, { a: 1, b: 0, c: 0, d: 1, e: p.x, f: p.y });
              im = mul(im, { a: Math.cos(rot), b: Math.sin(rot), c: -Math.sin(rot), d: Math.cos(rot), e: 0, f: 0 });
              im = mul(im, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
              im = mul(im, { a: 1, b: 0, c: 0, d: 1, e: -base.x, f: -base.y });
              process(block.entities, im, depth + 1);
            }
          }
          break;
        default:
          break;
      }
    }
  };

  process(dxf.entities, IDENTITY, 0);

  if (!isFinite(minX)) {
    throw new Error('Aucune géométrie exploitable trouvée dans le DXF.');
  }

  return {
    pathData: segs.join(' '),
    circles,
    texts,
    bounds: { minX, minY, maxX, maxY },
    metersPerUnit: 1,
    visible: true,
    opacity: 0.6,
    name,
    entityCount: count,
  };
}

/** Nettoie le texte MTEXT des codes de formatage AutoCAD. */
function cleanText(s: string): string {
  return s
    .replace(/\\P/g, ' ') // saut de paragraphe
    .replace(/\\[A-Za-z][^;\\]*;?/g, '') // codes \f \H \C ...
    .replace(/[{}]/g, '')
    .trim();
}

interface DxfPoint {
  x: number;
  y: number;
}
interface DxfEntity {
  type: string;
  vertices?: DxfPoint[];
  center?: DxfPoint;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  shape?: boolean;
  majorAxisEndPoint?: DxfPoint;
  axisRatio?: number;
  // texte
  startPoint?: DxfPoint;
  position?: DxfPoint;
  text?: string;
  textHeight?: number;
  height?: number;
  rotation?: number;
  // insert
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
