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
  Curve,
  CurveType,
  Pattern,
  DEFAULT_OPTIONS,
  DEFAULT_CRITERIA,
} from '../types/network';
import { sampleNetwork } from '../utils/sampleNetwork';
import { Backdrop } from '../engine/dxfImport';
import { linkModelLength } from '../utils/geometry';
import { getMaterial, getSize, materialRoughness, minBendRadiusMeters } from '../data/pipeCatalog';
import {
  loadPersistedNetwork,
  savePersistedNetwork,
  loadPersistedDisplay,
  savePersistedDisplay,
  loadPersistedCad,
  savePersistedCad,
  loadRecents,
  saveRecents,
} from './persist';

export interface RecentProject {
  id: string;
  name: string;
  savedAt: number;
  network: Network;
}

export type Tool =
  | 'select'
  | 'rectselect'
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
  showLinkValues: boolean;
  showFlowArrows: boolean;
  showGrid: boolean;
  nodeSize: number;
  linkWidth: number;
  widthByDiameter: boolean;
  backgroundColor: string;
  labelSize: number;
  arrowSize: number;
  smoothPipes: boolean;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  showNodeLabels: true,
  showLinkLabels: false,
  showResultValues: true,
  showLinkValues: false,
  showFlowArrows: true,
  showGrid: true,
  nodeSize: 8,
  linkWidth: 3,
  widthByDiameter: false,
  backgroundColor: '#f8fafc',
  labelSize: 12,
  arrowSize: 6,
  smoothPipes: true,
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
  /** Sommets marqués comme coudes pendant le tracé (coin vif). */
  fittings: Record<number, boolean>;
}

