import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  Network,
  NetworkNode,
  NetworkLink,
  NodeType,
  LinkType,
  ValveKind,
  SimulationResults,
  NetworkOptions,
  ComplianceCriteria,
  DEFAULT_OPTIONS,
  DEFAULT_CRITERIA,
} from '../types/network';
import { sampleNetwork } from '../utils/sampleNetwork';

export type Tool =
  | 'select'
  | 'pan'
  | 'junction'
  | 'reservoir'
  | 'tank'
  | 'pipe'
  | 'pump'
  | 'valve'
  | 'profile';

export interface Selection {
  kind: 'node' | 'link';
  id: string;
}

export type ResultMetric = 'pressure' | 'head' | 'demand' | 'flow' | 'velocity' | 'headloss';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface PendingLink {
  type: LinkType;
  node1: string;
  vertices: { x: number; y: number }[];
}

interface NetworkState {
  network: Network;
  tool: Tool;
  selection: Selection | null;
  view: ViewTransform;
  results: SimulationResults | null;
  currentTimeIndex: number;
  simStatus: 'idle' | 'running' | 'done' | 'error';
  simError: string | null;
  pendingLink: PendingLink | null;
  showResultsOverlay: boolean;
  nodeMetric: ResultMetric;
  linkMetric: ResultMetric;
  /** Mode de coloration de la carte : par métrique ou par conformité. */
  colorMode: 'metric' | 'compliance';
  /** Tracé du profil en long : suite ordonnée d'identifiants de nœuds. */
  profilePath: string[];
  /** Incrémenté pour demander un recadrage de la vue (chargement d'un réseau). */
  fitRequest: number;

  // Actions
  setTool: (tool: Tool) => void;
  setView: (view: Partial<ViewTransform>) => void;
  select: (sel: Selection | null) => void;
  addNode: (type: NodeType, x: number, y: number) => string;
  updateNode: (id: string, patch: Partial<NetworkNode>) => void;
  deleteNode: (id: string) => void;
  startLink: (type: LinkType, node1: string) => void;
  addLinkVertex: (x: number, y: number) => void;
  completeLink: (node2: string) => void;
  cancelPendingLink: () => void;
  updateLink: (id: string, patch: Partial<NetworkLink>) => void;
  deleteLink: (id: string) => void;
  deleteSelection: () => void;
  updateOptions: (patch: Partial<NetworkOptions>) => void;
  updateCriteria: (patch: Partial<ComplianceCriteria>) => void;
  updateMeta: (patch: Partial<Network['meta']>) => void;
  setResults: (results: SimulationResults | null) => void;
  setSimStatus: (status: NetworkState['simStatus'], error?: string | null) => void;
  setCurrentTimeIndex: (i: number) => void;
  toggleResultsOverlay: () => void;
  setNodeMetric: (m: ResultMetric) => void;
  setLinkMetric: (m: ResultMetric) => void;
  setColorMode: (m: 'metric' | 'compliance') => void;
  addToProfile: (nodeId: string) => void;
  clearProfile: () => void;
  loadNetwork: (network: Network) => void;
  newNetwork: () => void;
}

function emptyNetwork(): Network {
  return {
    meta: {
      name: 'Nouveau réseau',
      author: '',
      description: '',
      createdAt: new Date().toISOString(),
    },
    nodes: {},
    links: {},
    patterns: {},
    options: { ...DEFAULT_OPTIONS },
    criteria: { ...DEFAULT_CRITERIA },
  };
}

function defaultNode(type: NodeType, x: number, y: number, idNum: number): NetworkNode {
  const base = { x, y };
  switch (type) {
    case 'junction':
      return { id: `J${idNum}`, type, ...base, elevation: 0, baseDemand: 0 };
    case 'reservoir':
      return { id: `R${idNum}`, type, ...base, head: 100 };
    case 'tank':
      return {
        id: `T${idNum}`,
        type,
        ...base,
        elevation: 0,
        initLevel: 5,
        minLevel: 0,
        maxLevel: 10,
        diameter: 15,
      };
  }
}

function defaultLink(
  type: LinkType,
  node1: string,
  node2: string,
  vertices: { x: number; y: number }[],
  idNum: number,
): NetworkLink {
  switch (type) {
    case 'pipe':
      return {
        id: `P${idNum}`,
        type,
        node1,
        node2,
        vertices,
        length: 100,
        diameter: 100,
        roughness: 130,
        minorLoss: 0,
        status: 'OPEN',
      };
    case 'pump':
      return {
        id: `PU${idNum}`,
        type,
        node1,
        node2,
        vertices,
        mode: 'head',
        designFlow: 50,
        designHead: 40,
        status: 'OPEN',
        speed: 1,
      };
    case 'valve':
      return {
        id: `V${idNum}`,
        type,
        node1,
        node2,
        vertices,
        valveKind: 'PRV' as ValveKind,
        diameter: 100,
        setting: 30,
        minorLoss: 0,
      };
  }
}

let nodeCounter = 1000;
let linkCounter = 1000;

