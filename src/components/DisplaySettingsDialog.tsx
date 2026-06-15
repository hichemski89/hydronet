import { useEffect } from 'react';
import { DisplaySettings, useNetworkStore } from '../store/networkStore';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="disp-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="disp-switch" />
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="disp-slider">
      <span className="disp-slider-head">
        {label} <em>{value}{suffix}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export default function DisplaySettingsDialog() {
  const open = useNetworkStore((s) => s.displayDialogOpen);
  const setOpen = useNetworkStore((s) => s.setDisplayDialogOpen);
  const display = useNetworkStore((s) => s.display);
  const update = useNetworkStore((s) => s.updateDisplay);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const set = (patch: Partial<DisplaySettings>) => update(patch);

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Options d’affichage</h3>
          <button className="modal-close" onClick={() => setOpen(false)} title="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="disp-section">Éléments</div>
          <Toggle label="Identifiants des nœuds" checked={display.showNodeLabels} onChange={(v) => set({ showNodeLabels: v })} />
          <Toggle label="Identifiants des conduites" checked={display.showLinkLabels} onChange={(v) => set({ showLinkLabels: v })} />

          <div className="disp-section">Résultats</div>
          <Toggle label="Valeurs aux nœuds (sous le symbole)" checked={display.showResultValues} onChange={(v) => set({ showResultValues: v })} />
          <Toggle label="Flèches de sens d’écoulement" checked={display.showFlowArrows} onChange={(v) => set({ showFlowArrows: v })} />

          <div className="disp-section">Carte</div>
          <Toggle label="Grille de fond" checked={display.showGrid} onChange={(v) => set({ showGrid: v })} />
          <Toggle label="Épaisseur des conduites selon le diamètre" checked={display.widthByDiameter} onChange={(v) => set({ widthByDiameter: v })} />
          <Slider label="Taille des nœuds" value={display.nodeSize} min={4} max={16} step={1} suffix=" px" onChange={(v) => set({ nodeSize: v })} />
          <Slider label="Épaisseur des conduites" value={display.linkWidth} min={1} max={8} step={0.5} suffix=" px" onChange={(v) => set({ linkWidth: v })} />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => update({ ...defaultsForReset() })}>
            Réinitialiser
          </button>
          <button className="btn btn-primary" onClick={() => setOpen(false)}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultsForReset(): DisplaySettings {
  return {
    showNodeLabels: true,
    showLinkLabels: false,
    showResultValues: true,
    showFlowArrows: true,
    showGrid: true,
    nodeSize: 8,
    linkWidth: 3,
    widthByDiameter: false,
  };
}
