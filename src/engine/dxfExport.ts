import { Network } from '../types/network';

/**
 * Génère un fichier DXF (R12, ASCII) du réseau : conduites en polylignes,
 * symboles des nœuds/sources/réservoirs/pompes/vannes et étiquettes, par calques.
 * Les coordonnées du modèle (Y vers le haut) correspondent au repère DXF.
 */
export function buildDxf(network: Network): string {
  const L: string[] = [];
  const g = (code: number, value: string | number) => {
    L.push(String(code));
    L.push(String(value));
  };
  const num = (v: number) => Number(v.toFixed(4));

  // Étendue pour dimensionner les symboles
  const xs: number[] = [];
  const ys: number[] = [];
  for (const nd of Object.values(network.nodes)) {
    xs.push(nd.x);
    ys.push(nd.y);
  }
  for (const lk of Object.values(network.links)) {
    for (const v of lk.vertices ?? []) {
      xs.push(v.x);
      ys.push(v.y);
    }
  }
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 100;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 100;
  const diag = Math.hypot(maxX - minX, maxY - minY) || 100;
  const sym = Math.max(diag * 0.006, 0.001);
  const txt = sym * 1.3;

  const polyline = (layer: string, pts: { x: number; y: number }[], closed: boolean) => {
    if (pts.length < 2) return;
    g(0, 'LWPOLYLINE');
    g(8, layer);
    g(90, pts.length);
    g(70, closed ? 1 : 0);
    for (const p of pts) {
      g(10, num(p.x));
      g(20, num(p.y));
    }
  };
  const circle = (layer: string, cx: number, cy: number, r: number) => {
    g(0, 'CIRCLE');
    g(8, layer);
    g(10, num(cx));
    g(20, num(cy));
    g(40, num(r));
  };
  const text = (layer: string, x: number, y: number, h: number, s: string) => {
    g(0, 'TEXT');
    g(8, layer);
    g(10, num(x));
    g(20, num(y));
    g(40, num(h));
    g(1, s);
  };
  const square = (layer: string, cx: number, cy: number, half: number) => {
    polyline(
      layer,
      [
        { x: cx - half, y: cy - half },
        { x: cx + half, y: cy - half },
        { x: cx + half, y: cy + half },
        { x: cx - half, y: cy + half },
      ],
      true,
    );
  };

  // --- En-tête ---
  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$EXTMIN');
  g(10, num(minX - sym));
  g(20, num(minY - sym));
  g(9, '$EXTMAX');
  g(10, num(maxX + sym));
  g(20, num(maxY + sym));
  g(0, 'ENDSEC');

  // --- Calques ---
  const layers: [string, number][] = [
    ['CONDUITES', 5],
    ['NOEUDS', 8],
    ['SOURCES', 4],
    ['RESERVOIRS', 3],
    ['POMPES', 1],
    ['VANNES', 2],
    ['ETIQUETTES', 7],
  ];
  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, layers.length);
  for (const [name, color] of layers) {
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

  // Liens
  for (const lk of Object.values(network.links)) {
    const a = network.nodes[lk.node1];
    const b = network.nodes[lk.node2];
    if (!a || !b) continue;
    const pts = [a, ...(lk.vertices ?? []), b];
    const mid = pts[Math.floor(pts.length / 2)];
    if (lk.type === 'pipe') {
      polyline('CONDUITES', pts, false);
    } else if (lk.type === 'pump') {
      polyline('POMPES', pts, false);
      circle('POMPES', mid.x, mid.y, sym * 0.7);
    } else {
      polyline('VANNES', pts, false);
      square('VANNES', mid.x, mid.y, sym * 0.6);
    }
  }

  // Nœuds
  for (const nd of Object.values(network.nodes)) {
    if (nd.type === 'junction') {
      circle('NOEUDS', nd.x, nd.y, sym * 0.5);
    } else if (nd.type === 'reservoir') {
      square('SOURCES', nd.x, nd.y, sym * 0.8);
    } else {
      square('RESERVOIRS', nd.x, nd.y, sym * 0.8);
    }
    text('ETIQUETTES', nd.x + sym, nd.y + sym * 0.5, txt, nd.id);
  }

  g(0, 'ENDSEC');
  g(0, 'EOF');
  return L.join('\r\n');
}
