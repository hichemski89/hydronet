import {
  Network,
  NetworkNode,
  NetworkLink,
  Junction,
  Reservoir,
  Tank,
  Pipe,
  Pump,
  Valve,
  ValveKind,
  LinkStatus,
  Pattern,
  Curve,
  CurveType,
  SimpleControl,
  FlowUnit,
  HeadlossFormula,
  DEFAULT_OPTIONS,
  DEFAULT_CRITERIA,
} from '../types/network';

/** Découpe une ligne en jetons, en retirant le commentaire (;...). */
function tokenize(line: string): string[] {
  const noComment = line.split(';')[0].trim();
  if (!noComment) return [];
  return noComment.split(/\s+/);
}

function clockToSec(s: string): number {
  if (s == null) return 0;
  // Formats acceptés : "24:00", "1:30", "0:00", "12", "1.5"
  if (s.includes(':')) {
    const [h, m = '0', sec = '0'] = s.split(':');
    return (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(sec) || 0);
  }
  const v = parseFloat(s);
  return isFinite(v) ? v * 3600 : 0;
}

/**
 * Analyse un fichier EPANET .inp et le convertit en modèle réseau HydroNet.
 * Gère les sections courantes ; ignore silencieusement les sections non prises en charge.
 */
export function parseInp(text: string, fallbackName = 'Réseau importé'): Network {
  const nodes: Record<string, NetworkNode> = {};
  const links: Record<string, NetworkLink> = {};
  const patterns: Record<string, Pattern> = {};
  const coords: Record<string, { x: number; y: number }> = {};
  const vertices: Record<string, { x: number; y: number }[]> = {};
  const curves: Record<string, { x: number; y: number }[]> = {};
  const demandOverride: Record<string, { demand: number; pattern?: string }> = {};
  const energyData: Record<string, { price?: number; pricePattern?: string; efficCurve?: string }> = {};
  const controls: SimpleControl[] = [];
  const options = { ...DEFAULT_OPTIONS };
  let title = '';
  let controlCounter = 0;

  // Tampon brut des pompes (les courbes peuvent être définies après).
  const pumpRaw: { id: string; n1: string; n2: string; params: string[] }[] = [];
  const curveTypes: Record<string, CurveType> = {};
  const curveDesc: Record<string, string> = {};
  const tankVolCurve: Record<string, string> = {};
  let pendingCurveType: CurveType | null = null;
  let pendingCurveDesc = '';

  const lines = text.split(/\r?\n/);
  let section = '';

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const secMatch = trimmed.match(/^\[(.+?)\]/);
    if (secMatch) {
      section = secMatch[1].toUpperCase();
      continue;
    }
    if (section === 'TITLE') {
      const t = raw.split(';')[0].trim();
      if (t && !title) title = t;
      continue;
    }
    // Marqueurs de type de courbe (commentaires précédant une courbe)
    if (section === 'CURVES' && trimmed.startsWith(';')) {
      const m = trimmed.match(/^;\s*(PUMP|EFFICIENCY|VOLUME|HEADLOSS)\s*:?\s*(.*)$/i);
      if (m) {
        pendingCurveType = m[1].toUpperCase() as CurveType;
        pendingCurveDesc = m[2].trim();
      }
      continue;
    }
    const tk = tokenize(raw);
    if (tk.length === 0) continue;

    switch (section) {
      case 'JUNCTIONS': {
        const [id, elev, demand, pattern] = tk;
        nodes[id] = {
          id,
          type: 'junction',
          x: 0,
          y: 0,
          elevation: num(elev),
          baseDemand: num(demand),
          pattern: pattern || undefined,
        } as Junction;
        break;
      }
      case 'RESERVOIRS': {
        const [id, head, pattern] = tk;
        nodes[id] = {
          id,
          type: 'reservoir',
          x: 0,
          y: 0,
          head: num(head),
          pattern: pattern || undefined,
        } as Reservoir;
        break;
      }
      case 'TANKS': {
        const [id, elev, init, min, max, diam, minvol, volcurve] = tk;
        if (volcurve) tankVolCurve[id] = volcurve;
        nodes[id] = {
          id,
          type: 'tank',
          x: 0,
          y: 0,
          elevation: num(elev),
          initLevel: num(init),
          minLevel: num(min),
          maxLevel: num(max),
          diameter: num(diam),
          minVolume: minvol ? num(minvol) : 0,
        } as Tank;
        break;
      }
      case 'PIPES': {
        const [id, n1, n2, len, diam, rough, mloss, status] = tk;
        links[id] = {
          id,
          type: 'pipe',
          node1: n1,
          node2: n2,
          length: num(len),
          diameter: num(diam),
          roughness: num(rough),
          minorLoss: num(mloss),
          status: (status?.toUpperCase() as LinkStatus) || 'OPEN',
        } as Pipe;
        break;
      }
      case 'PUMPS': {
        const [id, n1, n2, ...params] = tk;
        pumpRaw.push({ id, n1, n2, params });
        break;
      }
      case 'VALVES': {
        const [id, n1, n2, diam, type, setting, mloss] = tk;
        links[id] = {
          id,
          type: 'valve',
          node1: n1,
          node2: n2,
          diameter: num(diam),
          valveKind: (type?.toUpperCase() as ValveKind) || 'PRV',
          setting: num(setting),
          minorLoss: num(mloss),
        } as Valve;
        break;
      }
      case 'COORDINATES': {
        const [id, x, y] = tk;
        coords[id] = { x: num(x), y: num(y) };
        break;
      }
      case 'VERTICES': {
        const [id, x, y] = tk;
        (vertices[id] ??= []).push({ x: num(x), y: num(y) });
        break;
      }
      case 'PATTERNS': {
        const [id, ...mults] = tk;
        const p = (patterns[id] ??= { id, multipliers: [] });
        p.multipliers.push(...mults.map(num));
        break;
      }
      case 'CURVES': {
        const [id, x, y] = tk;
        if (!curves[id]) {
          if (pendingCurveType) {
            curveTypes[id] = pendingCurveType;
            curveDesc[id] = pendingCurveDesc;
          }
          pendingCurveType = null;
          pendingCurveDesc = '';
        }
        (curves[id] ??= []).push({ x: num(x), y: num(y) });
        break;
      }
      case 'DEMANDS': {
        const [id, demand, pattern] = tk;
        demandOverride[id] = { demand: num(demand), pattern: pattern || undefined };
        break;
      }
      case 'ENERGY': {
        if (tk[0]?.toUpperCase() === 'PUMP' && tk[1]) {
          const pid = tk[1];
          const kw = tk[2]?.toUpperCase();
          const ed = (energyData[pid] ??= {});
          if (kw === 'PRICE') ed.price = num(tk[3]);
          else if (kw === 'PATTERN') ed.pricePattern = tk[3];
          else if (kw === 'EFFIC') ed.efficCurve = tk[3];
        }
        break;
      }
      case 'CONTROLS': {
        // LINK <id> <OPEN|CLOSED|valeur> IF NODE <node> ABOVE|BELOW <val>
        // LINK <id> <...> AT TIME <heures>
        if (tk[0]?.toUpperCase() !== 'LINK') break;
        const linkId = tk[1];
        const setRaw = tk[2]?.toUpperCase();
        const setting: SimpleControl['setting'] =
          setRaw === 'OPEN' ? 'OPEN' : setRaw === 'CLOSED' ? 'CLOSED' : num(tk[2]);
        const kw3 = tk[3]?.toUpperCase();
        if (kw3 === 'IF' && tk[4]?.toUpperCase() === 'NODE') {
          controls.push({
            id: `C${++controlCounter}`,
            linkId,
            setting,
            conditionType: 'node-level',
            nodeId: tk[5],
            operator: tk[6]?.toUpperCase() === 'ABOVE' ? 'above' : 'below',
            value: num(tk[7]),
          });
        } else if (kw3 === 'AT' && tk[4]?.toUpperCase() === 'TIME') {
          controls.push({
            id: `C${++controlCounter}`,
            linkId,
            setting,
            conditionType: 'time',
            value: clockToSec(tk[5]) / 3600,
          });
        }
        break;
      }
      case 'OPTIONS': {
        const key = tk[0].toUpperCase();
        if (key === 'UNITS') options.flowUnits = (tk[1]?.toUpperCase() as FlowUnit) || 'LPS';
        else if (key === 'HEADLOSS')
          options.headlossFormula = (tk[1]?.toUpperCase() as HeadlossFormula) || 'H-W';
        else if (key === 'VISCOSITY') options.viscosity = num(tk[1]);
        else if (key === 'SPECIFIC' && tk[1]?.toUpperCase() === 'GRAVITY')
          options.specificGravity = num(tk[2]);
        else if (key === 'TRIALS') options.trials = Math.round(num(tk[1]));
        else if (key === 'ACCURACY') options.accuracy = num(tk[1]);
        break;
      }
      case 'TIMES': {
        const key = tk[0].toUpperCase();
        const val = tk.slice(1).join(' ');
        if (key === 'DURATION') options.duration = clockToSec(tk[1]);
        else if (key === 'HYDRAULIC') options.hydraulicStep = clockToSec(tk[2]);
        else if (key === 'REPORT' && tk[1]?.toUpperCase() === 'TIMESTEP')
          options.reportStep = clockToSec(tk[2]);
        void val;
        break;
      }
      default:
        break;
    }
  }

  // Résolution des pompes (mode HEAD via courbe, ou POWER).
  for (const pr of pumpRaw) {
    const pump: Pump = {
      id: pr.id,
      type: 'pump',
      node1: pr.n1,
      node2: pr.n2,
      mode: 'head',
      status: 'OPEN',
      speed: 1,
      designFlow: 50,
      designHead: 40,
    };
    for (let i = 0; i < pr.params.length; i++) {
      const kw = pr.params[i].toUpperCase();
      const val = pr.params[i + 1];
      if (kw === 'POWER') {
        pump.mode = 'power';
        pump.power = num(val);
        i++;
      } else if (kw === 'HEAD') {
        pump.mode = 'head';
        pump.headCurve = val;
        curveTypes[val] = curveTypes[val] ?? 'PUMP';
        const curve = curves[val];
        if (curve && curve.length) {
          const mid = curve[Math.floor(curve.length / 2)];
          pump.designFlow = mid.x;
          pump.designHead = mid.y;
        }
        i++;
      } else if (kw === 'SPEED') {
        pump.speed = num(val);
        i++;
      } else if (kw === 'PATTERN') {
        pump.speedPattern = val;
        i++;
      }
    }
    const ed = energyData[pr.id];
    if (ed) {
      if (ed.price != null) pump.energyPrice = ed.price;
      if (ed.pricePattern) pump.pricePattern = ed.pricePattern;
      if (ed.efficCurve && curves[ed.efficCurve]?.length) {
        pump.efficiencyCurve = ed.efficCurve;
        curveTypes[ed.efficCurve] = 'EFFICIENCY';
        const ys = curves[ed.efficCurve].map((p) => p.y);
        pump.efficiency = Math.round((ys.reduce((a, b) => a + b, 0) / ys.length) * 10) / 10;
      }
    }
    links[pr.id] = pump;
  }

  // Application des coordonnées et vertices.
  for (const id of Object.keys(nodes)) {
    const c = coords[id];
    if (c) {
      nodes[id].x = c.x;
      nodes[id].y = c.y;
    }
  }
  for (const id of Object.keys(links)) {
    if (vertices[id]) links[id].vertices = vertices[id];
  }

  // Surcharges de demande.
  for (const [id, d] of Object.entries(demandOverride)) {
    const nd = nodes[id];
    if (nd && nd.type === 'junction') {
      nd.baseDemand = d.demand;
      if (d.pattern) nd.pattern = d.pattern;
    }
  }

  // Courbes de volume des réservoirs
  for (const [tankId, cid] of Object.entries(tankVolCurve)) {
    const nd = nodes[tankId];
    if (nd && nd.type === 'tank') (nd as Tank).volumeCurve = cid;
    if (curves[cid]) curveTypes[cid] = 'VOLUME';
  }

  // Construction de la bibliothèque de courbes typées
  const curveLib: Record<string, Curve> = {};
  for (const [id, pts] of Object.entries(curves)) {
    curveLib[id] = {
      id,
      type: curveTypes[id] ?? 'PUMP',
      description: curveDesc[id] || undefined,
      points: pts.map((p) => ({ x: p.x, y: p.y })),
    };
  }

  // Si aucune coordonnée n'est fournie, disposition automatique en grille.
  const anyCoord = Object.keys(coords).length > 0;
  if (!anyCoord) autoLayout(nodes, links);

  return {
    meta: {
      name: title || fallbackName,
      author: '',
      description: '',
      createdAt: new Date().toISOString(),
    },
    nodes,
    links,
    patterns,
    curves: curveLib,
    options,
    criteria: { ...DEFAULT_CRITERIA },
    controls,
  };
}

function num(s: string | undefined): number {
  const v = parseFloat(s ?? '');
  return isFinite(v) ? v : 0;
}

/** Disposition de secours : grille simple si le .inp ne contient pas de coordonnées. */
function autoLayout(nodes: Record<string, NetworkNode>, _links: Record<string, NetworkLink>): void {
  const ids = Object.keys(nodes);
  const cols = Math.ceil(Math.sqrt(ids.length));
  const spacing = 120;
  ids.forEach((id, i) => {
    nodes[id].x = (i % cols) * spacing;
    nodes[id].y = -Math.floor(i / cols) * spacing;
  });
  void _links;
}
