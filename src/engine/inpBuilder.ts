import { Network, Junction, Reservoir, Tank, Pipe, Pump, Valve } from '../types/network';
import { pipeFittingsLoss } from '../utils/pipeGeometry';

/** Formate un nombre pour le fichier .inp (évite la notation exponentielle excessive). */
function n(v: number): string {
  if (!isFinite(v)) return '0';
  return Number(v.toFixed(6)).toString();
}

function secToClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Construit le contenu d'un fichier EPANET .inp à partir du modèle réseau.
 * Les pompes en mode "head" reçoivent une courbe à un point (débit, hauteur).
 */
export function buildInp(network: Network): string {
  const L: string[] = [];
  const { options } = network;

  // N'émet un identifiant de motif que s'il existe réellement (évite les
  // références indéfinies qui empêchent EPANET d'ouvrir le fichier).
  const refPattern = (id?: string): string => (id && network.patterns[id] ? id : '');

  L.push('[TITLE]');
  L.push(network.meta.name || 'Réseau');
  L.push('');

  // --- Nœuds ---
  const junctions: Junction[] = [];
  const reservoirs: Reservoir[] = [];
  const tanks: Tank[] = [];
  for (const node of Object.values(network.nodes)) {
    if (node.type === 'junction') junctions.push(node);
    else if (node.type === 'reservoir') reservoirs.push(node);
    else tanks.push(node);
  }

  L.push('[JUNCTIONS]');
  L.push(';ID\tElev\tDemand\tPattern');
  for (const j of junctions) {
    L.push(`${j.id}\t${n(j.elevation)}\t${n(j.baseDemand)}\t${refPattern(j.pattern)}`.trimEnd());
  }
  L.push('');

  L.push('[RESERVOIRS]');
  L.push(';ID\tHead\tPattern');
  for (const r of reservoirs) {
    L.push(`${r.id}\t${n(r.head)}\t${refPattern(r.pattern)}`.trimEnd());
  }
  L.push('');

  L.push('[TANKS]');
  L.push(';ID\tElev\tInitLvl\tMinLvl\tMaxLvl\tDiam\tMinVol\tVolCurve');
  for (const t of tanks) {
    const volCurve = t.volumeCurve && network.curves[t.volumeCurve] ? t.volumeCurve : '';
    L.push(
      `${t.id}\t${n(t.elevation)}\t${n(t.initLevel)}\t${n(t.minLevel)}\t${n(t.maxLevel)}\t${n(
        t.diameter,
      )}\t${n(t.minVolume ?? 0)}\t${volCurve}`.trimEnd(),
    );
  }
  L.push('');

  // --- Liens ---
  const pipes: Pipe[] = [];
  const pumps: Pump[] = [];
  const valves: Valve[] = [];
  for (const link of Object.values(network.links)) {
    if (link.type === 'pipe') pipes.push(link);
    else if (link.type === 'pump') pumps.push(link);
    else valves.push(link);
  }

  L.push('[PIPES]');
  L.push(';ID\tNode1\tNode2\tLength\tDiam\tRough\tMinorLoss\tStatus');
  for (const p of pipes) {
    const totalMinor = p.minorLoss + pipeFittingsLoss(network, p);
    L.push(
      `${p.id}\t${p.node1}\t${p.node2}\t${n(p.length)}\t${n(p.diameter)}\t${n(p.roughness)}\t${n(
        totalMinor,
      )}\t${p.status}`,
    );
  }
  L.push('');

  // Courbes des pompes (caractéristique + rendement) et lignes [ENERGY]
  const curveLines: string[] = [];
  const energyLines: string[] = [];
  L.push('[PUMPS]');
  L.push(';ID\tNode1\tNode2\tParameters');
  for (const pu of pumps) {
    let params: string;
    if (pu.mode === 'power' && pu.power != null) {
      params = `POWER ${n(pu.power)}`;
    } else if (pu.headCurve && network.curves[pu.headCurve]) {
      // Référence vers une courbe de la bibliothèque
      params = `HEAD ${pu.headCurve}`;
    } else {
      const curveId = `C_${pu.id}`;
      const pts =
        pu.curve && pu.curve.length
          ? pu.curve
          : [{ flow: pu.designFlow ?? 50, head: pu.designHead ?? 40 }];
      curveLines.push(`;PUMP: ${pu.id}`);
      for (const p of pts) curveLines.push(`${curveId}\t${n(p.flow)}\t${n(p.head)}`);
      params = `HEAD ${curveId}`;
    }
    if (pu.speed != null && pu.speed !== 1) params += ` SPEED ${n(pu.speed)}`;
    if (pu.speedPattern && network.patterns[pu.speedPattern]) params += ` PATTERN ${pu.speedPattern}`;
    L.push(`${pu.id}\t${pu.node1}\t${pu.node2}\t${params}`);

    // Données énergétiques
    if (pu.efficiencyCurve && network.curves[pu.efficiencyCurve]) {
      energyLines.push(`PUMP ${pu.id} EFFIC ${pu.efficiencyCurve}`);
    } else if (pu.efficiency != null && pu.efficiency > 0) {
      const eid = `E_${pu.id}`;
      const q = pu.designFlow ?? pu.curve?.[Math.floor((pu.curve.length - 1) / 2)]?.flow ?? 50;
      curveLines.push(`;EFFICIENCY: ${pu.id}`);
      curveLines.push(`${eid}\t${n(q * 0.5)}\t${n(pu.efficiency)}`);
      curveLines.push(`${eid}\t${n(q)}\t${n(pu.efficiency)}`);
      curveLines.push(`${eid}\t${n(q * 1.5)}\t${n(pu.efficiency)}`);
      energyLines.push(`PUMP ${pu.id} EFFIC ${eid}`);
    }
    if (pu.energyPrice != null) energyLines.push(`PUMP ${pu.id} PRICE ${n(pu.energyPrice)}`);
    if (pu.pricePattern && network.patterns[pu.pricePattern])
      energyLines.push(`PUMP ${pu.id} PATTERN ${pu.pricePattern}`);
  }
  L.push('');

  L.push('[VALVES]');
  L.push(';ID\tNode1\tNode2\tDiam\tType\tSetting\tMinorLoss');
  for (const v of valves) {
    L.push(
      `${v.id}\t${v.node1}\t${v.node2}\t${n(v.diameter)}\t${v.valveKind}\t${n(v.setting)}\t${n(
        v.minorLoss,
      )}`,
    );
  }
  L.push('');

  // --- Patterns ---
  L.push('[PATTERNS]');
  L.push(';ID\tMultipliers');
  for (const pat of Object.values(network.patterns)) {
    // 6 valeurs par ligne
    for (let i = 0; i < pat.multipliers.length; i += 6) {
      const chunk = pat.multipliers.slice(i, i + 6).map(n).join('\t');
      L.push(`${pat.id}\t${chunk}`);
    }
  }
  L.push('');

  L.push('[CURVES]');
  L.push(';ID\tX-Value\tY-Value');
  // Bibliothèque de courbes (typées via commentaire)
  for (const c of Object.values(network.curves ?? {})) {
    L.push(`;${c.type}: ${c.description || c.id}`);
    for (const p of c.points) L.push(`${c.id}\t${n(p.x)}\t${n(p.y)}`);
  }
  // Courbes générées pour les pompes sans référence de bibliothèque
  for (const c of curveLines) L.push(c);
  L.push('');

  L.push('[ENERGY]');
  for (const line of energyLines) L.push(line);
  L.push('');

  // --- Contrôles simples ---
  L.push('[CONTROLS]');
  for (const ctrl of network.controls ?? []) {
    if (!network.links[ctrl.linkId]) continue;
    const set =
      ctrl.setting === 'OPEN' ? 'OPEN' : ctrl.setting === 'CLOSED' ? 'CLOSED' : n(ctrl.setting);
    if (ctrl.conditionType === 'node-level' && ctrl.nodeId && network.nodes[ctrl.nodeId]) {
      const op = ctrl.operator === 'above' ? 'ABOVE' : 'BELOW';
      L.push(`LINK ${ctrl.linkId} ${set} IF NODE ${ctrl.nodeId} ${op} ${n(ctrl.value)}`);
    } else if (ctrl.conditionType === 'time') {
      L.push(`LINK ${ctrl.linkId} ${set} AT TIME ${n(ctrl.value)}`);
    }
  }
  L.push('');

  // --- Options & temps ---
  L.push('[OPTIONS]');
  L.push(`Units\t${options.flowUnits}`);
  L.push(`Headloss\t${options.headlossFormula}`);
  L.push(`Specific Gravity\t${n(options.specificGravity)}`);
  L.push(`Viscosity\t${n(options.viscosity)}`);
  L.push(`Trials\t${options.trials}`);
  L.push(`Accuracy\t${n(options.accuracy)}`);
  L.push('Unbalanced\tCONTINUE 10');
  // Motif par défaut : seulement s'il existe un motif portant ce nom, sinon
  // chaque nœud porte déjà son propre motif (demande constante par défaut).
  if (network.patterns['1']) L.push('Pattern\t1');
  L.push('Demand Multiplier\t1.0');
  L.push('');

  L.push('[TIMES]');
  L.push(`Duration\t${secToClock(options.duration)}`);
  L.push(`Hydraulic Timestep\t${secToClock(options.hydraulicStep)}`);
  L.push(`Pattern Timestep\t1:00`);
  L.push(`Report Timestep\t${secToClock(options.reportStep)}`);
  L.push(`Report Start\t0:00`);
  L.push(`Start ClockTime\t0:00`);
  L.push('');

  L.push('[REPORT]');
  L.push('Status\tNO');
  L.push('Summary\tNO');
  L.push('Page\t0');
  L.push('');

  // --- Coordonnées ---
  L.push('[COORDINATES]');
  L.push(';Node\tX\tY');
  for (const node of Object.values(network.nodes)) {
    L.push(`${node.id}\t${n(node.x)}\t${n(node.y)}`);
  }
  L.push('');

  L.push('[VERTICES]');
  L.push(';Link\tX\tY');
  for (const link of Object.values(network.links)) {
    if (link.vertices) {
      for (const v of link.vertices) L.push(`${link.id}\t${n(v.x)}\t${n(v.y)}`);
    }
  }
  L.push('');

  // --- Dimensions de la carte (avec marge) ---
  // Sans marge, EPANET cale la carte sur l'étendue exacte du réseau et ne
  // permet plus de dézoomer. On ajoute ~15 % de marge autour des éléments.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const node of Object.values(network.nodes)) {
    xs.push(node.x);
    ys.push(node.y);
  }
  for (const link of Object.values(network.links)) {
    for (const v of link.vertices ?? []) {
      xs.push(v.x);
      ys.push(v.y);
    }
  }
  if (xs.length > 0) {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = Math.max((maxX - minX) * 0.15, 50);
    const padY = Math.max((maxY - minY) * 0.15, 50);
    L.push('[BACKDROP]');
    L.push(
      `DIMENSIONS\t${n(minX - padX)}\t${n(minY - padY)}\t${n(maxX + padX)}\t${n(maxY + padY)}`,
    );
    L.push('UNITS\tNone');
    L.push('OFFSET\t0\t0');
    L.push('');
  }

  L.push('[END]');
  // Fins de ligne Windows (CRLF) : EPANET Desktop ne reconnaît les sections
  // qu'avec des CRLF. En LF seul, il lit tout le fichier comme une seule ligne
  // et n'affiche aucun élément.
  return L.join('\r\n');
}
