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
  SimpleControl,
  DEFAULT_OPTIONS,
  DEFAULT_CRITERIA,
} from '../types/network';
import { sampleNetwork } from '../utils/sampleNetwork';
import { Backdrop } from '../engine/dxfImport';
import { linkModelLength } from '../utils/geometry';
import {
  loadPersistedNetwork,
  savePersistedNetwork,
  loadPersistedDisplay,
  savePersistedDisplay,
  loadPersistedCad,
  savePersistedCad,
} from './persist';

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

export interface DisplaySettings {
  showNodeLabels: boolean;
  showLinkLabels: boolean;
  showResultValues: boolean;
  showFlowArrows: boolean;
  showGrid: boolean;
  nodeSize: number;
  linkWidth: number;
  widthByDiameter: boolean;
  backgroundColor: string;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  showNodeLabels: true,
  showLinkLabels: false,
  showResultValues: true,
  showFlowArrows: true,
  showGrid: true,
  nodeSize: 8,
  linkWidth: 3,
  widthByDiameter: false,
  backgroundColor: '#f8fafc',
};

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
  /** Historique pour annuler/rétablir. */
  past: Network[];
  future: Network[];
  /** Magnétisme sur grille lors de l'ajout/déplacement des nœuds. */
  snapToGrid: boolean;
  gridSize: number;
  /** Réglages d'affichage de la carte. */
  display: DisplaySettings;
  displayDialogOpen: boolean;
  /** Fond de plan DAO (DXF) importé, ou null. */
  backdrop: Backdrop | null;
  /** Échelle : mètres par unité de dessin (pour les longueurs réelles). */
  metersPerUnit: number;
  /** Calcule automatiquement la longueur des conduites depuis le tracé. */
  autoLength: boolean;
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
  reverseLink: (id: string) => void;
  requestFit: () => void;
  deleteSelection: () => void;
  updateOptions: (patch: Partial<NetworkOptions>) => void;
  updateCriteria: (patch: Partial<ComplianceCriteria>) => void;
  updateMeta: (patch: Partial<Network['meta']>) => void;
  addControl: () => void;
  updateControl: (id: string, patch: Partial<SimpleControl>) => void;
  deleteControl: (id: string) => void;
  setResults: (results: SimulationResults | null) => void;
  setSimStatus: (status: NetworkState['simStatus'], error?: string | null) => void;
  setCurrentTimeIndex: (i: number) => void;
  toggleResultsOverlay: () => void;
  setNodeMetric: (m: ResultMetric) => void;
  setLinkMetric: (m: ResultMetric) => void;
  setColorMode: (m: 'metric' | 'compliance') => void;
  addToProfile: (nodeId: string) => void;
  clearProfile: () => void;
  /** Enregistre l'état courant dans l'historique (avant une modification). */
  commit: () => void;
  undo: () => void;
  redo: () => void;
  toggleSnap: () => void;
  duplicateSelection: () => void;
  updateDisplay: (patch: Partial<DisplaySettings>) => void;
  setDisplayDialogOpen: (open: boolean) => void;
  setBackdrop: (backdrop: Backdrop) => void;
  clearBackdrop: () => void;
  updateBackdrop: (patch: Partial<Pick<Backdrop, 'visible' | 'opacity'>>) => void;
  setMetersPerUnit: (v: number) => void;
  setAutoLength: (on: boolean) => void;
  recomputeLengths: () => void;
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
    controls: [],
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

const HISTORY_LIMIT = 50;

let nodeCounter = 1000;
let linkCounter = 1000;

/** Arrondit une valeur au pas de grille si le magnétisme est actif. */
function snapValue(v: number, size: number, on: boolean): number {
  return on ? Math.round(v / size) * size : v;
}

interface PersistedCad {
  backdrop: Backdrop | null;
  metersPerUnit: number;
  autoLength: boolean;
}
const persistedCad = loadPersistedCad<PersistedCad>();