export const useNetworkStore = create<NetworkState>((set, get) => ({
  network: sampleNetwork(),
  tool: 'select',
  selection: null,
  view: { scale: 1, offsetX: 0, offsetY: 0 },
  results: null,
  currentTimeIndex: 0,
  simStatus: 'idle',
  simError: null,
  pendingLink: null,
  showResultsOverlay: true,
  nodeMetric: 'pressure',
  linkMetric: 'flow',
  colorMode: 'metric',
  profilePath: [],
  fitRequest: 0,

  setTool: (tool) => set({ tool, pendingLink: null }),
  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),
  select: (selection) => set({ selection }),

  addNode: (type, x, y) => {
    const id = defaultNode(type, x, y, ++nodeCounter).id;
    set((s) => {
      const node = defaultNode(type, x, y, nodeCounter);
      node.id = uniqueNodeId(s.network, node.id);
      return {
        network: { ...s.network, nodes: { ...s.network.nodes, [node.id]: node } },
        selection: { kind: 'node', id: node.id },
        results: null,
      };
    });
    return id;
  },

  updateNode: (id, patch) =>
    set((s) => {
      const node = s.network.nodes[id];
      if (!node) return s;
      return {
        network: {
          ...s.network,
          nodes: { ...s.network.nodes, [id]: { ...node, ...patch } as NetworkNode },
        },
      };
    }),

  deleteNode: (id) =>
    set((s) => {
      const nodes = { ...s.network.nodes };
      delete nodes[id];
      const links = { ...s.network.links };
      for (const lid of Object.keys(links)) {
        if (links[lid].node1 === id || links[lid].node2 === id) delete links[lid];
      }
      return {
        network: { ...s.network, nodes, links },
        selection: null,
        results: null,
      };
    }),

  startLink: (type, node1) => set({ pendingLink: { type, node1, vertices: [] } }),
  addLinkVertex: (x, y) =>
    set((s) =>
      s.pendingLink
        ? { pendingLink: { ...s.pendingLink, vertices: [...s.pendingLink.vertices, { x, y }] } }
        : s,
    ),

  completeLink: (node2) =>
    set((s) => {
      const p = s.pendingLink;
      if (!p || p.node1 === node2) return { pendingLink: null };
      const link = defaultLink(p.type, p.node1, node2, p.vertices, ++linkCounter);
      link.id = uniqueLinkId(s.network, link.id);
      return {
        network: { ...s.network, links: { ...s.network.links, [link.id]: link } },
        pendingLink: null,
        selection: { kind: 'link', id: link.id },
        results: null,
      };
    }),

  cancelPendingLink: () => set({ pendingLink: null }),

  updateLink: (id, patch) =>
    set((s) => {
      const link = s.network.links[id];
      if (!link) return s;
      return {
        network: {
          ...s.network,
          links: { ...s.network.links, [id]: { ...link, ...patch } as NetworkLink },
        },
      };
    }),

  deleteLink: (id) =>
    set((s) => {
      const links = { ...s.network.links };
      delete links[id];
      return { network: { ...s.network, links }, selection: null, results: null };
    }),

  deleteSelection: () => {
    const sel = get().selection;
    if (!sel) return;
    if (sel.kind === 'node') get().deleteNode(sel.id);
    else get().deleteLink(sel.id);
  },

  updateOptions: (patch) =>
    set((s) => ({
      network: { ...s.network, options: { ...s.network.options, ...patch } },
      results: null,
    })),

  updateCriteria: (patch) =>
    set((s) => ({ network: { ...s.network, criteria: { ...s.network.criteria, ...patch } } })),

  updateMeta: (patch) =>
    set((s) => ({ network: { ...s.network, meta: { ...s.network.meta, ...patch } } })),

  setResults: (results) =>
    set({ results, currentTimeIndex: 0, simStatus: results ? 'done' : 'idle' }),
  setSimStatus: (simStatus, simError = null) => set({ simStatus, simError }),
  setCurrentTimeIndex: (i) => set({ currentTimeIndex: i }),
  toggleResultsOverlay: () => set((s) => ({ showResultsOverlay: !s.showResultsOverlay })),
  setNodeMetric: (nodeMetric) => set({ nodeMetric }),
  setLinkMetric: (linkMetric) => set({ linkMetric }),
  setColorMode: (colorMode) => set({ colorMode }),
  addToProfile: (nodeId) =>
    set((s) => {
      // Évite les doublons consécutifs.
      if (s.profilePath[s.profilePath.length - 1] === nodeId) return s;
      return { profilePath: [...s.profilePath, nodeId] };
    }),
  clearProfile: () => set({ profilePath: [] }),

  loadNetwork: (network) =>
    set((s) => ({
      network,
      results: null,
      selection: null,
      currentTimeIndex: 0,
      simStatus: 'idle',
      profilePath: [],
      fitRequest: s.fitRequest + 1,
    })),
  newNetwork: () =>
    set((s) => ({
      network: emptyNetwork(),
      results: null,
      selection: null,
      currentTimeIndex: 0,
      simStatus: 'idle',
      profilePath: [],
      fitRequest: s.fitRequest + 1,
    })),
}));

function uniqueNodeId(network: Network, base: string): string {
  if (!network.nodes[base] && !network.links[base]) return base;
  let i = 1;
  while (network.nodes[`${base}_${i}`]) i++;
  return `${base}_${i}`;
}

function uniqueLinkId(network: Network, base: string): string {
  if (!network.links[base] && !network.nodes[base]) return base;
  let i = 1;
  while (network.links[`${base}_${i}`]) i++;
  return `${base}_${i}`;
}

/** Génère un identifiant court unique (utilitaire exporté). */
export function genId(prefix: string): string {
  return `${prefix}${nanoid(6)}`;
}
