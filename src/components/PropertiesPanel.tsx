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
  CurveType,
} from '../types/network';
import { flowUnitLabel } from '../utils/format';
import {
  PIPE_MATERIALS,
  getMaterial,
  getDiameter,
  getSize,
  materialRoughness,
  minBendRadiusMeters,
} from '../data/pipeCatalog';
import { fittingsMinorLoss, bendViolations } from '../utils/pipeGeometry';

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
        onFocus={() => useNetworkStore.getState().commit()}
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
      <input
        type="text"
        value={value}
        onFocus={() => useNetworkStore.getState().commit()}
        onChange={(e) => onChange(e.target.value)}
      />
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
  const selNodes = useNetworkStore((s) => s.selNodes);
  const selLinks = useNetworkStore((s) => s.selLinks);
  const deleteMultiSelection = useNetworkStore((s) => s.deleteMultiSelection);
  const clearMultiSelection = useNetworkStore((s) => s.clearMultiSelection);
  const flowU = flowUnitLabel(network.options.flowUnits);
  const lenU = network.options.flowUnits === 'GPM' || network.options.flowUnits === 'CFS' ? 'ft' : 'm';

  if (!selection && (selNodes.length > 0 || selLinks.length > 0)) {
    return (
      <div className="props">
        <h3 className="props-title">Sélection multiple</h3>
        <p className="hint">
          {selNodes.length} nœud(s) et {selLinks.length} conduite(s)/lien(s) sélectionnés.
          <br />
          Glissez un élément sélectionné pour tout déplacer, ou supprimez l’ensemble.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={clearMultiSelection}>
            Désélectionner
          </button>
          <button className="btn btn-sm btn-danger" onClick={deleteMultiSelection}>
            Supprimer la sélection
          </button>
        </div>
      </div>
    );
  }

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

        <ControlsEditor />
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
            <CurveSelect label="Courbe volume (niveau→volume)" type="VOLUME" value={(node as Tank).volumeCurve} onChange={(v) => updateNode(node.id, { volumeCurve: v })} />
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
          <PipeCatalogEditor pipe={link as Pipe} />
          <Field label="Rugosité" value={(link as Pipe).roughness} onChange={(v) => updateLink(link.id, { roughness: v })} />
          <Field label="Pertes singulières (base)" value={(link as Pipe).minorLoss} step={0.1} onChange={(v) => updateLink(link.id, { minorLoss: v })} />
          <StatusSelect value={(link as Pipe).status} onChange={(v) => updateLink(link.id, { status: v })} />
          <PipeBendInfo pipe={link as Pipe} />
        </>
      )}

      {link.type === 'pump' && (
        <>
          <label className="field">
            <span className="field-label">Mode</span>
            <select
              value={(link as Pump).mode}
              onFocus={() => useNetworkStore.getState().commit()}
              onChange={(e) => updateLink(link.id, { mode: e.target.value as PumpMode })}
            >
              <option value="head">Courbe (point nominal)</option>
              <option value="power">Puissance constante</option>
            </select>
          </label>
          {(link as Pump).mode === 'head' ? (
            <>
              <CurveSelect label="Courbe caractéristique (bibliothèque)" type="PUMP" value={(link as Pump).headCurve} onChange={(v) => updateLink(link.id, { headCurve: v })} />
              {!(link as Pump).headCurve && <PumpCurveEditor pump={link as Pump} flowU={flowU} lenU={lenU} />}
            </>
          ) : (
            <Field label="Puissance nominale" unit="kW" value={(link as Pump).power ?? 0} onChange={(v) => updateLink(link.id, { power: v })} />
          )}
          <Field label="Vitesse relative" value={(link as Pump).speed ?? 1} step={0.05} onChange={(v) => updateLink(link.id, { speed: v })} />
          <PatternSelect label="Courbe modul. vitesse" value={(link as Pump).speedPattern} onChange={(p) => updateLink(link.id, { speedPattern: p })} />
          <label className="field">
            <span className="field-label">État initial</span>
            <select
              value={(link as Pump).status}
              onFocus={() => useNetworkStore.getState().commit()}
              onChange={(e) => updateLink(link.id, { status: e.target.value as LinkStatus })}
            >
              <option value="OPEN">Marche</option>
              <option value="CLOSED">Arrêt</option>
            </select>
          </label>
          <CurveSelect label="Courbe rendement (bibliothèque)" type="EFFICIENCY" value={(link as Pump).efficiencyCurve} onChange={(v) => updateLink(link.id, { efficiencyCurve: v })} />
          {!(link as Pump).efficiencyCurve && (
            <Field label="Rendement" unit="%" value={(link as Pump).efficiency ?? 0} step={1} onChange={(v) => updateLink(link.id, { efficiency: v })} />
          )}
          <Field label="Prix de l’énergie" value={(link as Pump).energyPrice ?? 0} step={0.01} onChange={(v) => updateLink(link.id, { energyPrice: v })} />
          <PatternSelect label="Courbe modul. prix" value={(link as Pump).pricePattern} onChange={(p) => updateLink(link.id, { pricePattern: p })} />
        </>
      )}

      {link.type === 'valve' && (
        <>
          <label className="field">
            <span className="field-label">Type de vanne</span>
            <select
              value={(link as Valve).valveKind}
              onFocus={() => useNetworkStore.getState().commit()}
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

function PatternSelect({
  value,
  onChange,
  label = 'Courbe de modulation',
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  label?: string;
}) {
  const patterns = useNetworkStore((s) => s.network.patterns);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        value={value ?? ''}
        onFocus={() => useNetworkStore.getState().commit()}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
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

function PipeBendInfo({ pipe }: { pipe: Pipe }) {
  const network = useNetworkStore((s) => s.network);
  const metersPerUnit = useNetworkStore((s) => s.metersPerUnit);
  const minRm = minBendRadiusMeters(pipe.material, pipe.dn);
  const fK = fittingsMinorLoss(pipe);
  let viol = 0;
  if (minRm != null && pipe.vertices?.length) {
    const a = network.nodes[pipe.node1];
    const b = network.nodes[pipe.node2];
    if (a && b) {
      viol = bendViolations(
        [a, ...pipe.vertices, b],
        minRm / metersPerUnit,
        (vi) => !!pipe.fittings?.[vi],
      ).length;
    }
  }
  const nFit = pipe.fittings ? Object.keys(pipe.fittings).length : 0;
  return (
    <div className="bend-info">
      {minRm != null && (
        <div>
          Rayon de courbure min : <strong>{minRm.toFixed(2)} m</strong>
        </div>
      )}
      <div>
        Pertes singulières totales : <strong>{(pipe.minorLoss + fK).toFixed(2)}</strong>
        {nFit > 0 && ` (dont ${nFit} coude${nFit > 1 ? 's' : ''} : ${fK.toFixed(2)})`}
      </div>
      {viol > 0 && (
        <div className="bend-warn">
          ⚠ {viol} sommet{viol > 1 ? 's' : ''} trop serré{viol > 1 ? 's' : ''} pour le rayon mini — insérez
          un coude (clic droit sur la poignée en mode édition des sommets).
        </div>
      )}
    </div>
  );
}

function CurveSelect({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: CurveType;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const curves = useNetworkStore((s) => s.network.curves);
  const setCurveDialogOpen = useNetworkStore((s) => s.setCurveDialogOpen);
  const list = Object.values(curves).filter((c) => c.type === type);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={value ?? ''}
          onFocus={() => useNetworkStore.getState().commit()}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={{ flex: 1 }}
        >
          <option value="">— Aucune —</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
              {c.description ? ` (${c.description})` : ''}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" type="button" title="Gérer les courbes" onClick={() => setCurveDialogOpen(true)}>
          📈
        </button>
      </div>
    </label>
  );
}

function StatusSelect({ value, onChange }: { value: LinkStatus; onChange: (v: LinkStatus) => void }) {
  return (
    <label className="field">
      <span className="field-label">État</span>
      <select
        value={value}
        onFocus={() => useNetworkStore.getState().commit()}
        onChange={(e) => onChange(e.target.value as LinkStatus)}
      >
        <option value="OPEN">Ouvert</option>
        <option value="CLOSED">Fermé</option>
        <option value="CV">Clapet anti-retour</option>
      </select>
    </label>
  );
}

function ControlsEditor() {
  const network = useNetworkStore((s) => s.network);
  const addControl = useNetworkStore((s) => s.addControl);
  const updateControl = useNetworkStore((s) => s.updateControl);
  const deleteControl = useNetworkStore((s) => s.deleteControl);
  const commit = useNetworkStore((s) => s.commit);
  const controls = network.controls;
  const links = Object.values(network.links);
  const nodes = Object.values(network.nodes).filter((nd) => nd.type !== 'junction');

  return (
    <>
      <h3 className="props-title" style={{ marginTop: 18 }}>
        Contrôles automatiques
      </h3>
      <p className="hint">
        Pilotent l’ouverture/fermeture d’un lien (pompe, vanne…) selon le niveau d’un réservoir ou
        l’heure.
      </p>
      {controls.length === 0 && <p className="hint" style={{ marginTop: 0 }}>Aucun contrôle défini.</p>}

      {controls.map((c) => (
        <div className="control-card" key={c.id}>
          <div className="control-row">
            <select
              value={c.linkId}
              onFocus={commit}
              onChange={(e) => updateControl(c.id, { linkId: e.target.value })}
            >
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} ({l.type})
                </option>
              ))}
            </select>
            <select
              value={typeof c.setting === 'number' ? 'value' : c.setting}
              onFocus={commit}
              onChange={(e) =>
                updateControl(c.id, {
                  setting: e.target.value === 'value' ? 1 : (e.target.value as 'OPEN' | 'CLOSED'),
                })
              }
            >
              <option value="OPEN">Ouvrir</option>
              <option value="CLOSED">Fermer</option>
              <option value="value">Consigne…</option>
            </select>
          </div>
          {typeof c.setting === 'number' && (
            <input
              type="number"
              className="control-setting"
              value={c.setting}
              step={0.1}
              onFocus={commit}
              onChange={(e) => updateControl(c.id, { setting: parseFloat(e.target.value) || 0 })}
            />
          )}
          <div className="control-row">
            <select
              value={c.conditionType}
              onFocus={commit}
              onChange={(e) =>
                updateControl(c.id, { conditionType: e.target.value as 'node-level' | 'time' })
              }
            >
              <option value="node-level">Si niveau nœud</option>
              <option value="time">À l’heure</option>
            </select>
            {c.conditionType === 'node-level' ? (
              <>
                <select
                  value={c.nodeId ?? ''}
                  onFocus={commit}
                  onChange={(e) => updateControl(c.id, { nodeId: e.target.value })}
                >
                  {nodes.map((nd) => (
                    <option key={nd.id} value={nd.id}>
                      {nd.id}
                    </option>
                  ))}
                </select>
                <select
                  value={c.operator ?? 'above'}
                  onFocus={commit}
                  onChange={(e) => updateControl(c.id, { operator: e.target.value as 'above' | 'below' })}
                >
                  <option value="above">au-dessus de</option>
                  <option value="below">en-dessous de</option>
                </select>
              </>
            ) : null}
          </div>
          <div className="control-row">
            <input
              type="number"
              value={c.value}
              step={0.5}
              onFocus={commit}
              onChange={(e) => updateControl(c.id, { value: parseFloat(e.target.value) || 0 })}
            />
            <span className="control-unit">{c.conditionType === 'time' ? 'h' : 'm'}</span>
            <button className="curve-del" title="Supprimer" onClick={() => deleteControl(c.id)}>
              ×
            </button>
          </div>
        </div>
      ))}

      <button
        className="btn btn-sm"
        style={{ width: '100%', marginTop: 6 }}
        onClick={addControl}
        disabled={links.length === 0}
      >
        + Ajouter un contrôle
      </button>
    </>
  );
}