export const useNetworkStore = create<NetworkState>((set, get) => ({
  network: loadPersistedNetwork() ?? sampleNetwork(),
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
  past: [],
  future: [],
  snapToGrid: false,
  gridSize: 20,
  display: { ...DEFAULT_DISPLAY, ...(loadPersistedDisplay<Partial<DisplaySettings>>() ?? {}) },
  displayDialogOpen: false,
  backdrop: persistedCad?.backdrop ?? null,
  metersPerUnit: persistedCad?.metersPerUnit ?? 1,
  autoLength: persistedCad?.autoLength ?? false,
  fitRequest: 0,

  setTool: (tool) => set({ tool, pendingLink: null }),
  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),
  select: (selection) => set({ selection }),

  addNode: (type, x, y) => {
    get().commit();
    const s0 = get();
    const sx = snapValue(x, s0.gridSize, s0.snapToGrid);
    const sy = snapValue(y, s0.gridSize, s0.snapToGrid);
    const node = defaultNode(type, sx, sy, ++nodeCounter);
    set((s) => {
      node.id = uniqueNodeId(s.network, node.id);
      return {
        network: { ...s.network, nodes: { ...s.network.nodes, [node.id]: node } },
        selection: { kind: 'node', id: node.id },
        results: null,
      };
    });
    return node.id;
  },

  updateNode: (id, patch) =>
    set((s) => {
      const node = s.network.nodes[id];
      if (!node) return s;
      const nodes = { ...s.network.nodes, [id]: { ...node, ...patch } as NetworkNode };
      let links = s.network.links;
      if (s.autoLength && (patch.x !== undefined || patch.y !== undefined)) {
        const tmpNet = { ...s.network, nodes };
        links = { ...s.network.links };
        for (const lid of Object.keys(links)) {
          const lk = links[lid];
          if (lk.type === 'pipe' && (lk.node1 === id || lk.node2 === id)) {
            const len = Math.round(linkModelLength(tmpNet, lk) * s.metersPerUnit * 100) / 100;
            if (len > 0) links[lid] = { ...lk, length: len };
          }
        }
      }
      return { network: { ...s.network, nodes, links } };
    }),

  deleteNode: (id) => {
    get().commit();
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
    });
  },

  startLink: (type, node1) => set({ pendingLink: { type, node1, vertices: [] } }),
  addLinkVertex: (x, y) =>
    set((s) =>
      s.pendingLink
        ? { pendingLink: { ...s.pendingLink, vertices: [...s.pendingLink.vertices, { x, y }] } }
        : s,
    ),

  completeLink: (node2) => {
    if (get().pendingLink) get().commit();
    set((s) => {
      const p = s.pendingLink;
      if (!p || p.node1 === node2) return { pendingLink: null };
      const link = defaultLink(p.type, p.node1, node2, p.vertices, ++linkCounter);
      link.id = uniqueLinkId(s.network, link.id);
      if (s.autoLength && link.type === 'pipe') {
        const len = Math.round(linkModelLength(s.network, link) * s.metersPerUnit * 100) / 100;
        if (len > 0) link.length = len;
      }
      return {
        network: { ...s.network, links: { ...s.network.links, [link.id]: link } },
        pendingLink: null,
        selection: { kind: 'link', id: link.id },
        results: null,
      };
    });
  },

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

  deleteLink: (id) => {
    get().commit();
    set((s) => {
      const links = { ...s.network.links };
      delete links[id];
      return { network: { ...s.network, links }, selection: null, results: null };
    });
  },

  reverseLink: (id) => {
    get().commit();
    set((s) => {
      const link = s.network.links[id];
      if (!link) return s;
      const reversed = {
        ...link,
        node1: link.node2,
        node2: link.node1,
        vertices: link.vertices ? [...link.vertices].reverse() : undefined,
      } as NetworkLink;
      return {
        network: { ...s.network, links: { ...s.network.links, [id]: reversed } },
        results: null,
      };
    });
  },

  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),

  updateDisplay: (patch) => set((s) => ({ display: { ...s.display, ...patch } })),
  setDisplayDialogOpen: (displayDialogOpen) => set({ displayDialogOpen }),

  setBackdrop: (backdrop) =>
    set((s) => ({ backdrop, metersPerUnit: backdrop.metersPerUnit ?? s.metersPerUnit, fitRequest: s.fitRequest + 1 })),
  clearBackdrop: () => set({ backdrop: null }),
  updateBackdrop: (patch) =>
    set((s) => (s.backdrop ? { backdrop: { ...s.backdrop, ...patch } } : s)),
  setMetersPerUnit: (v) => {
    set({ metersPerUnit: v > 0 ? v : 1 });
    if (get().autoLength) get().recomputeLengths();
  },
  setAutoLength: (autoLength) => {
    set({ autoLength });
    if (autoLength) get().recomputeLengths();
  },
  recomputeLengths: () =>
    set((s) => {
      const mpu = s.metersPerUnit;
      const links = { ...s.network.links };
      let changed = false;
      for (const id of Object.keys(links)) {
        const lk = links[id];
        if (lk.type !== 'pipe') continue;
        const len = Math.round(linkModelLength(s.network, lk) * mpu * 100) / 100;
        if (len > 0 && len !== lk.length) {
          links[id] = { ...lk, length: len };
          changed = true;
        }
      }
      return changed ? { network: { ...s.network, links } } : s;
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

  addControl: () => {
    const { network } = get();
    const firstLink = Object.keys(network.links)[0];
    const firstTank = Object.values(network.nodes).find((nd) => nd.type === 'tank');
    if (!firstLink) return;
    get().commit();
    const ctrl: SimpleControl = {
      id: `C${Date.now().toString(36)}`,
      linkId: firstLink,
      setting: 'CLOSED',
      conditionType: firstTank ? 'node-level' : 'time',
      nodeId: firstTank?.id,
      operator: 'above',
      value: firstTank ? (firstTank as { maxLevel?: number }).maxLevel ?? 0 : 6,
    };
    set((s) => ({ network: { ...s.network, controls: [...s.network.controls, ctrl] } }));
  },

  updateControl: (id, patch) =>
    set((s) => ({
      network: {
        ...s.network,
        controls: s.network.controls.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  deleteControl: (id) => {
    get().commit();
    set((s) => ({
      network: { ...s.network, controls: s.network.controls.filter((c) => c.id !== id) },
    }));
  },

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

  commit: () =>
    set((s) => ({ past: [...s.past, s.network].slice(-HISTORY_LIMIT), future: [] })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const previous = s.past[s.past.length - 1];
      return {
        network: previous,
        past: s.past.slice(0, -1),
        future: [s.network, ...s.future].slice(0, HISTORY_LIMIT),
        results: null,
        selection: null,
        simStatus: 'idle',
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return {
        network: next,
        past: [...s.past, s.network].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        results: null,
        selection: null,
        simStatus: 'idle',
      };
    }),

  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  duplicateSelection: () => {
    const { selection, network } = get();
    if (!selection || selection.kind !== 'node') return;
    const node = network.nodes[selection.id];
    if (!node) return;
    get().commit();
    set((s) => {
      const copy = { ...node, id: uniqueNodeId(s.network, `${node.id}_copie`), x: node.x + 30, y: node.y - 30 } as NetworkNode;
      return {
        network: { ...s.network, nodes: { ...s.network.nodes, [copy.id]: copy } },
        selection: { kind: 'node', id: copy.id },
        results: null,
      };
    });
  },

  loadNetwork: (network) =>
    set((s) => ({
      network,
      results: null,
      selection: null,
      currentTimeIndex: 0,
      simStatus: 'idle',
      profilePath: [],
      past: [],
      future: [],
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
      past: [],
      future: [],
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

// --- Sauvegarde automatique dans le navigateur (anti-rebond) ---
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedNetwork = useNetworkStore.getState().network;
useNetworkStore.subscribe((state) => {
  if (state.network === lastSavedNetwork) return;
  lastSavedNetwork = state.network;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savePersistedNetwork(lastSavedNetwork), 600);
});

// --- Persistance des réglages d'affichage ---
let lastDisplay = useNetworkStore.getState().display;
useNetworkStore.subscribe((state) => {
  if (state.display === lastDisplay) return;
  lastDisplay = state.display;
  savePersistedDisplay(lastDisplay);
});

// --- Persistance du fond de plan DAO + échelle (anti-rebond) ---
let cadTimer: ReturnType<typeof setTimeout> | null = null;
let lastCad = {
  backdrop: useNetworkStore.getState().backdrop,
  metersPerUnit: useNetworkStore.getState().metersPerUnit,
  autoLength: useNetworkStore.getState().autoLength,
};
useNetworkStore.subscribe((state) => {
  if (
    state.backdrop === lastCad.backdrop &&
    state.metersPerUnit === lastCad.metersPerUnit &&
    state.autoLength === lastCad.autoLength
  )
    return;
  lastCad = {
    backdrop: state.backdrop,
    metersPerUnit: state.metersPerUnit,
    autoLength: state.autoLength,
  };
  if (cadTimer) clearTimeout(cadTimer);
  cadTimer = setTimeout(() => savePersistedCad(lastCad), 800);
});
