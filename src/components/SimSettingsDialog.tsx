import { useEffect } from 'react';
import { useNetworkStore } from '../store/networkStore';
import {
  FlowUnit,
  HeadlossFormula,
  NetworkOptions,
  ComplianceCriteria,
  DEFAULT_OPTIONS,
  DEFAULT_CRITERIA,
  isUSUnits,
} from '../types/network';
import { FLOW_UNIT_LABELS } from '../utils/format';

const FLOW_UNITS: FlowUnit[] = ['LPS', 'LPM', 'CMH', 'CMD', 'MLD', 'GPM', 'CFS'];
const HEADLOSS: { id: HeadlossFormula; label: string }[] = [
  { id: 'H-W', label: 'Hazen-Williams' },
  { id: 'D-W', label: 'Darcy-Weisbach' },
  { id: 'C-M', label: 'Chézy-Manning' },
];

/** Champ numérique générique avec libellé + suffixe d'unité. */
function Num({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="set-field">
      <span className="set-label">
        {label}
        {hint && <em className="set-hint">{hint}</em>}
      </span>
      <span className="set-input">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {suffix && <span className="set-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export default function SimSettingsDialog() {
  const open = useNetworkStore((s) => s.simSettingsOpen);
  const setOpen = useNetworkStore((s) => s.setSimSettingsOpen);
  const options = useNetworkStore((s) => s.network.options);
  const criteria = useNetworkStore((s) => s.network.criteria);
  const updateOptions = useNetworkStore((s) => s.updateOptions);
  const updateCriteria = useNetworkStore((s) => s.updateCriteria);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const set = (patch: Partial<NetworkOptions>) => updateOptions(patch);
  const setCrit = (patch: Partial<ComplianceCriteria>) => updateCriteria(patch);

  const us = isUSUnits(options.flowUnits);
  const lenU = us ? 'ft' : 'm';
  const presU = us ? 'psi' : 'm';
  const velU = us ? 'ft/s' : 'm/s';

  const resetAll = () => {
    updateOptions({ ...DEFAULT_OPTIONS });
    updateCriteria({ ...DEFAULT_CRITERIA });
  };

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Paramètres de simulation</h3>
          <button className="modal-close" onClick={() => setOpen(false)} title="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="set-section">Unités & pertes de charge</div>
          <label className="set-field">
            <span className="set-label">Unités de débit</span>
            <span className="set-input">
              <select
                value={options.flowUnits}
                onChange={(e) => set({ flowUnits: e.target.value as FlowUnit })}
              >
                {FLOW_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {FLOW_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="set-field">
            <span className="set-label">Formule de perte de charge</span>
            <span className="set-input">
              <select
                value={options.headlossFormula}
                onChange={(e) => set({ headlossFormula: e.target.value as HeadlossFormula })}
              >
                {HEADLOSS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <div className="set-section">Durée & pas de temps</div>
          <Num
            label="Durée de simulation"
            hint="0 = régime permanent"
            value={options.duration / 3600}
            step={1}
            min={0}
            suffix="h"
            onChange={(v) => set({ duration: Math.max(0, (v || 0) * 3600) })}
          />
          <Num
            label="Pas de temps hydraulique"
            value={options.hydraulicStep / 60}
            step={5}
            min={1}
            suffix="min"
            onChange={(v) => set({ hydraulicStep: Math.max(60, (v || 1) * 60) })}
          />
          <Num
            label="Pas de temps des rapports"
            value={options.reportStep / 60}
            step={5}
            min={1}
            suffix="min"
            onChange={(v) => set({ reportStep: Math.max(60, (v || 1) * 60) })}
          />

          <div className="set-section">Hydraulique</div>
          <Num
            label="Densité relative"
            value={options.specificGravity}
            step={0.01}
            min={0.1}
            onChange={(v) => set({ specificGravity: v || 1 })}
          />
          <Num
            label="Viscosité relative"
            value={options.viscosity}
            step={0.1}
            min={0.1}
            onChange={(v) => set({ viscosity: v || 1 })}
          />
          <Num
            label="Itérations maximales"
            value={options.trials}
            step={1}
            min={1}
            onChange={(v) => set({ trials: Math.max(1, Math.round(v || 40)) })}
          />
          <Num
            label="Précision (convergence)"
            value={options.accuracy}
            step={0.0001}
            min={0.00001}
            onChange={(v) => set({ accuracy: v || 0.001 })}
          />

          <div className="set-section">Conformité (évaluation des résultats)</div>
          <Num
            label="Pression minimale de service"
            value={criteria.minPressure}
            step={1}
            suffix={presU}
            onChange={(v) => setCrit({ minPressure: v || 0 })}
          />
          <Num
            label="Pression maximale admissible"
            value={criteria.maxPressure}
            step={1}
            suffix={presU}
            onChange={(v) => setCrit({ maxPressure: v || 0 })}
          />
          <Num
            label="Vitesse maximale admissible"
            value={criteria.maxVelocity}
            step={0.1}
            suffix={velU}
            onChange={(v) => setCrit({ maxVelocity: v || 0 })}
          />
          <Num
            label="Vitesse minimale (auto-curage)"
            hint="0 = désactivé"
            value={criteria.minVelocity}
            step={0.1}
            suffix={velU}
            onChange={(v) => setCrit({ minVelocity: v || 0 })}
          />
          <p className="hint" style={{ marginBottom: 0 }}>
            Longueurs en {lenU}, pressions en {presU} (dérivées des unités de débit choisies).
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={resetAll}>
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
