import { useNetworkStore } from '../store/networkStore';
import {
  Junction,
  Reservoir,
  Tank,
  Pipe,
  Pump,
  Valve,
  ValveKind,
  LinkStatus,
  PumpMode,
} from '../types/network';
import { flowUnitLabel } from '../utils/format';

function Field({
  label,
  value,
  unit,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {unit && <em>({unit})</em>}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function PropertiesPanel() {
  const network = useNetworkStore((s) => s.network);
  const selection = useNetworkStore((s) => s.selection);
  const updateNode = useNetworkStore((s) => s.updateNode);
  const updateLink = useNetworkStore((s) => s.updateLink);
  const updateOptions = useNetworkStore((s) => s.updateOptions);
  const updateCriteria = useNetworkStore((s) => s.updateCriteria);
  const deleteSelection = useNetworkStore((s) => s.deleteSelection);
  const flowU = flowUnitLabel(network.options.flowUnits);
  const lenU = network.options.flowUnits === 'GPM' || network.options.flowUnits === 'CFS' ? 'ft' : 'm';

  if (!selection) {
    const o = network.options;
    return (
      <div className="props">
        <h3 className="props-title">Paramètres de simulation</h3>
        <p className="hint">Sélectionnez un élément du réseau pour modifier ses propriétés.</p>
        <Field
          label="Durée"
          unit="h"
          step={1}
          value={o.duration / 3600}
          onChange={(v) => updateOptions({ duration: Math.max(0, v) * 3600 })}
        />
        <Field
          label="Pas hydraulique"
          unit="min"
          step={5}
          value={o.hydraulicStep / 60}
          onChange={(v) => updateOptions({ hydraulicStep: Math.max(1, v) * 60 })}
        />
        <Field
          label="Pas de report"
          unit="min"
          step={5}
          value={o.reportStep / 60}
          onChange={(v) => updateOptions({ reportStep: Math.max(1, v) * 60 })}
        />
        <Field
          label="Précision"
          step={0.0001}
          value={o.accuracy}
          onChange={(v) => updateOptions({ accuracy: v })}
        />
        <Field
          label="Itérations max"
          step={1}
          value={o.trials}
          onChange={(v) => updateOptions({ trials: Math.round(v) })}
        />

        <h3 className="props-title" style={{ marginTop: 18 }}>
          Critères de conformité
        </h3>
        <p className="hint">Seuils utilisés pour évaluer les résultats et le rapport.</p>
        <Field
          label="Pression de service min"
          unit={lenU}
          value={network.criteria.minPressure}
          onChange={(v) => updateCriteria({ minPressure: v })}
        />
        <Field
          label="Pression max admissible"
          unit={lenU}
          value={network.criteria.maxPressure}
          onChange={(v) => updateCriteria({ maxPressure: v })}
        />
        <Field
          label="Vitesse max admissible"
          unit={`${lenU}/s`}
          step={0.1}
          value={network.criteria.maxVelocity}
          onChange={(v) => updateCriteria({ maxVelocity: v })}
        />
        <Field
          label="Vitesse min (auto-curage)"
          unit={`${lenU}/s`}
          step={0.1}
          value={network.criteria.minVelocity}
          onChange={(v) => updateCriteria({ minVelocity: v })}
        />
      </div>
    );
  }

  if (selection.kind === 'node') {
    const node = network.nodes[selection.id];
    if (!node) return null;
    return (
      <div className="props">
        <div className="props-header">
          <h3 className="props-title">
            <span className={`badge badge-${node.type}`}>{nodeTypeLabel(node.type)}</span> {node.id}
          </h3>
          <button className="btn btn-danger btn-sm" onClick={deleteSelection}>
            Supprimer
          </button>
        </div>
        <TextField label="Étiquette" value={node.label ?? ''} onChange={(v) => updateNode(node.id, { label: v })} />

        {node.type === 'junction' && (
          <>
            <Field label="Cote / Altitude" unit={lenU} value={(node as Junction).elevation} onChange={(v) => updateNode(node.id, { elevation: v })} />
            <Field label="Demande de base" unit={flowU} value={(node as Junction).baseDemand} onChange={(v) => updateNode(node.id, { baseDemand: v })} step={0.1} />
            <PatternSelect value={(node as Junction).pattern} onChange={(p) => updateNode(node.id, { pattern: p })} />
          </>
        )}
        {node.type === 'reservoir' && (
          <Field label="Charge totale" unit={lenU} value={(node as Reservoir).head} onChange={(v) => updateNode(node.id, { head: v })} />
        )}
        {node.type === 'tank' && (
          <>
            <Field label="Cote de fond" unit={lenU} value={(node as Tank).elevation} onChange={(v) => updateNode(node.id, { elevation: v })} />
            <Field label="Niveau initial" unit={lenU} value={(node as Tank).initLevel} onChange={(v) => updateNode(node.id, { initLevel: v })} />
            <Field label="Niveau min" unit={lenU} value={(node as Tank).minLevel} onChange={(v) => updateNode(node.id, { minLevel: v })} />
            <Field label="Niveau max" unit={lenU} value={(node as Tank).maxLevel} onChange={(v) => updateNode(node.id, { maxLevel: v })} />
            <Field label="Diamètre" unit={lenU} value={(node as Tank).diameter} onChange={(v) => updateNode(node.id, { diameter: v })} />
          </>
        )}
        <div className="coords-hint">
          x = {node.x.toFixed(1)}, y = {node.y.toFixed(1)}
        </div>
      </div>
    );
  }

  // Lien
  const link = network.links[selection.id];
  if (!link) return null;
  return (
    <div className="props">
      <div className="props-header">
        <h3 className="props-title">
          <span className={`badge badge-${link.type}`}>{linkTypeLabel(link.type)}</span> {link.id}
        </h3>
        <button className="btn btn-danger btn-sm" onClick={deleteSelection}>
          Supprimer
        </button>
      </div>
      <div className="coords-hint">
        {link.node1} → {link.node2}
      </div>

      {link.type === 'pipe' && (
        <>
          <Field label="Longueur" unit={lenU} value={(link as Pipe).length} onChange={(v) => updateLink(link.id, { length: v })} />
          <Field label="Diamètre" unit="mm" value={(link as Pipe).diameter} onChange={(v) => updateLink(link.id, { diameter: v })} />
          <Field label="Rugosité" value={(link as Pipe).roughness} onChange={(v) => updateLink(link.id, { roughness: v })} />
          <Field label="Pertes singulières" value={(link as Pipe).minorLoss} step={0.1} onChange={(v) => updateLink(link.id, { minorLoss: v })} />
          <StatusSelect value={(link as Pipe).status} onChange={(v) => updateLink(link.id, { status: v })} />
        </>
      )}

      {link.type === 'pump' && (
        <>
          <label className="field">
            <span className="field-label">Mode</span>
            <select
              value={(link as Pump).mode}
              onChange={(e) => updateLink(link.id, { mode: e.target.value as PumpMode })}
            >
              <option value="head">Courbe (point nominal)</option>
              <option value="power">Puissance constante</option>
            </select>
          </label>
          {(link as Pump).mode === 'head' ? (
            <>
              <Field label="Débit nominal" unit={flowU} value={(link as Pump).designFlow ?? 0} onChange={(v) => updateLink(link.id, { designFlow: v })} />
              <Field label="Hauteur nominale" unit={lenU} value={(link as Pump).designHead ?? 0} onChange={(v) => updateLink(link.id, { designHead: v })} />
            </>
          ) : (
            <Field label="Puissance" unit="kW" value={(link as Pump).power ?? 0} onChange={(v) => updateLink(link.id, { power: v })} />
          )}
          <Field label="Vitesse relative" value={(link as Pump).speed ?? 1} step={0.05} onChange={(v) => updateLink(link.id, { speed: v })} />
        </>
      )}

      {link.type === 'valve' && (
        <>
          <label className="field">
            <span className="field-label">Type de vanne</span>
            <select
              value={(link as Valve).valveKind}
              onChange={(e) => updateLink(link.id, { valveKind: e.target.value as ValveKind })}
            >
              <option value="PRV">PRV — réductrice de pression</option>
              <option value="PSV">PSV — maintien de pression</option>
              <option value="PBV">PBV — brise-charge</option>
              <option value="FCV">FCV — limitatrice de débit</option>
              <option value="TCV">TCV — étranglement</option>
              <option value="GPV">GPV — générale</option>
            </select>
          </label>
          <Field label="Diamètre" unit="mm" value={(link as Valve).diameter} onChange={(v) => updateLink(link.id, { diameter: v })} />
          <Field label="Consigne" value={(link as Valve).setting} onChange={(v) => updateLink(link.id, { setting: v })} />
          <Field label="Pertes singulières" value={(link as Valve).minorLoss} step={0.1} onChange={(v) => updateLink(link.id, { minorLoss: v })} />
        </>
      )}
    </div>
  );
}

function PatternSelect({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const patterns = useNetworkStore((s) => s.network.patterns);
  return (
    <label className="field">
      <span className="field-label">Courbe de modulation</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— Aucune —</option>
        {Object.keys(patterns).map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusSelect({ value, onChange }: { value: LinkStatus; onChange: (v: LinkStatus) => void }) {
  return (
    <label className="field">
      <span className="field-label">État</span>
      <select value={value} onChange={(e) => onChange(e.target.value as LinkStatus)}>
        <option value="OPEN">Ouvert</option>
        <option value="CLOSED">Fermé</option>
        <option value="CV">Clapet anti-retour</option>
      </select>
    </label>
  );
}

function nodeTypeLabel(t: string): string {
  return t === 'junction' ? 'Nœud' : t === 'reservoir' ? 'Réservoir' : 'Château';
}
function linkTypeLabel(t: string): string {
  return t === 'pipe' ? 'Conduite' : t === 'pump' ? 'Pompe' : 'Vanne';
}