interface NetworkState {
  network: Network;
  tool: Tool;
  selection: Selection | null;
  /** Multi-sélection (sélection rectangulaire). */
  selNodes: string[];
  selLinks: string[];
  /** Lien dont on édite les sommets (null = aucun). */
  editingVertexLink: string | null;
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
  /** Tube par défaut appliqué aux nouvelles conduites. */
  defaultPipe: { material: string; dn: number; pn: number };
  /** Accrochage des angles de tronçon (angles de coudes du commerce). */
  angleSnap: boolean;
  snapAngles: number[];
  /** Réglages d'affichage de la carte. */
  display: DisplaySettings;
  displayDialogOpen: boolean;
  /** Fond de plan DAO (DXF) importé, ou null. */
  backdrop: Backdrop | null;
  /** Panneau « Fond de plan » ouvert. */
  backdropPanelOpen: boolean;
  /** Mode « tracé du cadre d'affichage » actif. */
  definingClip: boolean;
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
  setMultiSelection: (nodes: string[], links: string[]) => void;
  clearMultiSelection: () => void;
  deleteMultiSelection: () => void;
  moveNodesBy: (ids: string[], dx: number, dy: number) => void;
  addNode: (type: NodeType, x: number, y: number) => string;
  updateNode: (id: string, patch: Partial<NetworkNode>) => void;
  deleteNode: (id: string) => void;
  startLink: (type: LinkType, node1: string) => void;
  addLinkVertex: (x: number, y: number) => void;
  completeLink: (node2: string) => void;
  cancelPendingLink: () => void;
  setPendingLastFitting: (on: boolean) => void;
  removeLastPendingVertex: () => void;
  updateLink: (id: string, patch: Partial<NetworkLink>) => void;
  deleteLink: (id: string) => void;
  reverseLink: (id: string) => void;
  setEditingVertexLink: (id: string | null) => void;
  updateLinkVertex: (linkId: string, index: number, x: number, y: number) => void;
  insertLinkVertex: (linkId: string, index: number, x: number, y: number) => void;
  deleteLinkVertex: (linkId: string, index: number) => void;
  setPipeFitting: (linkId: string, vertexIndex: number, on: boolean) => void;
  setPipeVertexRadius: (linkId: string, vertexIndex: number, radiusMeters: number) => void;
  setDefaultPipe: (patch: Partial<{ material: string; dn: number; pn: number }>) => void;
  setAngleSnap: (on: boolean) => void;
  setSnapAngles: (angles: number[]) => void;
  requestFit: () => void;
  deleteSelection: () => void;
  updateOptions: (patch: Partial<NetworkOptions>) => void;
  updateCriteria: (patch: Partial<ComplianceCriteria>) => void;
  updateMeta: (patch: Partial<Network['meta']>) => void;
  addControl: () => void;
  updateControl: (id: string, patch: Partial<SimpleControl>) => void;
  deleteControl: (id: string) => void;
  curveDialogOpen: boolean;
  setCurveDialogOpen: (open: boolean) => void;
  dxfDialogOpen: boolean;
  setDxfDialogOpen: (open: boolean) => void;
  simSettingsOpen: boolean;
  setSimSettingsOpen: (open: boolean) => void;
  selectDialogOpen: boolean;
  setSelectDialogOpen: (open: boolean) => void;
  patternDialogOpen: boolean;
  setPatternDialogOpen: (open: boolean) => void;
  addPattern: () => string;
  updatePattern: (id: string, patch: Partial<Pattern>) => void;
  renamePattern: (id: string, newId: string) => void;
  deletePattern: (id: string) => void;
  addCurve: (type: CurveType) => string;
  updateCurve: (id: string, patch: Partial<Curve>) => void;
  renameCurve: (id: string, newId: string) => void;
  deleteCurve: (id: string) => void;
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
  toggleLayer: (name: string) => void;
  setAllLayers: (visible: boolean) => void;
  setBackdropPanelOpen: (open: boolean) => void;
  setDefiningClip: (on: boolean) => void;
  setBackdropClip: (clip: { minX: number; minY: number; maxX: number; maxY: number } | null) => void;
  setMetersPerUnit: (v: number) => void;
  setAutoLength: (on: boolean) => void;
  recomputeLengths: () => void;
  loadNetwork: (network: Network) => void;
  newNetwork: () => void;
  recents: RecentProject[];
  addRecent: (name: string, network: Network) => void;
  loadRecentProject: (id: string) => void;
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
    curves: {},
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
  selNodes: [],
  selLinks: [],
  editingVertexLink: null,
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
  defaultPipe: { material: 'pehd-pe100', dn: 110, pn: 16 },
  angleSnap: false,
  snapAngles: [22.5, 45, 90],
  display: { ...DEFAULT_DISPLAY, ...(loadPersistedDisplay<Partial<DisplaySettings>>() ?? {}) },
  displayDialogOpen: false,
  curveDialogOpen: false,
  dxfDialogOpen: false,
  simSettingsOpen: false,
  selectDialogOpen: false,
  patternDialogOpen: false,
  backdrop: persistedCad?.backdrop?.layers ? persistedCad.backdrop : null,
  backdropPanelOpen: false,
  definingClip: false,
  metersPerUnit: persistedCad?.metersPerUnit ?? 1,
  autoLength: persistedCad?.autoLength ?? false,
  fitRequest: 0,

