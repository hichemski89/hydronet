import { Network, Junction, Reservoir, Tank, Pipe, Pump, Valve } from '../types/network';

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
    L.push(`${j.id}\t${n(j.elevation)}\t${n(j.baseDemand)}\t${j.pattern ?? ''}`.trimEnd());
  }
  L.push('');

  L.push('[RESERVOIRS]');
  L.push(';ID\tHead\tPattern');
  for (const r of reservoirs) {
    L.push(`${r.id}\t${n(r.head)}\t${r.pattern ?? ''}`.trimEnd());
  }
  L.push('');

  L.push('[TANKS]');
  L.push(';ID\tElev\tInitLvl\tMinLvl\tMaxLvl\tDiam\tMinVol');
  for (const t of tanks) {
    L.push(
      `${t.id}\t${n(t.elevation)}\t${n(t.initLevel)}\t${n(t.minLevel)}\t${n(t.maxLevel)}\t${n(
        t.diameter,
      )}\t${n(t.minVolume ?? 0)}`,
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
    L.push(
      `${p.id}\t${p.node1}\t${p.node2}\t${n(p.length)}\t${n(p.diameter)}\t${n(p.roughness)}\t${n(
        p.minorLoss,
      )}\t${p.status}`,
    );
  }
  L.push('');

  // Courbes des pompes en mode "head"
  const curves: string[] = [];
  L.push('[PUMPS]');
  L.push(';ID\tNode1\tNode2\tParameters');
  for (const pu of pumps) {
    if (pu.mode === 'power' && pu.power != null) {
      L.push(`${pu.id}\t${pu.node1}\t${pu.node2}\tPOWER ${n(pu.power)}`);
    } else {
      const curveId = `C_${pu.id}`;
      const q = pu.designFlow ?? 50;
      const h = pu.designHead ?? 40;
      curves.push(`${curveId}\t${n(q)}\t${n(h)}`);
      let line = `${pu.id}\t${pu.node1}\t${pu.node2}\tHEAD ${curveId}`;
      if (pu.speed != null && pu.speed !== 1) line += ` SPEED ${n(pu.speed)}`;
      L.push(line);
    }
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
  L.push(';ID\tX\tY');
  for (const c of curves) L.push(`;PUMP: courbe à un point\n${c}`);
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
  L.push('Pattern\t1');
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

  L.push('[END]');
  return L.join('\n');
}
