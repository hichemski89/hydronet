import { useEffect } from 'react';
import { DisplaySettings, DEFAULT_DISPLAY, useNetworkStore } from '../store/networkStore';

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

// Palette de fonds étudiée pour un canevas technique : teintes nettement
// distinctes (chaud → froid → clair → sombre), confortables sur de longues
// sessions et offrant un bon contraste avec les conduites et nœuds colorés.
const BG_PRESETS: { hex: string; name: string }[] = [
  { hex: '#ffffff', name: 'Blanc' },         // net, idéal pour l'impression
  { hex: '#f4f1ea', name: 'Papier' },        // blanc cassé chaud, anti-éblouissement
  { hex: '#e6ecf2', name: 'Gris bleuté' },   // neutre froid, type plan technique
  { hex: '#d6e6f5', name: 'Bleu clair' },    // teinte hydraulique légère
  { hex: '#1e293b', name: 'Ardoise' },       // sombre, faible luminosité
  { hex: '#0b2545', name: 'Bleu nuit' },     // bleu d'épure (blueprint)
];

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="disp-color">
      <span>{label}</span>
      <div className="disp-color-controls">
        {BG_PRESETS.map((p) => (
          <button
            key={p.hex}
            className={`color-swatch ${value.toLowerCase() === p.hex ? 'active' : ''}`}
            style={{ background: p.hex }}
            onClick={() => onChange(p.hex)}
            title={`${p.name} (${p.hex})`}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} title="Couleur personnalisée" />
      </div>
    </div>
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

          <Slider label="Taille du texte" value={display.labelSize} min={8} max={26} step={1} suffix=" px" onChange={(v) => set({ labelSize: v })} />

          <div className="disp-section">Résultats</div>
          <Toggle label="Valeurs aux nœuds (sous le symbole)" checked={display.showResultValues} onChange={(v) => set({ showResultValues: v })} />
          <Toggle label="Valeurs aux conduites" checked={display.showLinkValues} onChange={(v) => set({ showLinkValues: v })} />
          <Toggle label="Flèches de sens d’écoulement" checked={display.showFlowArrows} onChange={(v) => set({ showFlowArrows: v })} />
          <Slider label="Taille des flèches" value={display.arrowSize} min={3} max={18} step={1} suffix=" px" onChange={(v) => set({ arrowSize: v })} />

          <div className="disp-section">Carte</div>
          <ColorRow label="Couleur du fond" value={display.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />
          <Toggle label="Grille de fond" checked={display.showGrid} onChange={(v) => set({ showGrid: v })} />
          <Toggle label="Conduites en courbes (arcs au rayon de courbure)" checked={display.smoothPipes} onChange={(v) => set({ smoothPipes: v })} />
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
  return { ...DEFAULT_DISPLAY };
}
