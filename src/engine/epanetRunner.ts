import {
  Workspace,
  Project,
  CountType,
  NodeProperty,
  LinkProperty,
  InitHydOption,
} from 'epanet-js';
import { Network, SimulationResults, isUSUnits } from '../types/network';
import { buildInp } from './inpBuilder';

let workspace: Workspace | null = null;

async function getWorkspace(): Promise<Workspace> {
  if (!workspace) {
    workspace = new Workspace();
    await workspace.loadModule();
  }
  return workspace;
}

/**
 * Exécute une simulation hydraulique sur le réseau via le moteur EPANET (WASM).
 * Parcourt toute la durée (régime permanent ou étendu) et collecte les résultats
 * pour chaque pas de temps.
 */
export async function runSimulation(network: Network): Promise<SimulationResults> {
  const ws = await getWorkspace();
  const inp = buildInp(network);
  ws.writeFile('net.inp', inp);

  const model = new Project(ws);
  const warnings: string[] = [];

  model.open('net.inp', 'report.rpt', 'out.bin');

  // Cartographie id -> index
  const nodeCount = model.getCount(CountType.NodeCount);
  const linkCount = model.getCount(CountType.LinkCount);

  const nodeIds: string[] = [];
  for (let i = 1; i <= nodeCount; i++) nodeIds.push(model.getNodeId(i));
  const linkIds: string[] = [];
  for (let i = 1; i <= linkCount; i++) linkIds.push(model.getLinkId(i));

  const nodes: SimulationResults['nodes'] = {};
  const links: SimulationResults['links'] = {};
  for (const id of nodeIds) nodes[id] = { pressure: [], head: [], demand: [], quality: [] };
  for (const id of linkIds)
    links[id] = { flow: [], velocity: [], headloss: [], status: [] };

  const times: number[] = [];

  try {
    model.openH();
    model.initH(InitHydOption.NoSave);

    let tstep = Infinity;
    let lastTime = -1;
    do {
      const t = model.runH();

      if (t !== lastTime) {
        times.push(t);
        for (let i = 1; i <= nodeCount; i++) {
          const id = nodeIds[i - 1];
          nodes[id].pressure.push(model.getNodeValue(i, NodeProperty.Pressure));
          nodes[id].head.push(model.getNodeValue(i, NodeProperty.Head));
          nodes[id].demand.push(model.getNodeValue(i, NodeProperty.Demand));
        }
        for (let i = 1; i <= linkCount; i++) {
          const id = linkIds[i - 1];
          links[id].flow.push(model.getLinkValue(i, LinkProperty.Flow));
          links[id].velocity.push(model.getLinkValue(i, LinkProperty.Velocity));
          links[id].headloss.push(model.getLinkValue(i, LinkProperty.Headloss));
          links[id].status.push(model.getLinkValue(i, LinkProperty.Status));
        }
        lastTime = t;
      }

      tstep = model.nextH();
    } while (tstep > 0);

    model.closeH();
  } catch (err) {
    warnings.push(
      `Avertissement moteur : ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    model.close();
  }

  const us = isUSUnits(network.options.flowUnits);

  return {
    times,
    nodes,
    links,
    warnings,
    ranAt: new Date().toISOString(),
    flowUnits: network.options.flowUnits,
    lengthUnit: us ? 'ft' : 'm',
    pressureUnit: us ? 'psi' : 'm',
  };
}

/** Valide le réseau avant simulation. Retourne la liste des problèmes bloquants. */
export function validateNetwork(network: Network): string[] {
  const errors: string[] = [];
  const nodeCount = Object.keys(network.nodes).length;
  const linkCount = Object.keys(network.links).length;

  if (nodeCount === 0) errors.push('Le réseau ne contient aucun nœud.');
  if (linkCount === 0) errors.push('Le réseau ne contient aucune conduite.');

  const hasSource = Object.values(network.nodes).some(
    (nd) => nd.type === 'reservoir' || nd.type === 'tank',
  );
  if (!hasSource)
    errors.push('Le réseau doit contenir au moins un réservoir ou un château d’eau (source).');

  // Liens orphelins
  for (const link of Object.values(network.links)) {
    if (!network.nodes[link.node1] || !network.nodes[link.node2]) {
      errors.push(`Le lien ${link.id} référence un nœud inexistant.`);
    }
  }
  return errors;
}
