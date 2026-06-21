import { useRef, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { runSimulation, validateNetwork } from '../engine/epanetRunner';
import { buildInp } from '../engine/inpBuilder';
import { parseInp } from '../engine/inpParser';
import { saveProjectFile, parseProjectFile, readFileAsText, clearSaveTarget } from '../engine/projectIO';
import { generateReport } from '../report/reportGenerator';
import { captureCanvasPng } from '../utils/svgCapture';
import ContextMenu, { MenuItem } from './ContextMenu';
import {
  OpenIcon,
  UndoIcon,
  RedoIcon,
  GridIcon,
  PlayIcon,
  ExportIcon,
  PlanIcon,
  SettingsIcon,
  FilterIcon,
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

export default function Toolbar() {
  const network = useNetworkStore((s) => s.network);
  const updateMeta = useNetworkStore((s) => s.updateMeta);
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
  const setPatternDialogOpen = useNetworkStore((s) => s.setPatternDialogOpen);
  const setDxfDialogOpen = useNetworkStore((s) => s.setDxfDialogOpen);
  const setSimSettingsOpen = useNetworkStore((s) => s.setSimSettingsOpen);
  const setSelectDialogOpen = useNetworkStore((s) => s.setSelectDialogOpen);
  const setLicenseOpen = useNetworkStore((s) => s.setLicenseOpen);
  const setHelpOpen = useNetworkStore((s) => s.setHelpOpen);
  const undo = useNetworkStore((s) => s.undo);
  const redo = useNetworkStore((s) => s.redo);
  const canUndo = useNetworkStore((s) => s.past.length > 0);
  const canRedo = useNetworkStore((s) => s.future.length > 0);
  const snapToGrid = useNetworkStore((s) => s.snapToGrid);
  const toggleSnap = useNetworkStore((s) => s.toggleSnap);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ kind: 'file' | 'lib' | 'export' | 'help'; x: number; y: number } | null>(null);
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
      clearSaveTarget(); // nouveau projet ouvert -> nouvelle cible d'enregistrement
      loadNetwork(net);
      addRecent(net.meta.name || file.name.replace(/\.[^.]+$/, ''), net);
    } catch (err) {
      alert('Impossible d’ouvrir le fichier : ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Enregistre, met à jour le nom du projet avec le fichier réellement choisi.
  const doSave = async (saveAs: boolean) => {
    const name = await saveProjectFile(network, { saveAs });
    if (!name) return; // annulé
    updateMeta({ name });
    addRecent(name, { ...network, meta: { ...network.meta, name } });
  };

  const onNew = () => {
    clearSaveTarget();
    newNetwork();
  };

  const openMenu = (kind: 'file' | 'lib' | 'export' | 'help') => (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu((m) => (m?.kind === kind ? null : { kind, x: r.left, y: r.bottom + 4 }));
  };

  const fileMenuItems: MenuItem[] = [
    { label: 'Nouveau', icon: '📄', onClick: onNew },
    { label: 'Ouvrir…', icon: '📂', onClick: () => fileInput.current?.click() },
    { type: 'separator' },
    { label: 'Enregistrer', icon: '💾', onClick: () => doSave(false) },
    { label: 'Enregistrer sous…', icon: '🏷️', onClick: () => doSave(true) },
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

  const libMenuItems: MenuItem[] = [
    { label: 'Courbes', sub: 'caractéristique, rendement, volume…', icon: '📈', onClick: () => setCurveDialogOpen(true) },
    { label: 'Modulations', sub: 'coefficients horaires (demande, vitesse)', icon: '⏱', onClick: () => setPatternDialogOpen(true) },
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

  const exportMenuItems: MenuItem[] = [
    { label: 'Rapport PDF', sub: results ? undefined : 'lancez d’abord une simulation', icon: '📄', disabled: busy || !results, onClick: onExportPdf },
    { type: 'separator' },
    { label: 'EPANET (.inp)', icon: '📤', onClick: onExportInp },
    { label: 'AutoCAD (.dxf)', icon: '📐', onClick: () => setDxfDialogOpen(true) },
  ];

  const helpMenuItems: MenuItem[] = [
    { label: 'Documentation', sub: 'guide d’utilisation', icon: '📖', onClick: () => setHelpOpen(true) },
    { label: 'À propos / Licence', icon: 'ℹ️', onClick: () => setLicenseOpen(true) },
  ];

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <img
          className="logo-img"
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          alt="HydroNet"
          width={34}
          height={34}
        />
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
          className={`btn btn-menu ${menu?.kind === 'file' ? 'btn-menu-open' : ''}`}
          onClick={openMenu('file')}
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
        <button
          className="btn"
          onClick={() => setSelectDialogOpen(true)}
          title="Sélectionner des éléments par filtre (vitesse, pression, diamètre…)"
        >
          <FilterIcon size={16} /> Sélection
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
          className={`btn btn-menu ${menu?.kind === 'lib' ? 'btn-menu-open' : ''}`}
          onClick={openMenu('lib')}
          title="Courbes (caractéristique, rendement, volume) et courbes de modulation"
        >
          📈 Courbes &amp; modulations <span className="caret">▾</span>
        </button>

        <span className="toolbar-sep-v" />

        {/* 4 · Simulation */}
        <button
          className="btn"
          onClick={() => setSimSettingsOpen(true)}
          title="Paramètres de simulation : unités, pertes de charge, durée, hydraulique, conformité"
        >
          <SettingsIcon size={16} /> Paramètres
        </button>
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
        <button
          className={`btn btn-menu ${menu?.kind === 'export' ? 'btn-menu-open' : ''}`}
          onClick={openMenu('export')}
          title="Exporter : rapport PDF, EPANET .inp, AutoCAD .dxf"
        >
          <ExportIcon size={16} /> Exporter <span className="caret">▾</span>
        </button>

        <span className="toolbar-sep-v" />

        {/* 6 · Aide */}
        <button
          className={`btn btn-menu ${menu?.kind === 'help' ? 'btn-menu-open' : ''}`}
          onClick={openMenu('help')}
          title="Documentation et À propos"
        >
          ❓ Aide <span className="caret">▾</span>
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={
            menu.kind === 'file'
              ? fileMenuItems
              : menu.kind === 'lib'
                ? libMenuItems
                : menu.kind === 'export'
                  ? exportMenuItems
                  : helpMenuItems
          }
          onClose={() => setMenu(null)}
        />
      )}

    </header>
  );
}