  setTool: (tool) => set({ tool, pendingLink: null }),
  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),
  select: (selection) => set({ selection, selNodes: [], selLinks: [] }),

  setMultiSelection: (selNodes, selLinks) => set({ selNodes, selLinks, selection: null }),
  clearMultiSelection: () => set({ selNodes: [], selLinks: [] }),

  deleteMultiSelection: () => {
    const { selNodes, selLinks } = get();
    if (selNodes.length === 0 && selLinks.length === 0) return;
    get().commit();
    set((s) => {
      const nodes = { ...s.network.nodes };
      const links = { ...s.network.links };
      for (const id of selLinks) delete links[id];
      for (const id of selNodes) {
        delete nodes[id];
        // supprime aussi les liens rattachés aux nœuds supprimés
        for (const lid of Object.keys(links)) {
          if (links[lid].node1 === id || links[lid].node2 === id) delete links[lid];
        }
      }
      return {
        network: { ...s.network, nodes, links },
        selNodes: [],
        selLinks: [],
        selection: null,
        results: null,
      };
    });
  },

  moveNodesBy: (ids, dx, dy) =>
    set((s) => {
      if (ids.length === 0) return s;
      const idSet = new Set(ids);
      const nodes = { ...s.network.nodes };
      for (const id of ids) {
        const nd = nodes[id];
        if (nd) nodes[id] = { ...nd, x: nd.x + dx, y: nd.y + dy };
      }
      let links = s.network.links;
      if (s.autoLength) {
        const tmpNet = { ...s.network, nodes };
        links = { ...s.network.links };
        for (const lid of Object.keys(links)) {
          const lk = links[lid];
          if (lk.type === 'pipe' && (idSet.has(lk.node1) || idSet.has(lk.node2))) {
            const len = Math.round(linkModelLength(tmpNet, lk) * s.metersPerUnit * 100) / 100;
            if (len > 0) links[lid] = { ...lk, length: len };
          }
        }
      }
      return { network: { ...s.network, nodes, links } };
    }),

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

  startLink: (type, node1) => set({ pendingLink: { type, node1, vertices: [], fittings: {} } }),
  addLinkVertex: (x, y) =>
    set((s) =>
      s.pendingLink
        ? { pendingLink: { ...s.pendingLink, vertices: [...s.pendingLink.vertices, { x, y }] } }
        : s,
    ),

  setPendingLastFitting: (on) =>
    set((s) => {
      const p = s.pendingLink;
      if (!p || p.vertices.length === 0) return s;
      const last = p.vertices.length - 1;
      const fittings = { ...p.fittings };
      if (!on) delete fittings[last];
      else fittings[last] = true;
      return { pendingLink: { ...p, fittings } };
    }),

  removeLastPendingVertex: () =>
    set((s) => {
      const p = s.pendingLink;
      if (!p || p.vertices.length === 0) return s;
      const last = p.vertices.length - 1;
      const fittings = { ...p.fittings };
      delete fittings[last];
      return { pendingLink: { ...p, vertices: p.vertices.slice(0, -1), fittings } };
    }),

  completeLink: (node2) => {
    if (get().pendingLink) get().commit();
    set((s) => {
      const p = s.pendingLink;
      if (!p || p.node1 === node2) return { pendingLink: null };
      const link = defaultLink(p.type, p.node1, node2, p.vertices, ++linkCounter);
      link.id = uniqueLinkId(s.network, link.id);
      if (link.type === 'pipe') {
        const dp = s.defaultPipe;
        const mat = getMaterial(dp.material);
        const size = mat ? getSize(mat, dp.dn, dp.pn) : undefined;
        if (mat && size) {
          link.material = dp.material;
          link.dn = dp.dn;
          link.pn = size.pn;
          link.diameter = size.innerDiameter;
          link.roughness = materialRoughness(mat, s.network.options.headlossFormula);
        }
        // Coudes posés pendant le tracé
        if (Object.keys(p.fittings).length) {
          const f: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(p.fittings)) {
            if (v && Number(k) < (link.vertices?.length ?? 0)) f[k] = true;
          }
          if (Object.keys(f).length) link.fittings = f;
        }
      }
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

  setEditingVertexLink: (editingVertexLink) =>
    set({ editingVertexLink, selection: editingVertexLink ? { kind: 'link', id: editingVertexLink } : null, selNodes: [], selLinks: [] }),

  updateLinkVertex: (linkId, index, x, y) =>
    set((s) => {
      const link = s.network.links[linkId];
      if (!link || !link.vertices || !link.vertices[index]) return s;
      const vertices = link.vertices.map((v, i) => (i === index ? { x, y } : v));
      let updated = { ...link, vertices } as NetworkLink;
      if (s.autoLength && updated.type === 'pipe') {
        const tmp = { ...s.network, links: { ...s.network.links, [linkId]: updated } };
        const len = Math.round(linkModelLength(tmp, updated) * s.metersPerUnit * 100) / 100;
        if (len > 0) updated = { ...updated, length: len };
      }
      return { network: { ...s.network, links: { ...s.network.links, [linkId]: updated } } };
    }),

  insertLinkVertex: (linkId, index, x, y) => {
    get().commit();
    set((s) => {
      const link = s.network.links[linkId];
      if (!link) return s;
      const vertices = [...(link.vertices ?? [])];
      vertices.splice(Math.max(0, Math.min(index, vertices.length)), 0, { x, y });
      let updated = { ...link, vertices } as NetworkLink;
      if (s.autoLength && updated.type === 'pipe') {
        const tmp = { ...s.network, links: { ...s.network.links, [linkId]: updated } };
        const len = Math.round(linkModelLength(tmp, updated) * s.metersPerUnit * 100) / 100;
        if (len > 0) updated = { ...updated, length: len };
      }
      return { network: { ...s.network, links: { ...s.network.links, [linkId]: updated } } };
    });
  },

  setPipeFitting: (linkId, vertexIndex, on) => {
    get().commit();
    set((s) => {
      const link = s.network.links[linkId];
      if (!link || link.type !== 'pipe') return s;
      const fittings = { ...(link.fittings ?? {}) };
      if (!on) delete fittings[vertexIndex];
      else fittings[vertexIndex] = true;
      return {
        network: { ...s.network, links: { ...s.network.links, [linkId]: { ...link, fittings } } },
      };
    });
  },

  setPipeVertexRadius: (linkId, vertexIndex, radiusMeters) =>
    set((s) => {
      const link = s.network.links[linkId];
      if (!link || link.type !== 'pipe') return s;
      const minR = minBendRadiusMeters(link.material, link.dn) ?? 0;
      const r = Math.max(minR, radiusMeters);
      const bendRadii = { ...(link.bendRadii ?? {}), [vertexIndex]: r };
      return {
        network: { ...s.network, links: { ...s.network.links, [linkId]: { ...link, bendRadii } } },
      };
    }),

  setDefaultPipe: (patch) => set((s) => ({ defaultPipe: { ...s.defaultPipe, ...patch } })),
  setAngleSnap: (angleSnap) => set({ angleSnap }),
  setSnapAngles: (snapAngles) => set({ snapAngles }),

  deleteLinkVertex: (linkId, index) => {
    get().commit();
    set((s) => {
      const link = s.network.links[linkId];
      if (!link || !link.vertices) return s;
      const vertices = link.vertices.filter((_, i) => i !== index);
      let updated = { ...link, vertices } as NetworkLink;
      if (s.autoLength && updated.type === 'pipe') {
        const tmp = { ...s.network, links: { ...s.network.links, [linkId]: updated } };
        const len = Math.round(linkModelLength(tmp, updated) * s.metersPerUnit * 100) / 100;
        if (len > 0) updated = { ...updated, length: len };
      }
      return { network: { ...s.network, links: { ...s.network.links, [linkId]: updated } } };
    });
  },

  updateDisplay: (patch) => set((s) => ({ display: { ...s.display, ...patch } })),
  setDisplayDialogOpen: (displayDialogOpen) => set({ displayDialogOpen }),

  setBackdrop: (backdrop) =>
    set((s) => ({
      backdrop,
      backdropPanelOpen: true,
      metersPerUnit: backdrop.metersPerUnit ?? s.metersPerUnit,
      fitRequest: s.fitRequest + 1,
    })),
  clearBackdrop: () => set({ backdrop: null }),
  updateBackdrop: (patch) =>
    set((s) => (s.backdrop ? { backdrop: { ...s.backdrop, ...patch } } : s)),
  toggleLayer: (name) =>
    set((s) =>
      s.backdrop
        ? {
            backdrop: {
              ...s.backdrop,
              layers: s.backdrop.layers.map((l) =>
                l.name === name ? { ...l, visible: !l.visible } : l,
              ),
            },
          }
        : s,
    ),
  setAllLayers: (visible) =>
    set((s) =>
      s.backdrop
        ? { backdrop: { ...s.backdrop, layers: s.backdrop.layers.map((l) => ({ ...l, visible })) } }
        : s,
    ),
  setBackdropPanelOpen: (backdropPanelOpen) => set({ backdropPanelOpen }),
  setDefiningClip: (definingClip) => set({ definingClip }),
  setBackdropClip: (clip) =>
    set((s) =>
      s.backdrop
        ? { backdrop: { ...s.backdrop, clip }, definingClip: false, fitRequest: s.fitRequest + 1 }
        : { definingClip: false },
    ),
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
    set((s) => {
      const options = { ...s.network.options, ...patch };
      let links = s.network.links;
      // Si la formule de perte de charge change, recalcule la rugosité des
      // conduites du catalogue (le C de Hazen-Williams ≠ le n de Manning).
      if (patch.headlossFormula && patch.headlossFormula !== s.network.options.headlossFormula) {
        links = { ...s.network.links };
        for (const id of Object.keys(links)) {
          const lk = links[id];
          if (lk.type === 'pipe' && lk.material) {
            const mat = getMaterial(lk.material);
            if (mat) links[id] = { ...lk, roughness: materialRoughness(mat, patch.headlossFormula) };
          }
        }
      }
      return { network: { ...s.network, options, links }, results: null };
    }),

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

  setCurveDialogOpen: (curveDialogOpen) => set({ curveDialogOpen }),
  setDxfDialogOpen: (dxfDialogOpen) => set({ dxfDialogOpen }),
  setSimSettingsOpen: (simSettingsOpen) => set({ simSettingsOpen }),
  setSelectDialogOpen: (selectDialogOpen) => set({ selectDialogOpen }),
  setPatternDialogOpen: (patternDialogOpen) => set({ patternDialogOpen }),

  addPattern: () => {
    const s = get();
    let i = 1;
    while (s.network.patterns[`P${i}`]) i++;
    const id = `P${i}`;
    // Modulation journalière résidentielle type sur 24 h (coef. horaires).
    const multipliers = [
      0.6, 0.5, 0.45, 0.45, 0.5, 0.7, 1.1, 1.4, 1.5, 1.3, 1.1, 1.0,
      1.0, 0.95, 0.9, 0.95, 1.1, 1.3, 1.45, 1.4, 1.2, 1.0, 0.8, 0.65,
    ];
    get().commit();
    set((st) => ({
      network: {
        ...st.network,
        patterns: { ...st.network.patterns, [id]: { id, multipliers } },
      },
    }));
    return id;
  },

  updatePattern: (id, patch) =>
    set((s) => {
      const p = s.network.patterns[id];
      if (!p) return s;
      return {
        network: {
          ...s.network,
          patterns: { ...s.network.patterns, [id]: { ...p, ...patch } },
        },
      };
    }),

  renamePattern: (id, newId) =>
    set((s) => {
      const p = s.network.patterns[id];
      if (!p || !newId || newId === id || s.network.patterns[newId]) return s;
      const patterns = { ...s.network.patterns };
      delete patterns[id];
      patterns[newId] = { ...p, id: newId };
      // met à jour les références (nœuds + pompes)
      const nodes = { ...s.network.nodes };
      for (const nid of Object.keys(nodes)) {
        const nd = nodes[nid];
        if (nd.type === 'junction' && nd.pattern === id) nodes[nid] = { ...nd, pattern: newId };
      }
      const links = { ...s.network.links };
      for (const lid of Object.keys(links)) {
        const lk = links[lid];
        if (lk.type === 'pump' && (lk.speedPattern === id || lk.pricePattern === id)) {
          links[lid] = {
            ...lk,
            speedPattern: lk.speedPattern === id ? newId : lk.speedPattern,
            pricePattern: lk.pricePattern === id ? newId : lk.pricePattern,
          };
        }
      }
      return { network: { ...s.network, patterns, nodes, links } };
    }),

  deletePattern: (id) => {
    get().commit();
    set((s) => {
      const patterns = { ...s.network.patterns };
      delete patterns[id];
      // nettoie les références
      const nodes = { ...s.network.nodes };
      for (const nid of Object.keys(nodes)) {
        const nd = nodes[nid];
        if (nd.type === 'junction' && nd.pattern === id) nodes[nid] = { ...nd, pattern: undefined };
      }
      const links = { ...s.network.links };
      for (const lid of Object.keys(links)) {
        const lk = links[lid];
        if (lk.type === 'pump' && (lk.speedPattern === id || lk.pricePattern === id)) {
          links[lid] = {
            ...lk,
            speedPattern: lk.speedPattern === id ? undefined : lk.speedPattern,
            pricePattern: lk.pricePattern === id ? undefined : lk.pricePattern,
          };
        }
      }
      return { network: { ...s.network, patterns, nodes, links } };
    });
  },

  addCurve: (type) => {
    const s = get();
    let i = 1;
    while (s.network.curves[`C${i}`]) i++;
    const id = `C${i}`;
    const defaultPts =
      type === 'PUMP'
        ? [{ x: 0, y: 60 }, { x: 50, y: 45 }, { x: 100, y: 0 }]
        : type === 'EFFICIENCY'
          ? [{ x: 0, y: 0 }, { x: 50, y: 75 }, { x: 100, y: 0 }]
          : type === 'VOLUME'
            ? [{ x: 0, y: 0 }, { x: 5, y: 500 }, { x: 10, y: 1000 }]
            : [{ x: 0, y: 0 }, { x: 50, y: 5 }, { x: 100, y: 20 }];
    get().commit();
    set((st) => ({
      network: {
        ...st.network,
        curves: { ...st.network.curves, [id]: { id, type, description: '', points: defaultPts } },
      },
    }));
    return id;
  },

  updateCurve: (id, patch) =>
    set((s) => {
      const c = s.network.curves[id];
      if (!c) return s;
      return { network: { ...s.network, curves: { ...s.network.curves, [id]: { ...c, ...patch } } } };
    }),

  renameCurve: (id, newId) =>
    set((s) => {
      const c = s.network.curves[id];
      if (!c || !newId || newId === id || s.network.curves[newId]) return s;
      const curves = { ...s.network.curves };
      delete curves[id];
      curves[newId] = { ...c, id: newId };
      // met à jour les références
      const links = { ...s.network.links };
      for (const lid of Object.keys(links)) {
        const lk = links[lid];
        if (lk.type === 'pump' && (lk.headCurve === id || lk.efficiencyCurve === id)) {
          links[lid] = {
            ...lk,
            headCurve: lk.headCurve === id ? newId : lk.headCurve,
            efficiencyCurve: lk.efficiencyCurve === id ? newId : lk.efficiencyCurve,
          };
        }
      }
      const nodes = { ...s.network.nodes };
      for (const nid of Object.keys(nodes)) {
        const nd = nodes[nid];
        if (nd.type === 'tank' && nd.volumeCurve === id) nodes[nid] = { ...nd, volumeCurve: newId };
      }
      return { network: { ...s.network, curves, links, nodes } };
    }),

  deleteCurve: (id) => {
    get().commit();
    set((s) => {
      const curves = { ...s.network.curves };
      delete curves[id];
      return { network: { ...s.network, curves } };
    });
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
      selNodes: [],
      selLinks: [],
      editingVertexLink: null,
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
      selNodes: [],
      selLinks: [],
      currentTimeIndex: 0,
      simStatus: 'idle',
      profilePath: [],
      past: [],
      future: [],
      fitRequest: s.fitRequest + 1,
    })),

  recents: loadRecents<RecentProject>(),
  addRecent: (name, network) =>
    set((s) => {
      const entry: RecentProject = {
        id: nanoid(8),
        name: name || 'Projet',
        savedAt: Date.now(),
        network: JSON.parse(JSON.stringify(network)),
      };
      const recents = [entry, ...s.recents.filter((r) => r.name !== entry.name)].slice(0, 8);
      saveRecents(recents);
      return { recents };
    }),
  loadRecentProject: (id) => {
    const r = get().recents.find((x) => x.id === id);
    if (r) get().loadNetwork(r.network);
  },
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
