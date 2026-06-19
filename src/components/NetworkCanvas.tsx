import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { NetworkNode } from '../types/network';
import { colorFor, normalize } from '../utils/colorScale';
import {
  isNodeMetric,
  nodeValue,
  linkValue,
  nodeDomain,
  linkDomain,
} from '../utils/resultsAccess';
import { pressureStatus, velocityStatus, STATUS_COLOR } from '../utils/compliance';
import { roundedPath, bendViolations, effectiveBendRadius, snapDrawPoint, turnAngleDeg, vertexDeflection } from '../utils/pipeGeometry';
import { minBendRadiusMeters } from '../data/pipeCatalog';
import ContextMenu, { MenuItem } from './ContextMenu';

interface Pt {
  x: number;
  y: number;
}

const MOVE_THRESHOLD = 4;

export default function NetworkCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cursorModel, setCursorModel] = useState<Pt | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const network = useNetworkStore((s) => s.network);
  const view = useNetworkStore((s) => s.view);
  const setView = useNetworkStore((s) => s.setView);
  const tool = useNetworkStore((s) => s.tool);
  const setTool = useNetworkStore((s) => s.setTool);
  const selection = useNetworkStore((s) => s.selection);
  const select = useNetworkStore((s) => s.select);
  const selNodes = useNetworkStore((s) => s.selNodes);
  const selLinks = useNetworkStore((s) => s.selLinks);
  const setMultiSelection = useNetworkStore((s) => s.setMultiSelection);
  const clearMultiSelection = useNetworkStore((s) => s.clearMultiSelection);
  const deleteMultiSelection = useNetworkStore((s) => s.deleteMultiSelection);
  const moveNodesBy = useNetworkStore((s) => s.moveNodesBy);
  const addNode = useNetworkStore((s) => s.addNode);
  const updateNode = useNetworkStore((s) => s.updateNode);
  const deleteNode = useNetworkStore((s) => s.deleteNode);
  const deleteLink = useNetworkStore((s) => s.deleteLink);
  const reverseLink = useNetworkStore((s) => s.reverseLink);
  const editingVertexLink = useNetworkStore((s) => s.editingVertexLink);
  const setEditingVertexLink = useNetworkStore((s) => s.setEditingVertexLink);
  const setPipeFitting = useNetworkStore((s) => s.setPipeFitting);
  const setPipeVertexRadius = useNetworkStore((s) => s.setPipeVertexRadius);
  const metersPerUnit = useNetworkStore((s) => s.metersPerUnit);
  const defaultPipe = useNetworkStore((s) => s.defaultPipe);
  const angleSnap = useNetworkStore((s) => s.angleSnap);
  const snapAngles = useNetworkStore((s) => s.snapAngles);
  const updateLinkVertex = useNetworkStore((s) => s.updateLinkVertex);
  const insertLinkVertex = useNetworkStore((s) => s.insertLinkVertex);
  const deleteLinkVertex = useNetworkStore((s) => s.deleteLinkVertex);
  const requestFit = useNetworkStore((s) => s.requestFit);
  const toggleSnap = useNetworkStore((s) => s.toggleSnap);
  const setDisplayDialogOpen = useNetworkStore((s) => s.setDisplayDialogOpen);
  const display = useNetworkStore((s) => s.display);
  const backdrop = useNetworkStore((s) => s.backdrop);
  const definingClip = useNetworkStore((s) => s.definingClip);
  const setBackdropClip = useNetworkStore((s) => s.setBackdropClip);
  const setDefiningClip = useNetworkStore((s) => s.setDefiningClip);
  const startLink = useNetworkStore((s) => s.startLink);
  const addLinkVertex = useNetworkStore((s) => s.addLinkVertex);
  const completeLink = useNetworkStore((s) => s.completeLink);
  const cancelPendingLink = useNetworkStore((s) => s.cancelPendingLink);
  const pendingLink = useNetworkStore((s) => s.pendingLink);
  const setPendingLastFitting = useNetworkStore((s) => s.setPendingLastFitting);
  const removeLastPendingVertex = useNetworkStore((s) => s.removeLastPendingVertex);
  const deleteSelection = useNetworkStore((s) => s.deleteSelection);
  const commit = useNetworkStore((s) => s.commit);
  const undo = useNetworkStore((s) => s.undo);
  const redo = useNetworkStore((s) => s.redo);
  const duplicateSelection = useNetworkStore((s) => s.duplicateSelection);
  const snapToGrid = useNetworkStore((s) => s.snapToGrid);
  const gridSize = useNetworkStore((s) => s.gridSize);
  const results = useNetworkStore((s) => s.results);
  const showOverlay = useNetworkStore((s) => s.showResultsOverlay);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const nodeMetric = useNetworkStore((s) => s.nodeMetric);
  const linkMetric = useNetworkStore((s) => s.linkMetric);
  const colorMode = useNetworkStore((s) => s.colorMode);
  const profilePath = useNetworkStore((s) => s.profilePath);
  const addToProfile = useNetworkStore((s) => s.addToProfile);
  const fitRequest = useNetworkStore((s) => s.fitRequest);

  // Suivi des interactions (souris)
  const interaction = useRef<{
    mode: 'none' | 'pan' | 'dragNode' | 'dragGroup' | 'marquee' | 'clipframe' | 'dragVertex' | 'dragRadius' | 'maybe';
    startScreen: Pt;
    lastScreen: Pt;
    lastModel: Pt;
    nodeId?: string;
    targetKind?: 'node' | 'link';
    targetId?: string;
    vertexIndex?: number;
    radiusCorner?: number;
    moved: boolean;
  }>({ mode: 'none', startScreen: { x: 0, y: 0 }, lastScreen: { x: 0, y: 0 }, lastModel: { x: 0, y: 0 }, moved: false });

  // Redimensionnement
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-cadrage : au premier rendu et à chaque demande (chargement de réseau).
  const fittedReq = useRef(-1);
  useEffect(() => {
    if (fittedReq.current === fitRequest || size.w < 50) return;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const nd of Object.values(network.nodes)) {
      xs.push(nd.x);
      ys.push(nd.y);
    }
    if (backdrop) {
      // Cadre d'affichage prioritaire, sinon bornes « utiles » (aberrants filtrés)
      const bb = backdrop.clip ?? backdrop.contentBounds;
      xs.push(bb.minX, bb.maxX);
      ys.push(bb.minY, bb.maxY);
    }
    if (xs.length === 0) {
      // Réseau vierge : vue centrée par défaut.
      setView({ scale: 1, offsetX: size.w / 2, offsetY: size.h / 2 });
      fittedReq.current = fitRequest;
      return;
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const pad = 80;
    const scale = Math.min((size.w - pad) / w, (size.h - pad) / h, 3);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({
      scale,
      offsetX: size.w / 2 - cx * scale,
      offsetY: size.h / 2 + cy * scale,
    });
    fittedReq.current = fitRequest;
  }, [size, network.nodes, backdrop, setView, fitRequest]);

  const modelToScreen = useCallback(
    (p: Pt): Pt => ({ x: p.x * view.scale + view.offsetX, y: -p.y * view.scale + view.offsetY }),
    [view],
  );
  const screenToModel = useCallback(
    (sx: number, sy: number): Pt => ({
      x: (sx - view.offsetX) / view.scale,
      y: -(sy - view.offsetY) / view.scale,
    }),
    [view],
  );

  const getScreenPoint = useCallback((e: React.PointerEvent | React.WheelEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // Calque de fond DAO (mémoïsé : ne se recalcule qu'au changement de fond)
  const backdropLayer = useMemo(() => {
    if (!backdrop) return null;
    return (
      <>
        {backdrop.layers.map((layer) =>
          layer.visible ? (
            <g key={layer.name}>
              {layer.pathData && (
                <path d={layer.pathData} fill="none" stroke="#475569" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              )}
              {layer.circles.map((c, i) => (
                <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke="#475569" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              {layer.texts.map((t, i) => (
                <text
                  key={`t${i}`}
                  transform={`translate(${t.x} ${t.y}) scale(1 -1) rotate(${-t.rotation})`}
                  fontSize={t.height}
                  fill="#475569"
                  style={{ userSelect: 'none' }}
                >
                  {t.text}
                </text>
              ))}
            </g>
          ) : null,
        )}
      </>
    );
  }, [backdrop]);

  // Domaines de couleur (au temps courant)
  const nDomain = results ? nodeDomain(results, nodeMetric, timeIndex) : null;
  const lDomain = results ? linkDomain(results, linkMetric, timeIndex) : null;
  // Vitesse négligeable -> réseau considéré « sans écoulement » (évite de colorer
  // le bruit numérique et d'afficher de fausses flèches sur un réseau statique).
  const VEL_EPS = 0.01; // m/s (ou ft/s)
  const staticFlow = results ? linkDomain(results, 'velocity', timeIndex).max < VEL_EPS : false;

  // --- Gestion des événements ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // clic droit géré par le menu contextuel
    const sp = getScreenPoint(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    const target = e.target as Element;
    const nodeId = target.getAttribute('data-node');
    const linkId = target.getAttribute('data-link');

    if (definingClip) {
      interaction.current = { mode: 'clipframe', startScreen: sp, lastScreen: sp, lastModel: sp, moved: false };
      setMarquee({ x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y });
      return;
    }

    // Glisser la poignée de rayon de courbure
    const radCorner = target.getAttribute('data-radius');
    if (radCorner !== null && editingVertexLink) {
      interaction.current = {
        mode: 'dragRadius',
        startScreen: sp,
        lastScreen: sp,
        lastModel: sp,
        targetId: editingVertexLink,
        radiusCorner: parseInt(radCorner),
        moved: false,
      };
      commit();
      return;
    }

    // Glisser une poignée de sommet (mode édition des sommets)
    const vtx = target.getAttribute('data-vertex');
    if (vtx !== null && editingVertexLink) {
      interaction.current = {
        mode: 'dragVertex',
        startScreen: sp,
        lastScreen: sp,
        lastModel: screenToModel(sp.x, sp.y),
        targetId: editingVertexLink,
        vertexIndex: parseInt(vtx),
        moved: false,
      };
      commit();
      return;
    }

    if (tool === 'pan' || e.button === 1) {
      interaction.current = { mode: 'pan', startScreen: sp, lastScreen: sp, lastModel: sp, moved: false };
      return;
    }
    interaction.current = {
      mode: 'maybe',
      startScreen: sp,
      lastScreen: sp,
      lastModel: sp,
      moved: false,
      nodeId: nodeId ?? undefined,
      targetKind: nodeId ? 'node' : linkId ? 'link' : undefined,
      targetId: nodeId ?? linkId ?? undefined,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const sp = getScreenPoint(e);
    setCursorModel(screenToModel(sp.x, sp.y));
    const it = interaction.current;
    const dx = sp.x - it.startScreen.x;
    const dy = sp.y - it.startScreen.y;

    if (it.mode === 'maybe' && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      if (tool === 'rectselect') {
        // Sélection rectangulaire
        it.mode = 'marquee';
        setMarquee({ x0: it.startScreen.x, y0: it.startScreen.y, x1: sp.x, y1: sp.y });
      } else if (it.nodeId && tool === 'select') {
        // Déplacement : groupé si le nœud fait partie d'une multi-sélection
        if (selNodes.includes(it.nodeId)) {
          it.mode = 'dragGroup';
          it.lastModel = screenToModel(sp.x, sp.y);
        } else {
          it.mode = 'dragNode';
        }
        commit(); // un seul point d'annulation pour tout le déplacement
      } else {
        it.mode = 'pan';
      }
      it.moved = true;
    }

    if (it.mode === 'pan') {
      const ddx = sp.x - it.lastScreen.x;
      const ddy = sp.y - it.lastScreen.y;
      setView({ offsetX: view.offsetX + ddx, offsetY: view.offsetY + ddy });
      it.lastScreen = sp;
      it.moved = true;
    } else if (it.mode === 'marquee' || it.mode === 'clipframe') {
      setMarquee({ x0: it.startScreen.x, y0: it.startScreen.y, x1: sp.x, y1: sp.y });
      it.moved = true;
    } else if (it.mode === 'dragNode' && it.nodeId) {
      const mp = screenToModel(sp.x, sp.y);
      const nx = snapToGrid ? Math.round(mp.x / gridSize) * gridSize : mp.x;
      const ny = snapToGrid ? Math.round(mp.y / gridSize) * gridSize : mp.y;
      updateNode(it.nodeId, { x: nx, y: ny });
      it.lastScreen = sp;
    } else if (it.mode === 'dragGroup') {
      const mp = screenToModel(sp.x, sp.y);
      moveNodesBy(selNodes, mp.x - it.lastModel.x, mp.y - it.lastModel.y);
      it.lastModel = mp;
      it.lastScreen = sp;
    } else if (it.mode === 'dragVertex' && it.targetId != null && it.vertexIndex != null) {
      const mp = screenToModel(sp.x, sp.y);
      const nx = snapToGrid ? Math.round(mp.x / gridSize) * gridSize : mp.x;
      const ny = snapToGrid ? Math.round(mp.y / gridSize) * gridSize : mp.y;
      updateLinkVertex(it.targetId, it.vertexIndex, nx, ny);
      it.lastScreen = sp;
      it.moved = true;
    } else if (it.mode === 'dragRadius' && it.targetId != null && it.radiusCorner != null) {
      const ci = cornerInfo(it.targetId, it.radiusCorner);
      if (ci) {
        const d = Math.max(4, (sp.x - ci.P.x) * ci.bx + (sp.y - ci.P.y) * ci.by);
        let rm = (d * metersPerUnit) / view.scale;
        // Borne au rayon maximal géométrique du coin (l'arc ne peut pas grandir au-delà)
        rm = Math.min(rm, cornerMaxRadiusModel(it.targetId, it.radiusCorner));
        setPipeVertexRadius(it.targetId, it.radiusCorner - 1, rm);
      }
      it.lastScreen = sp;
      it.moved = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const it = interaction.current;
    svgRef.current?.releasePointerCapture(e.pointerId);

    if (it.mode === 'clipframe') {
      const a = screenToModel(it.startScreen.x, it.startScreen.y);
      const sp = getScreenPoint(e);
      const b = screenToModel(sp.x, sp.y);
      if (it.moved) {
        setBackdropClip({
          minX: Math.min(a.x, b.x),
          maxX: Math.max(a.x, b.x),
          minY: Math.min(a.y, b.y),
          maxY: Math.max(a.y, b.y),
        });
      } else {
        setDefiningClip(false);
      }
      setMarquee(null);
      interaction.current = { ...it, mode: 'none', moved: false };
      return;
    }
    if (it.mode === 'marquee') {
      const a = screenToModel(it.startScreen.x, it.startScreen.y);
      const sp = getScreenPoint(e);
      const b = screenToModel(sp.x, sp.y);
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const nodes: string[] = [];
      for (const nd of Object.values(network.nodes)) {
        if (nd.x >= minX && nd.x <= maxX && nd.y >= minY && nd.y <= maxY) nodes.push(nd.id);
      }
      const nodeSet = new Set(nodes);
      const links: string[] = [];
      for (const lk of Object.values(network.links)) {
        if (nodeSet.has(lk.node1) && nodeSet.has(lk.node2)) links.push(lk.id);
      }
      setMultiSelection(nodes, links);
      setMarquee(null);
    } else if (it.mode === 'maybe' && !it.moved) {
      handleClick(it.targetKind, it.targetId, e);
    }
    interaction.current = { ...it, mode: 'none', moved: false };
  };

  // Accroche le point selon les angles de tronçon autorisés (pendant le tracé)
  const snapPendingCursor = (mpt: Pt): Pt => {
    if (!angleSnap || !pendingLink) return mpt;
    const n1 = network.nodes[pendingLink.node1];
    if (!n1) return mpt;
    const chain: Pt[] = [n1, ...pendingLink.vertices];
    const last = chain[chain.length - 1];
    const prev = chain.length >= 2 ? chain[chain.length - 2] : null;
    return snapDrawPoint(last, prev, mpt, snapAngles);
  };

  const handleClick = (
    targetKind: 'node' | 'link' | undefined,
    targetId: string | undefined,
    e: React.PointerEvent,
  ) => {
    const sp = getScreenPoint(e);
    const mp = screenToModel(sp.x, sp.y);

    // Mode édition des sommets : clic sur la conduite = ajouter un sommet
    if (editingVertexLink) {
      if (targetKind === 'link' && targetId === editingVertexLink) {
        const idx = nearestSegmentIndex(editingVertexLink, mp);
        const vx = snapToGrid ? Math.round(mp.x / gridSize) * gridSize : mp.x;
        const vy = snapToGrid ? Math.round(mp.y / gridSize) * gridSize : mp.y;
        insertLinkVertex(editingVertexLink, idx, vx, vy);
        return;
      }
      // Clic ailleurs : on termine l'édition et on poursuit la sélection normale
      setEditingVertexLink(null);
    }

    // Outils de placement de nœud
    if (tool === 'junction' || tool === 'reservoir' || tool === 'tank') {
      if (!targetId) addNode(tool, mp.x, mp.y);
      return;
    }

    // Outils de tracé de lien
    if (tool === 'pipe' || tool === 'pump' || tool === 'valve') {
      if (targetKind === 'node' && targetId) {
        if (!pendingLink) startLink(tool, targetId);
        else completeLink(targetId);
      } else if (pendingLink) {
        const v = snapPendingCursor(mp);
        addLinkVertex(v.x, v.y);
        // Sous angles normalisés, le sommet posé est un coude (coin vif, pas de rayon)
        if (angleSnap) setPendingLastFitting(true);
      }
      return;
    }

    // Outil profil : ajoute le nœud cliqué au tracé
    if (tool === 'profile') {
      if (targetKind === 'node' && targetId) addToProfile(targetId);
      return;
    }

    // Outil sélection
    if (targetKind && targetId) select({ kind: targetKind, id: targetId });
    else select(null);
  };

  // Index d'insertion (dans le tableau des sommets) du segment le plus proche du clic
  const nearestSegmentIndex = (linkId: string, mp: Pt): number => {
    const link = network.links[linkId];
    if (!link) return 0;
    const a = network.nodes[link.node1];
    const b = network.nodes[link.node2];
    if (!a || !b) return 0;
    const pts = [a, ...(link.vertices ?? []), b];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(mp, pts[i], pts[i + 1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // Point écran + bissectrice (côté arc) d'un coin de conduite
  const cornerInfo = (linkId: string, cornerIdx: number): { P: Pt; bx: number; by: number } | null => {
    const link = network.links[linkId];
    if (!link) return null;
    const n1 = network.nodes[link.node1];
    const n2 = network.nodes[link.node2];
    if (!n1 || !n2) return null;
    const mp = [n1, ...(link.vertices ?? []), n2];
    if (cornerIdx < 1 || cornerIdx > mp.length - 2) return null;
    const P = modelToScreen(mp[cornerIdx]);
    const A = modelToScreen(mp[cornerIdx - 1]);
    const B = modelToScreen(mp[cornerIdx + 1]);
    let u1x = P.x - A.x;
    let u1y = P.y - A.y;
    const l1 = Math.hypot(u1x, u1y) || 1;
    u1x /= l1;
    u1y /= l1;
    let u2x = B.x - P.x;
    let u2y = B.y - P.y;
    const l2 = Math.hypot(u2x, u2y) || 1;
    u2x /= l2;
    u2y /= l2;
    let bx = -u1x + u2x;
    let by = -u1y + u2y;
    const bl = Math.hypot(bx, by) || 1;
    return { P, bx: bx / bl, by: by / bl };
  };

  // Rayon de courbure maximal géométriquement possible à un coin (unités modèle)
  const cornerMaxRadiusModel = (linkId: string, cornerIdx: number): number => {
    const link = network.links[linkId];
    if (!link) return Infinity;
    const n1 = network.nodes[link.node1];
    const n2 = network.nodes[link.node2];
    if (!n1 || !n2) return Infinity;
    const mp = [n1, ...(link.vertices ?? []), n2];
    if (cornerIdx < 1 || cornerIdx > mp.length - 2) return Infinity;
    const A = mp[cornerIdx - 1];
    const P = mp[cornerIdx];
    const B = mp[cornerIdx + 1];
    const l1 = Math.hypot(P.x - A.x, P.y - A.y);
    const l2 = Math.hypot(B.x - P.x, B.y - P.y);
    const u1x = (P.x - A.x) / (l1 || 1);
    const u1y = (P.y - A.y) / (l1 || 1);
    const u2x = (B.x - P.x) / (l2 || 1);
    const u2y = (B.y - P.y) / (l2 || 1);
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
    const delta = Math.acos(dot);
    if (delta < 0.02) return Infinity;
    const tanMax = Math.min(l1, l2) * 0.5;
    return tanMax / Math.tan(delta / 2);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const sp = getScreenPoint(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.max(0.001, Math.min(100000, view.scale * factor));
    // Zoom centré sur le curseur
    const mp = screenToModel(sp.x, sp.y);
    setView({
      scale: newScale,
      offsetX: sp.x - mp.x * newScale,
      offsetY: sp.y + mp.y * newScale,
    });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as Element;
    const nodeId = target.getAttribute('data-node');
    const linkId = target.getAttribute('data-link');
    const vtx = target.getAttribute('data-vertex');
    const rect = svgRef.current!.getBoundingClientRect();
    const mp = screenToModel(e.clientX - rect.left, e.clientY - rect.top);

    let items: MenuItem[];
    // Menu pendant le tracé d'une conduite
    if (pendingLink) {
      const hasV = pendingLink.vertices.length > 0;
      items = [];
      if (pendingLink.type === 'pipe' && hasV) {
        const last = pendingLink.vertices.length - 1;
        const cur = !!pendingLink.fittings[last];
        items.push(
          { label: `Dernier sommet : coude (coin vif)${cur ? ' ✓' : ''}`, icon: '⌐', onClick: () => setPendingLastFitting(true) },
          { label: `Dernier sommet : courbure (rayon)${!cur ? ' ✓' : ''}`, onClick: () => setPendingLastFitting(false) },
          { type: 'separator' },
        );
      }
      if (hasV) items.push({ label: 'Annuler le dernier sommet', icon: '↶', onClick: removeLastPendingVertex });
      items.push({ label: 'Annuler le tracé', icon: '✕', danger: true, onClick: cancelPendingLink });
      setMenu({ x: e.clientX, y: e.clientY, items });
      return;
    }
    if (vtx !== null && editingVertexLink) {
      const idx = parseInt(vtx);
      const lk = network.links[editingVertexLink];
      items = [];
      if (lk?.type === 'pipe') {
        const isElbow = !!lk.fittings?.[idx];
        items.push(
          isElbow
            ? { label: 'Retirer le coude (courbure)', icon: '⌐', onClick: () => setPipeFitting(editingVertexLink, idx, false) }
            : { label: 'Poser un coude (coin vif)', icon: '⌐', onClick: () => setPipeFitting(editingVertexLink, idx, true) },
          { type: 'separator' },
        );
      }
      items.push(
        { label: 'Supprimer ce sommet', icon: '🗑', danger: true, onClick: () => deleteLinkVertex(editingVertexLink, idx) },
        { type: 'separator' },
        { label: 'Terminer l’édition', icon: '✓', onClick: () => setEditingVertexLink(null) },
      );
    } else if (nodeId) {
      select({ kind: 'node', id: nodeId });
      items = [
        { label: 'Démarrer une conduite', icon: '╱', onClick: () => { setTool('pipe'); startLink('pipe', nodeId); } },
        { label: 'Ajouter au profil', icon: '⛰', onClick: () => addToProfile(nodeId) },
        { type: 'separator' },
        { label: 'Dupliquer', icon: '⧉', onClick: () => { select({ kind: 'node', id: nodeId }); duplicateSelection(); } },
        { label: 'Supprimer', icon: '🗑', danger: true, onClick: () => deleteNode(nodeId) },
      ];
    } else if (linkId) {
      select({ kind: 'link', id: linkId });
      items = [
        { label: 'Éditer les sommets', icon: '⋲', onClick: () => setEditingVertexLink(linkId) },
        { label: 'Inverser le sens', icon: '⇄', onClick: () => reverseLink(linkId) },
        { type: 'separator' },
        { label: 'Supprimer', icon: '🗑', danger: true, onClick: () => deleteLink(linkId) },
      ];
    } else {
      select(null);
      items = [
        { label: 'Ajouter un nœud ici', icon: '●', onClick: () => addNode('junction', mp.x, mp.y) },
        { label: 'Ajouter une bâche / source ici', icon: '▭', onClick: () => addNode('reservoir', mp.x, mp.y) },
        { label: 'Ajouter un réservoir ici', icon: '◻', onClick: () => addNode('tank', mp.x, mp.y) },
        { type: 'separator' },
        { label: snapToGrid ? 'Désactiver le magnétisme' : 'Activer le magnétisme', icon: '▦', onClick: toggleSnap },
        { label: 'Recadrer la vue', icon: '⊡', onClick: requestFit },
        { type: 'separator' },
        { label: 'Options d’affichage…', icon: '⚙', onClick: () => setDisplayDialogOpen(true) },
      ];
    }
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (ctrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (ctrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (typing) return;
      if (e.key === 'Escape') {
        cancelPendingLink();
        clearMultiSelection();
        if (useNetworkStore.getState().definingClip) setDefiningClip(false);
        if (useNetworkStore.getState().editingVertexLink) setEditingVertexLink(null);
        // revient toujours sur l'outil Sélection
        if (useNetworkStore.getState().tool !== 'select') setTool('select');
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (useNetworkStore.getState().selNodes.length || useNetworkStore.getState().selLinks.length)
          deleteMultiSelection();
        else deleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelPendingLink, deleteSelection, deleteMultiSelection, clearMultiSelection, setDefiningClip, setEditingVertexLink, setTool, undo, redo, duplicateSelection]);

  // --- Rendu ---
  const renderLink = (linkId: string) => {
    const link = network.links[linkId];
    const a = network.nodes[link.node1];
    const b = network.nodes[link.node2];
    if (!a || !b) return null;
    const pts: Pt[] = [modelToScreen(a), ...(link.vertices ?? []).map(modelToScreen), modelToScreen(b)];
    const midScreen = {
      x: (pts[0].x + pts[pts.length - 1].x) / 2,
      y: (pts[0].y + pts[pts.length - 1].y) / 2,
    };

    // Tracé : arcs (rayon de courbure) pour les conduites, coudes anguleux
    const fittings = link.type === 'pipe' ? (link.fittings ?? {}) : {};
    const minRm = link.type === 'pipe' ? minBendRadiusMeters(link.material, link.dn) : null;
    let path: string;
    let violations: number[] = [];
    if (display.smoothPipes && link.type === 'pipe' && minRm != null && (link.vertices?.length ?? 0) > 0) {
      const pipe = link;
      path = roundedPath(
        pts,
        (vi) => (effectiveBendRadius(pipe, vi, minRm!) / metersPerUnit) * view.scale,
        (vi) => !!fittings[vi],
      );
      const modelPts = [a, ...(link.vertices ?? []), b];
      violations = bendViolations(modelPts, minRm / metersPerUnit, (vi) => !!fittings[vi]);
    } else {
      path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    }
    const interiorScreen = pts.slice(1, -1);

    let stroke = '#5b6b7c';
    let width = display.linkWidth;
    if (display.widthByDiameter && link.type === 'pipe') {
      width = Math.max(1.5, Math.min(10, link.diameter / 50));
    }
    let flowVal: number | undefined;
    let velAbs = 0;
    let linkText: string | null = null;
    if (results && showOverlay) {
      flowVal = linkValue(results, linkId, 'flow', timeIndex);
      velAbs = Math.abs(linkValue(results, linkId, 'velocity', timeIndex) ?? 0);
      if (colorMode === 'compliance' && link.type === 'pipe') {
        const v = linkValue(results, linkId, 'velocity', timeIndex);
        stroke = STATUS_COLOR[velocityStatus(v, network.criteria)];
      } else if (lDomain && !isNodeMetric(linkMetric)) {
        const v = linkValue(results, linkId, linkMetric, timeIndex);
        if (v != null && isFinite(v)) {
          // réseau sans écoulement -> bas de l'échelle (bleu), sinon normalisation
          stroke = colorFor(staticFlow ? 0 : normalize(Math.abs(v), lDomain));
        }
      }
      if (display.showLinkValues) {
        const metric = colorMode === 'compliance' ? 'velocity' : isNodeMetric(linkMetric) ? 'flow' : linkMetric;
        const v = linkValue(results, linkId, metric, timeIndex);
        if (v != null && isFinite(v)) linkText = v.toFixed(2);
      }
    }
    const isSel = (selection?.kind === 'link' && selection.id === linkId) || selLinks.includes(linkId);

    return (
      <g key={linkId}>
        {/* Zone de clic élargie (invisible) */}
        <path d={path} stroke="transparent" strokeWidth={14} fill="none" data-link={linkId} style={{ cursor: 'pointer' }} />
        <path
          d={path}
          stroke={isSel ? '#1d4ed8' : stroke}
          strokeWidth={isSel ? width + 2 : width}
          fill="none"
          data-link={linkId}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Flèche de sens d'écoulement (seulement si écoulement réel, pas du bruit) */}
        {results && showOverlay && display.showFlowArrows && flowVal != null &&
          (velAbs >= VEL_EPS || (link.type !== 'pipe' && Math.abs(flowVal) > 1e-3)) && (
          <FlowArrow pts={pts} reversed={flowVal < 0} size={display.arrowSize} />
        )}
        {/* Symbole de pompe / vanne */}
        {link.type === 'pump' && <LinkSymbol type="pump" at={midScreen} selected={isSel} />}
        {link.type === 'valve' && <LinkSymbol type="valve" at={midScreen} selected={isSel} />}
        {/* Étiquette de lien */}
        {display.showLinkLabels && (
          <text x={midScreen.x + 6} y={midScreen.y - 6} fontSize={display.labelSize * 0.92} fill="#6b7280" style={{ userSelect: 'none' }}>
            {link.id}
          </text>
        )}
        {/* Valeur du résultat sur la conduite */}
        {linkText && (
          <text
            x={midScreen.x + 6}
            y={midScreen.y + display.labelSize}
            fontSize={display.labelSize * 0.92}
            fontWeight={600}
            fill="#0f172a"
            paintOrder="stroke"
            stroke="#ffffff"
            strokeWidth={3}
            style={{ userSelect: 'none' }}
          >
            {linkText}
          </text>
        )}
        {/* Marqueurs de coude (angle réel) */}
        {Object.entries(fittings).map(([vi, on]) => {
          if (!on) return null;
          const sp = interiorScreen[Number(vi)];
          if (!sp) return null;
          const ang = link.type === 'pipe' ? vertexDeflection(network, link, Number(vi)) : null;
          return (
            <g key={`f${vi}`}>
              <rect x={sp.x - 5} y={sp.y - 5} width={10} height={10} rx={2} transform={`rotate(45 ${sp.x} ${sp.y})`} fill="#fde68a" stroke="#b45309" strokeWidth={1.4} />
              <text x={sp.x} y={sp.y - 8} fontSize={9} fontWeight={700} textAnchor="middle" fill="#b45309" style={{ userSelect: 'none' }}>
                {ang != null ? `${ang.toFixed(ang % 1 ? 1 : 0)}°` : '⌐'}
              </text>
            </g>
          );
        })}
        {/* Alerte rayon de courbure non respecté */}
        {violations.map((vi) => {
          const sp = interiorScreen[vi];
          if (!sp) return null;
          return (
            <g key={`v${vi}`}>
              <circle cx={sp.x} cy={sp.y} r={7} fill="none" stroke="#dc2626" strokeWidth={2} />
              <text x={sp.x} y={sp.y + 3.5} fontSize={10} fontWeight={800} textAnchor="middle" fill="#dc2626" style={{ userSelect: 'none' }}>
                !
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const renderNode = (node: NetworkNode) => {
    const NODE_R = display.nodeSize;
    const p = modelToScreen(node);
    const isSel = (selection?.kind === 'node' && selection.id === node.id) || selNodes.includes(node.id);
    let fill = nodeFill(node.type);
    let resultText: string | null = null;
    if (results && showOverlay) {
      if (colorMode === 'compliance') {
        if (node.type === 'junction') {
          const v = nodeValue(results, node.id, 'pressure', timeIndex);
          fill = STATUS_COLOR[pressureStatus(v, network.criteria)];
          if (v != null && isFinite(v)) resultText = v.toFixed(1);
        }
      } else if (nDomain && isNodeMetric(nodeMetric)) {
        const v = nodeValue(results, node.id, nodeMetric, timeIndex);
        if (v != null && isFinite(v)) {
          fill = colorFor(normalize(v, nDomain));
          resultText = v.toFixed(1);
        }
      }
    }
    const stroke = isSel ? '#1d4ed8' : '#1f2937';
    const sw = isSel ? 3 : 1.5;

    return (
      <g
        key={node.id}
        data-node={node.id}
        style={{ cursor: tool === 'select' ? 'move' : 'pointer' }}
      >
        {node.type === 'junction' && (
          <circle cx={p.x} cy={p.y} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={sw} data-node={node.id} />
        )}
        {/* Bâche à eau / source : bassin (trapèze ouvert vers le haut) */}
        {node.type === 'reservoir' && (
          <polygon
            points={`${p.x - NODE_R - 3},${p.y - NODE_R} ${p.x + NODE_R + 3},${p.y - NODE_R} ${p.x + NODE_R - 1},${p.y + NODE_R} ${p.x - NODE_R + 1},${p.y + NODE_R}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
            data-node={node.id}
          />
        )}
        {/* Réservoir de stockage : cuve surélevée (pieds + base) */}
        {node.type === 'tank' && (
          <g data-node={node.id}>
            <rect
              x={p.x - NODE_R - 1}
              y={p.y - NODE_R - 4}
              width={NODE_R * 2 + 2}
              height={NODE_R + 3}
              rx={1.5}
              fill={fill}
              stroke={stroke}
              strokeWidth={sw}
              data-node={node.id}
            />
            <path
              d={`M${p.x - NODE_R * 0.45},${p.y - 1} V${p.y + NODE_R + 2} M${p.x + NODE_R * 0.45},${p.y - 1} V${p.y + NODE_R + 2} M${p.x - NODE_R * 0.7},${p.y + NODE_R + 2} H${p.x + NODE_R * 0.7}`}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              data-node={node.id}
            />
          </g>
        )}
        {display.showNodeLabels && (
          <text x={p.x + NODE_R + 3} y={p.y - NODE_R} fontSize={display.labelSize} fill="#374151" style={{ userSelect: 'none' }}>
            {node.id}
          </text>
        )}
        {resultText && display.showResultValues && (
          <text x={p.x} y={p.y + NODE_R + display.labelSize + 2} fontSize={display.labelSize * 0.92} fontWeight={600} fill="#111827" textAnchor="middle" style={{ userSelect: 'none' }}>
            {resultText}
          </text>
        )}
      </g>
    );
  };

  // Surbrillance du tracé de profil
  const renderProfilePath = () => {
    if (profilePath.length < 1) return null;
    const pts = profilePath.map((id) => network.nodes[id]).filter(Boolean).map(modelToScreen);
    if (pts.length === 0) return null;
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    return (
      <g className="profile-path">
        {pts.length > 1 && (
          <path d={path} stroke="#7c3aed" strokeWidth={5} fill="none" opacity={0.55} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={11} fill="#7c3aed" opacity={0.9} />
            <text x={p.x} y={p.y + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="#fff">
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    );
  };

  // Poignées des sommets (mode édition)
  const renderVertexHandles = () => {
    if (!editingVertexLink) return null;
    const link = network.links[editingVertexLink];
    if (!link || !link.vertices) return null;

    // Une poignée de rayon par coin non-coude (réglable séparément)
    let radiusHandles: React.ReactNode = null;
    if (link.type === 'pipe') {
      const minRm = minBendRadiusMeters(link.material, link.dn);
      if (minRm != null && link.vertices) {
        const pipe = link;
        radiusHandles = link.vertices.map((_, vi) => {
          if (pipe.fittings?.[vi]) return null; // pas de rayon sur un coude
          const corner = vi + 1;
          const ci = cornerInfo(editingVertexLink, corner);
          if (!ci) return null;
          const effRm = effectiveBendRadius(pipe, vi, minRm);
          const screenR = (effRm / metersPerUnit) * view.scale;
          const d = Math.max(18, screenR);
          const hx = ci.P.x + ci.bx * d;
          const hy = ci.P.y + ci.by * d;
          return (
            <g key={`r${vi}`}>
              <line x1={ci.P.x} y1={ci.P.y} x2={hx} y2={hy} stroke="#0d9488" strokeWidth={1.2} strokeDasharray="3 3" />
              <circle cx={hx} cy={hy} r={6} fill="#ccfbf1" stroke="#0d9488" strokeWidth={2} data-radius={corner} style={{ cursor: 'ns-resize' }} />
              <text x={hx + 9} y={hy + 4} fontSize={10} fontWeight={600} fill="#0d9488" paintOrder="stroke" stroke="#fff" strokeWidth={3} style={{ userSelect: 'none' }}>
                R {effRm.toFixed(2)} m
              </text>
            </g>
          );
        });
      }
    }

    return (
      <g>
        {radiusHandles}
        {link.vertices.map((v, i) => {
          const p = modelToScreen(v);
          return (
            <rect
              key={i}
              x={p.x - 5}
              y={p.y - 5}
              width={10}
              height={10}
              rx={2}
              fill="#ffffff"
              stroke="#7c3aed"
              strokeWidth={2}
              data-vertex={i}
              style={{ cursor: 'move' }}
            />
          );
        })}
      </g>
    );
  };

  // Tracé en cours (rubber-band) avec aperçu du rayon de courbure
  const renderPending = () => {
    if (!pendingLink || !cursorModel) return null;
    const a = network.nodes[pendingLink.node1];
    if (!a) return null;
    const snapCursor = snapPendingCursor(cursorModel);
    const modelPts = [a, ...pendingLink.vertices, snapCursor];
    const pts = modelPts.map(modelToScreen);
    // Angle du tronçon en cours (par rapport au précédent)
    const chain = [a, ...pendingLink.vertices];
    const lastPt = chain[chain.length - 1];
    const prevPt = chain.length >= 2 ? chain[chain.length - 2] : null;
    const segAngle = turnAngleDeg(lastPt, prevPt, snapCursor);
    const pendFit = pendingLink.fittings;
    const isSharp = (vi: number) => !!pendFit[vi];
    const minRm = pendingLink.type === 'pipe' ? minBendRadiusMeters(defaultPipe.material, defaultPipe.dn) : null;
    let path: string;
    let violations: number[] = [];
    if (display.smoothPipes && minRm != null) {
      const screenR = (minRm / metersPerUnit) * view.scale;
      path = roundedPath(pts, () => screenR, isSharp);
      violations = bendViolations(modelPts, minRm / metersPerUnit, isSharp);
    } else {
      path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    }
    const tip = pts[pts.length - 1];
    return (
      <g>
        <path d={path} stroke="#1d4ed8" strokeWidth={2} strokeDasharray="6 4" fill="none" />
        {minRm != null && (
          <text x={tip.x + 12} y={tip.y - 8} fontSize={11} fontWeight={600} fill={violations.length ? '#dc2626' : '#1d4ed8'} paintOrder="stroke" stroke="#fff" strokeWidth={3} style={{ userSelect: 'none' }}>
            DN{defaultPipe.dn}
            {segAngle != null && ` · angle ${segAngle.toFixed(segAngle % 1 ? 1 : 0)}°`}
            {violations.length ? ' ⚠ trop serré' : ''}
          </text>
        )}
        {/* Coudes posés à la volée (angle en direct) */}
        {Object.entries(pendFit).map(([vi, on]) => {
          if (!on) return null;
          const k = Number(vi);
          const sp = pts[k + 1];
          if (!sp) return null;
          const ang = turnAngleDeg(modelPts[k + 1], modelPts[k], modelPts[k + 2]);
          return (
            <g key={`pf${vi}`}>
              <rect x={sp.x - 5} y={sp.y - 5} width={10} height={10} rx={2} transform={`rotate(45 ${sp.x} ${sp.y})`} fill="#fde68a" stroke="#b45309" strokeWidth={1.4} />
              <text x={sp.x} y={sp.y - 8} fontSize={9} fontWeight={700} textAnchor="middle" fill="#b45309" style={{ userSelect: 'none' }}>
                {ang != null ? `${ang.toFixed(ang % 1 ? 1 : 0)}°` : '⌐'}
              </text>
            </g>
          );
        })}
        {violations.map((vi) => {
          const sp = pts[vi + 1];
          return <circle key={vi} cx={sp.x} cy={sp.y} r={7} fill="none" stroke="#dc2626" strokeWidth={2} />;
        })}
      </g>
    );
  };

  return (
    <>
      <svg
        ref={svgRef}
        className="network-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        style={{ touchAction: 'none', cursor: definingClip ? 'crosshair' : undefined }}
      >
        <rect x={0} y={0} width={size.w} height={size.h} fill="transparent" />
        {backdrop && backdrop.visible && (
          <g
            transform={`translate(${view.offsetX} ${view.offsetY}) scale(${view.scale} ${-view.scale})`}
            opacity={backdrop.opacity}
            style={{ pointerEvents: 'none' }}
          >
            {backdrop.clip ? (
              <>
                <defs>
                  <clipPath id="bdclip" clipPathUnits="userSpaceOnUse">
                    <rect
                      x={backdrop.clip.minX}
                      y={backdrop.clip.minY}
                      width={backdrop.clip.maxX - backdrop.clip.minX}
                      height={backdrop.clip.maxY - backdrop.clip.minY}
                    />
                  </clipPath>
                </defs>
                <g clipPath="url(#bdclip)">{backdropLayer}</g>
                <rect
                  x={backdrop.clip.minX}
                  y={backdrop.clip.minY}
                  width={backdrop.clip.maxX - backdrop.clip.minX}
                  height={backdrop.clip.maxY - backdrop.clip.minY}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={1.4}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : (
              backdropLayer
            )}
          </g>
        )}
        <g>{Object.keys(network.links).map(renderLink)}</g>
        {renderProfilePath()}
        {renderPending()}
        <g>{Object.values(network.nodes).map(renderNode)}</g>
        {renderVertexHandles()}
        {marquee && (
          <rect
            x={Math.min(marquee.x0, marquee.x1)}
            y={Math.min(marquee.y0, marquee.y1)}
            width={Math.abs(marquee.x1 - marquee.x0)}
            height={Math.abs(marquee.y1 - marquee.y0)}
            fill="rgba(29,78,216,0.08)"
            stroke="#1d4ed8"
            strokeWidth={1}
            strokeDasharray="4 3"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
      {definingClip && (
        <div className="clip-banner">
          Tracez un rectangle pour délimiter la zone du plan à afficher · <kbd>Échap</kbd> pour annuler
        </div>
      )}
      {editingVertexLink && (
        <div className="clip-banner">
          Édition des sommets de {editingVertexLink} : glissez les poignées · cliquez la conduite pour
          ajouter · clic droit sur une poignée pour supprimer · <kbd>Échap</kbd> pour terminer
        </div>
      )}
    </>
  );
}

function nodeFill(type: NetworkNode['type']): string {
  switch (type) {
    case 'junction':
      return '#9ca3af';
    case 'reservoir':
      return '#0d9488';
    case 'tank':
      return '#0891b2';
  }
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function FlowArrow({ pts, reversed, size = 6 }: { pts: Pt[]; reversed: boolean; size?: number }) {
  // Flèche au milieu du segment central
  const i = Math.max(1, Math.floor(pts.length / 2));
  const p0 = pts[i - 1];
  const p1 = pts[i];
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  let ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  if (reversed) ang += Math.PI;
  const s = size;
  const tip = { x: mx + Math.cos(ang) * s, y: my + Math.sin(ang) * s };
  const left = { x: mx + Math.cos(ang + 2.4) * s, y: my + Math.sin(ang + 2.4) * s };
  const right = { x: mx + Math.cos(ang - 2.4) * s, y: my + Math.sin(ang - 2.4) * s };
  return <polygon points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`} fill="#0f172a" opacity={0.7} />;
}

function LinkSymbol({ type, at, selected }: { type: 'pump' | 'valve'; at: Pt; selected: boolean }) {
  const stroke = selected ? '#1d4ed8' : '#0f172a';
  if (type === 'pump') {
    return (
      <g>
        <circle cx={at.x} cy={at.y} r={7} fill="#fef3c7" stroke={stroke} strokeWidth={1.5} />
        <text x={at.x} y={at.y + 3} fontSize={9} fontWeight={700} textAnchor="middle" fill={stroke}>
          P
        </text>
      </g>
    );
  }
  return (
    <polygon
      points={`${at.x - 7},${at.y - 6} ${at.x + 7},${at.y - 6} ${at.x - 7},${at.y + 6} ${at.x + 7},${at.y + 6}`}
      fill="#fde68a"
      stroke={stroke}
      strokeWidth={1.5}
    />
  );
}