function PipeCatalogEditor({ pipe }: { pipe: Pipe }) {
  const updateLink = useNetworkStore((s) => s.updateLink);
  const commit = useNetworkStore((s) => s.commit);
  const formula = useNetworkStore((s) => s.network.options.headlossFormula);
  const material = getMaterial(pipe.material);

  const applyMaterial = (matId: string) => {
    commit();
    if (!matId) {
      updateLink(pipe.id, { material: undefined, dn: undefined, pn: undefined });
      return;
    }
    const mat = getMaterial(matId);
    if (!mat) return;
    const dn = pipe.dn && getDiameter(mat, pipe.dn) ? pipe.dn : 110;
    const dia = getDiameter(mat, dn) ?? mat.diameters[0];
    const size = getSize(mat, dia.dn, pipe.pn ?? 16) ?? dia.sizes[Math.floor(dia.sizes.length / 2)];
    updateLink(pipe.id, {
      material: matId,
      dn: dia.dn,
      pn: size.pn,
      diameter: size.innerDiameter,
      roughness: materialRoughness(mat, formula),
    });
  };

  const applyDn = (dn: number) => {
    if (!material) return;
    commit();
    const dia = getDiameter(material, dn);
    if (!dia) return;
    const size = getSize(material, dn, pipe.pn ?? 16) ?? dia.sizes[Math.floor(dia.sizes.length / 2)];
    updateLink(pipe.id, { dn, pn: size.pn, diameter: size.innerDiameter });
  };

  const applyPn = (pn: number) => {
    if (!material || !pipe.dn) return;
    commit();
    const size = getSize(material, pipe.dn, pn);
    if (!size) return;
    updateLink(pipe.id, { pn, diameter: size.innerDiameter });
  };

  const MaterialSelect = (
    <label className="field">
      <span className="field-label">Tube (bibliothèque)</span>
      <select value={material?.id ?? ''} onFocus={commit} onChange={(e) => applyMaterial(e.target.value)}>
        <option value="">Personnalisé (saisie libre)</option>
        {PIPE_MATERIALS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (!material) {
    return (
      <>
        {MaterialSelect}
        <Field
          label="Diamètre intérieur"
          unit="mm"
          value={pipe.diameter}
          onChange={(v) => updateLink(pipe.id, { diameter: v })}
        />
      </>
    );
  }

  const dia = pipe.dn ? getDiameter(material, pipe.dn) : undefined;
  const size = pipe.dn && pipe.pn ? getSize(material, pipe.dn, pipe.pn) : undefined;

  return (
    <>
      {MaterialSelect}
      <div className="catalog-row">
        <label className="field">
          <span className="field-label">DN extérieur</span>
          <select value={pipe.dn ?? ''} onFocus={commit} onChange={(e) => applyDn(Number(e.target.value))}>
            {material.diameters.map((d) => (
              <option key={d.dn} value={d.dn}>
                {d.dn} mm
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Pression</span>
          <select value={pipe.pn ?? ''} onFocus={commit} onChange={(e) => applyPn(Number(e.target.value))}>
            {dia?.sizes.map((s) => (
              <option key={s.pn} value={s.pn}>
                PN{s.pn} (SDR {s.sdr})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="catalog-info">
        {size ? (
          <>
            Épaisseur {size.thickness} mm · <strong>Ø intérieur {size.innerDiameter} mm</strong> (utilisé
            pour le calcul)
          </>
        ) : (
          'Combinaison DN/PN non disponible'
        )}
      </div>
    </>
  );
}

function PumpCurveEditor({ pump, flowU, lenU }: { pump: Pump; flowU: string; lenU: string }) {
  const updateLink = useNetworkStore((s) => s.updateLink);
  const commit = useNetworkStore((s) => s.commit);
  const curve = pump.curve ?? [];

  if (curve.length === 0) {
    return (
      <>
        <Field label="Débit nominal" unit={flowU} value={pump.designFlow ?? 0} onChange={(v) => updateLink(pump.id, { designFlow: v })} />
        <Field label="Hauteur nominale" unit={lenU} value={pump.designHead ?? 0} onChange={(v) => updateLink(pump.id, { designHead: v })} />
        <button
          className="btn btn-sm"
          style={{ width: '100%', marginBottom: 8 }}
          onClick={() => {
            commit();
            const q = pump.designFlow ?? 50;
            const h = pump.designHead ?? 40;
            updateLink(pump.id, {
              curve: [
                { flow: 0, head: Math.round(h * 1.33) },
                { flow: q, head: h },
                { flow: Math.round(q * 2), head: 0 },
              ],
            });
          }}
        >
          Définir une courbe multi-points
        </button>
      </>
    );
  }

  const setPoint = (i: number, key: 'flow' | 'head', v: number) => {
    const next = curve.map((p, idx) => (idx === i ? { ...p, [key]: v } : p));
    updateLink(pump.id, { curve: next });
  };

  return (
    <div className="curve-editor">
      <div className="curve-head">
        <span className="field-label">Courbe caractéristique</span>
        <button className="btn btn-sm" onClick={() => { commit(); updateLink(pump.id, { curve: undefined }); }}>
          Point unique
        </button>
      </div>
      <div className="curve-cols">
        <span>Débit ({flowU})</span>
        <span>Hauteur ({lenU})</span>
        <span />
      </div>
      {curve.map((p, i) => (
        <div className="curve-row" key={i}>
          <input type="number" value={p.flow} onFocus={commit} onChange={(e) => setPoint(i, 'flow', parseFloat(e.target.value) || 0)} />
          <input type="number" value={p.head} onFocus={commit} onChange={(e) => setPoint(i, 'head', parseFloat(e.target.value) || 0)} />
          <button
            className="curve-del"
            title="Supprimer le point"
            onClick={() => { commit(); updateLink(pump.id, { curve: curve.filter((_, idx) => idx !== i) }); }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="btn btn-sm"
        style={{ width: '100%', marginTop: 6 }}
        onClick={() => {
          commit();
          const last = curve[curve.length - 1] ?? { flow: 0, head: 0 };
          updateLink(pump.id, { curve: [...curve, { flow: last.flow + 20, head: Math.max(0, last.head - 10) }] });
        }}
      >
        + Ajouter un point
      </button>
    </div>
  );
}

function nodeTypeLabel(t: string): string {
  return t === 'junction' ? 'Nœud' : t === 'reservoir' ? 'Bâche' : 'Réservoir';
}
function linkTypeLabel(t: string): string {
  return t === 'pipe' ? 'Conduite' : t === 'pump' ? 'Pompe' : 'Vanne';
}
