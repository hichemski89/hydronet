import { useRef, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { runSimulation, validateNetwork } from '../engine/epanetRunner';
import { buildInp } from '../engine/inpBuilder';
import { parseInp } from '../engine/inpParser';
import { saveProjectFile, parseProjectFile, readFileAsText } from '../engine/projectIO';
import { generateReport } from '../report/reportGenerator';
import { captureCanvasPng } from '../utils/svgCapture';
import { FlowUnit, HeadlossFormula } from '../types/network';
import { FLOW_UNIT_LABELS } from '../utils/format';
import ContextMenu, { MenuItem } from './ContextMenu';
import {
  OpenIcon,
  UndoIcon,
  RedoIcon,
  GridIcon,
  PlayIcon,
  PdfIcon,
  ExportIcon,
  PlanIcon,
} from './Icons';

function relTime(ts: number): string {
  const d = Math.max(0, Date.now() - ts);
  const min = Math.round(d / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

const FLOW_UNITS: FlowUnit[] = ['LPS', 'LPM', 'CMH', 'CMD', 'MLD', 'GPM', 'CFS'];
const HEADLOSS: { id: HeadlossFormula; label: string }[] = [
  { id: 'H-W', label: 'Hazen-Williams' },
  { id: 'D-W', label: 'Darcy-Weisbach' },
  { id: 'C-M', label: 'Chezy-Manning' },
];

export default function Toolbar() {
  const network = useNetworkStore((s) => s.network);
  const updateMeta = useNetworkStore((s) => s.updateMeta);
  const updateOptions = useNetworkStore((s) => s.updateOptions);
  const setResults = useNetworkStore((s) => s.setResults);
  const setSimStatus = useNetworkStore((s) => s.setSimStatus);
  const simStatus = useNetworkStore((s) => s.simStatus);
  const results = useNetworkStore((s) => s.results);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const newNetwork = useNetworkStore((s) => s.newNetwork);
  const loadNetwork = useNetworkStore((s) => s.loadNetwork);
  const recents = useNetworkStore((s) => s.recents);
  const addRecent = useNetworkStore((s) => s.addRecent);
  const loadRecentProject = useNetworkStore((s) => s.loadRecentProject);
  const setBackdropPanelOpen = useNetworkStore((s) => s.setBackdropPanelOpen);
  const setCurveDialogOpen = useNetworkStore((s) => s.setCurveDialogOpen);
  const setDxfDialogOpen = useNetworkStore((s) => s.setDxfDialogOpen);
  const undo = useNetworkStore((s) => s.undo);
  const redo = useNetworkStore((s) => s.redo);
  const canUndo = useNetworkStore((s) => s.past.length > 0);
  const canRedo = useNetworkStore((s) => s.future.length > 0);
  const snapToGrid = useNetworkStore((s) => s.snapToGrid);
  const toggleSnap = useNetworkStore((s) => s.toggleSnap);
  const [busy, setBusy] = useState(false);
  const [fileMenu, setFileMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter le même fichier
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const lower = file.name.toLowerCase();
      const net = lower.endsWith('.inp')
        ? parseInp(text, file.name.replace(/\.inp$/i, ''))
        : parseProjectFile(text);
      loadNetwork(net);
      addRecent(net.meta.name || file.name.replace(/\.[^.]+$/, ''), net);
    } catch (err) {
      alert('Impossible d’ouvrir le fichier : ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const onSave = () => {
    saveProjectFile(network);
    addRecent(network.meta.name || 'Projet', network);
  };

  const onSaveAs = () => {
    const name = window.prompt('Enregistrer sous — nom du projet :', network.meta.name || 'reseau');
    if (name == null) return;
    const trimmed = name.trim() || 'reseau';
    updateMeta({ name: trimmed });
    const net = { ...network, meta: { ...network.meta, name: trimmed } };
    saveProjectFile(net);
    addRecent(trimmed, net);
  };

  const openFileMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFileMenu({ x: r.left, y: r.bottom + 4 });
  };

  const fileMenuItems: MenuItem[] = [
    { label: 'Nouveau', icon: '📄', onClick: newNetwork },
    { label: 'Ouvrir…', icon: '📂', onClick: () => fileInput.current?.click() },
    { type: 'separator' },
    { label: 'Enregistrer', icon: '💾', onClick: onSave },
    { label: 'Enregistrer sous…', icon: '🏷️', onClick: onSaveAs },
    { type: 'separator' },
    { type: 'header', label: 'Fichiers récents' },
    ...(recents.length
      ? recents.map((r): MenuItem => ({
          label: r.name,
          sub: relTime(r.savedAt),
          icon: '🕘',
          onClick: () => loadRecentProject(r.id),
        }))
      : [{ label: 'Aucun fichier récent', disabled: true } as MenuItem]),
  ];

  const onRun = async () => {
    const errors = validateNetwork(network);
    if (errors.length) {
      setSimStatus('error', errors.join('\n'));
      alert('Impossible de lancer la simulation :\n\n' + errors.join('\n'));
      return;
    }
    setBusy(true);
    setSimStatus('running');
    try {
      const res = await runSimulation(network);
      setResults(res);
      if (res.warnings.length) setSimStatus('done', res.warnings.join('\n'));
      else setSimStatus('done');
    } catch (err) {
      setSimStatus('error', err instanceof Error ? err.message : String(err));
      alert('Erreur de simulation : ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onExportPdf = async () => {
    if (!results) {
      alert('Lancez d’abord une simulation.');
      return;
    }
    setBusy(true);
    try {
      const mapImage = (await captureCanvasPng()) ?? undefined;
      const hasProfile = useNetworkStore.getState().profilePath.length >= 2;
      const profileImage = hasProfile
        ? (await captureCanvasPng('.profile-drawer svg')) ?? undefined
        : undefined;
      generateReport({ network, results, timeIndex, times: results.times, mapImage, profileImage });
    } finally {
      setBusy(false);
    }
  };

  const onExportInp = () => {
    const inp = buildInp(network);
    const blob = new Blob([inp], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(network.meta.name || 'reseau').replace(/[^\w\-]+/g, '_')}.inp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="logo-mark">≈</span>
        <span className="logo-text">HydroNet</span>
      </div>

      <span
        className="project-name"
        title="Nom du projet (modifiable via Fichier ▸ Enregistrer sous…)"
      >
        {network.meta.name || 'Sans titre'}
      </span>

      <div className="toolbar-group">
        {/* 1 · Fichier */}
        <button
          className={`btn btn-menu ${fileMenu ? 'btn-menu-open' : ''}`}
          onClick={openFileMenu}
          title="Nouveau, Ouvrir, Enregistrer, projets récents…"
        >
          <OpenIcon size={16} /> Fichier <span className="caret">▾</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".hydronet,.json,.inp"
          onChange={onOpenFile}
          style={{ display: 'none' }}
        />

        <span className="toolbar-sep-v" />

        {/* 2 · Édition */}
        <button className="btn btn-icon" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
          <UndoIcon size={18} />
        </button>
        <button className="btn btn-icon" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
          <RedoIcon size={18} />
        </button>
        <button
          className={`btn btn-icon ${snapToGrid ? 'btn-toggle-on' : ''}`}
          onClick={toggleSnap}
          title="Magnétisme sur grille"
        >
          <GridIcon size={18} />
        </button>

        <span className="toolbar-sep-v" />

        {/* 3 · Données */}
        <button
          className="btn"
          onClick={() => setBackdropPanelOpen(true)}
          title="Fond de plan DAO : import DXF, calques, échelle…"
        >
          <PlanIcon size={16} /> Fond de plan
        </button>
        <button
          className="btn"
          onClick={() => setCurveDialogOpen(true)}
          title="Bibliothèque de courbes (caractéristique, rendement, volume…)"
        >
          📈 Courbes
        </button>

        <span className="toolbar-sep-v" />

        {/* 4 · Simulation */}
        <button
          className="btn btn-primary"
          onClick={onRun}
          disabled={busy || simStatus === 'running'}
        >
          {simStatus === 'running' ? (
            <>Calcul…</>
          ) : (
            <>
              <PlayIcon size={16} /> Lancer la simulation
            </>
          )}
        </button>

        <span className="toolbar-sep-v" />

        {/* 5 · Export */}
        <button className="btn" onClick={onExportPdf} disabled={busy || !results} title="Générer le rapport PDF">
          <PdfIcon size={16} /> Rapport PDF
        </button>
        <button className="btn" onClick={onExportInp} title="Exporter au format EPANET .inp">
          <ExportIcon size={16} /> .inp
        </button>
        <button className="btn" onClick={() => setDxfDialogOpen(true)} title="Exporter le plan au format DXF (AutoCAD)">
          <ExportIcon size={16} /> .dxf
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group toolbar-options">
        <label>
          Unités
          <select
            value={network.options.flowUnits}
            onChange={(e) => updateOptions({ flowUnits: e.target.value as FlowUnit })}
          >
            {FLOW_UNITS.map((u) => (
              <option key={u} value={u}>
                {FLOW_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pertes de charge
          <select
            value={network.options.headlossFormula}
            onChange={(e) => updateOptions({ headlossFormula: e.target.value as HeadlossFormula })}
          >
            {HEADLOSS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fileMenu && (
        <ContextMenu
          x={fileMenu.x}
          y={fileMenu.y}
          items={fileMenuItems}
          onClose={() => setFileMenu(null)}
        />
      )}
    </header>
  );
}
