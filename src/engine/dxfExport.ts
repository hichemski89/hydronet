import { Network, SimulationResults } from '../types/network';
import { flowUnitLabel } from '../utils/format';
import { roundedPolyline, effectiveBendRadius } from '../utils/pipeGeometry';
import { minBendRadiusMeters } from '../data/pipeCatalog';

function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}
function nodeTypeLabel(t: string): string {
  return t === 'junction' ? 'Noeud' : t === 'reservoir' ? 'Bache' : 'Reservoir';
}
function linkTypeLabel(t: string): string {
  return t === 'pipe' ? 'Conduite' : t === 'pump' ? 'Pompe' : 'Vanne';
}
function fmt(v: number | undefined): string {
  return v == null || !isFinite(v) ? '-' : v.toFixed(2);
}

/**
 * Génère un DXF (R12) du réseau, avec optionnellement un tableau des résultats
 * et une légende. N'utilise que des entités LINE/CIRCLE/TEXT (compatibles AutoCAD).
 */
export function buildDxf(
  network: Network,
  results?: SimulationResults | null,
  timeIndex = 0,
  metersPerUnit = 1,
): string {
  const L: string[] = [];
  const g = (code: number, value: string | number) => {
    L.push(String(code));
    L.push(String(value));
  };
  const num = (v: number) => Number(v.toFixed(4));

  const xs: number[] = [];
  const ys: number[] = [];
  for (const nd of Object.values(network.nodes)) {
    xs.push(nd.x);
    ys.push(nd.y);
  }
  for (const lk of Object.values(network.links)) for (const v of lk.vertices ?? []) {
    xs.push(v.x);
    ys.push(v.y);
  }
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 100;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 100;
  const diag = Math.hypot(maxX - minX, maxY - minY) || 100;
  const sym = Math.max(diag * 0.006, 0.001);
  const txt = sym * 1.3;
  const rowH = txt * 2;

  const line = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    g(0, 'LINE');
    g(8, layer);
    g(10, num(x1));
    g(20, num(y1));
    g(30, 0);
    g(11, num(x2));
    g(21, num(y2));
    g(31, 0);
  };
  const polyline = (layer: string, pts: { x: number; y: number }[], closed: boolean) => {
    for (let i = 0; i < pts.length - 1; i++) line(layer, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (closed && pts.length > 2) line(layer, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y);
  };
  const circle = (layer: string, cx: number, cy: number, r: number) => {
    g(0, 'CIRCLE');
    g(8, layer);
    g(10, num(cx));
    g(20, num(cy));
    g(30, 0);
    g(40, num(r));
  };
  const text = (layer: string, x: number, y: number, h: number, s: string) => {
    g(0, 'TEXT');
    g(8, layer);
    g(10, num(x));
    g(20, num(y));
    g(30, 0);
    g(40, num(h));
    g(1, s);
  };
  const square = (layer: string, cx: number, cy: number, half: number) =>
    polyline(layer, [
      { x: cx - half, y: cy - half },
      { x: cx + half, y: cy - half },
      { x: cx + half, y: cy + half },
      { x: cx - half, y: cy + half },
    ], true);

  // Dessine un tableau (titre + grille) ; renvoie l'ordonnée du bas.
  const drawTable = (ox: number, oy: number, title: string, headers: string[], rows: string[][]): number => {
    text('TABLEAU', ox, oy, txt * 1.2, title);
    const top = oy - txt * 2.2;
    const pad = txt * 0.6;
    const charW = txt * 0.9;
    const colW = headers.map((h, c) => {
      let mx = h.length;
      for (const r of rows) mx = Math.max(mx, (r[c] ?? '').length);
      return mx * charW + 2 * pad;
    });
    const totalW = colW.reduce((a, b) => a + b, 0);
    const nRows = rows.length + 1;
    for (let i = 0; i <= nRows; i++) line('TABLEAU', ox, top - i * rowH, ox + totalW, top - i * rowH);
    const xPos = [ox];
    let cx = ox;
    for (const w of colW) {
      cx += w;
      xPos.push(cx);
    }
    for (const x of xPos) line('TABLEAU', x, top, x, top - nRows * rowH);
    for (let c = 0; c < headers.length; c++) text('TABLEAU', xPos[c] + pad, top - rowH + pad, txt, headers[c]);
    for (let ri = 0; ri < rows.length; ri++) {
      const y = top - (ri + 2) * rowH + pad;
      for (let c = 0; c < headers.length; c++) text('TABLEAU', xPos[c] + pad, y, txt, rows[ri][c] ?? '');
    }
    return top - nRows * rowH;
  };

  // --- En-tête ---
  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$INSUNITS');
  g(70, 6);
  g(0, 'ENDSEC');

  const layerDefs: [string, number][] = [
    ['0', 7],
    ['CONDUITES', 5],
    ['NOEUDS', 8],
    ['SOURCES', 4],
    ['RESERVOIRS', 3],
    ['POMPES', 1],
    ['VANNES', 2],
    ['ECOULEMENT', 6],
    ['ETIQUETTES', 7],
    ['TABLEAU', 7],
    ['LEGENDE', 7],
  ];
  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, layerDefs.length);
  for (const [name, color] of layerDefs) {
    g(0, 'LAYER');
    g(2, name);
    g(70, 0);
    g(62, color);
    g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  // --- Entités ---
  g(0, 'SECTION');
  g(2, 'ENTITIES');

  for (const lk of Object.values(network.links)) {
    const a = network.nodes[lk.node1];
    const b = network.nodes[lk.node2];
    if (!a || !b) continue;
    const pts = [a, ...(lk.vertices ?? []), b];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (lk.type === 'pipe') {
      const minRm = minBendRadiusMeters(lk.material, lk.dn);
      const drawn =
        minRm != null && (lk.vertices?.length ?? 0) > 0
          ? roundedPolyline(
              pts,
              (vi) => effectiveBendRadius(lk, vi, minRm) / metersPerUnit,
              (vi) => !!lk.fittings?.[vi],
            )
          : pts;
      polyline('CONDUITES', drawn, false);
    }
    else if (lk.type === 'pump') {
      polyline('POMPES', pts, false);
      circle('POMPES', mid.x, mid.y, sym * 0.7);
    } else {
      polyline('VANNES', pts, false);
      square('VANNES', mid.x, mid.y, sym * 0.6);
    }

    // Flèche de sens d'écoulement (sur le segment central)
    if (results) {
      const flow = results.links[lk.id]?.flow[timeIndex];
      if (flow != null && isFinite(flow) && Math.abs(flow) > 1e-6) {
        const si = Math.floor((pts.length - 1) / 2);
        const p0 = pts[si];
        const p1 = pts[si + 1];
        let dx = p1.x - p0.x;
        let dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        if (flow < 0) {
          dx = -dx;
          dy = -dy;
        }
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const ah = sym * 1.2;
        const tipx = mx + dx * ah * 0.5;
        const tipy = my + dy * ah * 0.5;
        line('ECOULEMENT', mx - dx * ah * 0.5, my - dy * ah * 0.5, tipx, tipy);
        const ang = Math.atan2(dy, dx);
        const barb = sym * 0.7;
        line('ECOULEMENT', tipx, tipy, tipx - Math.cos(ang - 0.45) * barb, tipy - Math.sin(ang - 0.45) * barb);
        line('ECOULEMENT', tipx, tipy, tipx - Math.cos(ang + 0.45) * barb, tipy - Math.sin(ang + 0.45) * barb);
      }
    }
  }
  for (const nd of Object.values(network.nodes)) {
    if (nd.type === 'junction') circle('NOEUDS', nd.x, nd.y, sym * 0.5);
    else if (nd.type === 'reservoir') square('SOURCES', nd.x, nd.y, sym * 0.8);
    else square('RESERVOIRS', nd.x, nd.y, sym * 0.8);
    text('ETIQUETTES', nd.x + sym, nd.y + sym * 0.5, txt, nd.id);
  }

  // --- Légende (sous le réseau) ---
  const lx = minX;
  let ly = minY - sym * 5;
  text('LEGENDE', lx, ly, txt * 1.3, 'LEGENDE');
  ly -= rowH * 1.3;
  const legend: [string, 'circle' | 'square' | 'line', string][] = [
    ['NOEUDS', 'circle', 'Noeud de demande'],
    ['SOURCES', 'square', 'Bache a eau / Source'],
    ['RESERVOIRS', 'square', 'Reservoir (stockage)'],
    ['POMPES', 'circle', 'Pompe'],
    ['VANNES', 'square', 'Vanne'],
    ['CONDUITES', 'line', 'Conduite'],
  ];
  for (const [layer, shape, label] of legend) {
    const sx = lx + sym;
    if (shape === 'circle') circle(layer, sx, ly, sym * 0.5);
    else if (shape === 'square') square(layer, sx, ly, sym * 0.6);
    else line(layer, lx, ly, lx + sym * 2, ly);
    text('LEGENDE', lx + sym * 3, ly - txt * 0.5, txt, label);
    ly -= rowH;
  }

  // --- Tableaux des résultats (à droite du réseau) ---
  if (results) {
    const flowU = flowUnitLabel(results.flowUnits);
    const lenU = results.lengthUnit;
    const presU = results.pressureUnit;
    const tx = maxX + sym * 8;
    let ty = maxY;

    const nodeRows = Object.values(network.nodes).map((nd) => {
      const r = results.nodes[nd.id];
      const elev = nd.type === 'reservoir' ? '-' : fmt((nd as { elevation?: number }).elevation);
      return [
        nd.id,
        nodeTypeLabel(nd.type),
        elev,
        fmt(r?.demand[timeIndex]),
        fmt(r?.pressure[timeIndex]),
        fmt(r?.head[timeIndex]),
      ];
    });
    ty = drawTable(
      tx,
      ty,
      `RESULTATS NOEUDS - ${clock(results.times[timeIndex] ?? 0)}`,
      ['ID', 'Type', `Cote(${lenU})`, `Demande(${flowU})`, `Pression(${presU})`, `Charge(${lenU})`],
      nodeRows,
    );

    ty -= rowH * 2;
    const linkRows = Object.values(network.links).map((lk) => {
      const r = results.links[lk.id];
      const len = lk.type === 'pipe' ? fmt(lk.length) : '-';
      const diam = lk.type === 'pump' ? '-' : fmt((lk as { diameter?: number }).diameter);
      return [
        lk.id,
        linkTypeLabel(lk.type),
        len,
        diam,
        fmt(r?.flow[timeIndex]),
        fmt(r?.velocity[timeIndex]),
        fmt(r?.headloss[timeIndex]),
      ];
    });
    drawTable(
      tx,
      ty,
      'RESULTATS CONDUITES',
      ['ID', 'Type', `Long(${lenU})`, 'Diam(mm)', `Debit(${flowU})`, `Vitesse(${lenU}/s)`, `Perte(${lenU})`],
      linkRows,
    );
  }

  g(0, 'ENDSEC');
  g(0, 'EOF');
  return L.join('\r\n');
}
