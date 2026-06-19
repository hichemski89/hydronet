import { useEffect, useMemo, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { isUSUnits, Network, SimulationResults } from '../types/network';

type Family = 'nodes' | 'junctions' | 'pipes' | 'pumps' | 'valves' | 'links';
type Agg = 'current' | 'max' | 'min' | 'avg';
type Op = 'lt' | 'le' | 'eq' | 'ge' | 'gt' | 'between' | 'contains';
type Combine = 'new' | 'add' | 'remove';

const FAMILIES: { id: Family; label: string; kind: 'node' | 'link' }[] = [
  { id: 'nodes', label: 'Tous les nœuds', kind: 'node' },
  { id: 'junctions', label: 'Jonctions', kind: 'node' },
  { id: 'pipes', label: 'Conduites', kind: 'link' },
  { id: 'pumps', label: 'Pompes', kind: 'link' },
  { id: 'valves', label: 'Vannes', kind: 'link' },
  { id: 'links', label: 'Tous les liens', kind: 'link' },
];

interface PropDef {
  id: string;
  label: string;
  /** D'où vient la valeur : série de résultats nœud/lien, ou champ statique. */
  source: 'node-res' | 'link-res' | 'static-num' | 'static-str';
  resKey?: 'pressure' | 'head' | 'demand' | 'velocity' | 'flow' | 'headloss';
  unit?: (us: boolean) => string;
}

const presU = (us: boolean) => (us ? 'psi' : 'm');
const lenU = (us: boolean) => (us ? 'ft' : 'm');
const velU = (us: boolean) => (us ? 'ft/s' : 'm/s');

const NODE_PROPS: PropDef[] = [
  { id: 'pressure', label: 'Pression', source: 'node-res', resKey: 'pressure', unit: presU },
  { id: 'head', label: 'Charge', source: 'node-res', resKey: 'head', unit: lenU },
  { id: 'demand', label: 'Demande', source: 'node-res', resKey: 'demand' },
  { id: 'elevation', label: 'Altitude / cote', source: 'static-num', unit: lenU },
];

const PIPE_PROPS: PropDef[] = [
  { id: 'velocity', label: 'Vitesse', source: 'link-res', resKey: 'velocity', unit: velU },
  { id: 'flow', label: 'Débit', source: 'link-res', resKey: 'flow' },
  { id: 'headloss', label: 'Perte de charge', source: 'link-res', resKey: 'headloss', unit: lenU },
  { id: 'diameter', label: 'Diamètre intérieur (mm)', source: 'static-num' },
  { id: 'length', label: 'Longueur', source: 'static-num', unit: lenU },
  { id: 'material', label: 'Matériau', source: 'static-str' },
];

const PUMP_PROPS: PropDef[] = [
  { id: 'flow', label: 'Débit', source: 'link-res', resKey: 'flow' },
  { id: 'headloss', label: 'Hauteur fournie', source: 'link-res', resKey: 'headloss', unit: lenU },
];

const VALVE_PROPS: PropDef[] = [
  { id: 'flow', label: 'Débit', source: 'link-res', resKey: 'flow' },
  { id: 'velocity', label: 'Vitesse', source: 'link-res', resKey: 'velocity', unit: velU },
  { id: 'diameter', label: 'Diamètre (mm)', source: 'static-num' },
];

const LINK_PROPS: PropDef[] = [
  { id: 'flow', label: 'Débit', source: 'link-res', resKey: 'flow' },
  { id: 'velocity', label: 'Vitesse', source: 'link-res', resKey: 'velocity', unit: velU },
];

function propsFor(f: Family): PropDef[] {
  switch (f) {
    case 'nodes':
    case 'junctions':
      return NODE_PROPS;
    case 'pipes':
      return PIPE_PROPS;
    case 'pumps':
      return PUMP_PROPS;
    case 'valves':
      return VALVE_PROPS;
    case 'links':
      return LINK_PROPS;
  }
}

const OPS: { id: Op; label: string }[] = [
  { id: 'lt', label: '<' },
  { id: 'le', label: '≤' },
  { id: 'eq', label: '=' },
  { id: 'ge', label: '≥' },
  { id: 'gt', label: '>' },
  { id: 'between', label: 'entre' },
];

function aggregate(arr: number[] | undefined, agg: Agg, ti: number): number | undefined {
  if (!arr || arr.length === 0) return undefined;
  switch (agg) {
    case 'current':
      return arr[Math.min(ti, arr.length - 1)];
    case 'max':
      return Math.max(...arr);
    case 'min':
      return Math.min(...arr);
    case 'avg':
      return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

/** Calcule la liste des identifiants correspondant au filtre. */
function evaluate(
  network: Network,
  results: SimulationResults | null,
  ti: number,
  family: Family,
  prop: PropDef,
  agg: Agg,
  op: Op,
  v1: number,
  v2: number,
  text: string,
): { ids: string[]; kind: 'node' | 'link'; needsResults: boolean } {
  const fam = FAMILIES.find((f) => f.id === family)!;
  const needsResults = prop.source === 'node-res' || prop.source === 'link-res';

  const matchNum = (x: number | undefined): boolean => {
    if (x == null || Number.isNaN(x)) return false;
    switch (op) {
      case 'lt':
        return x < v1;
      case 'le':
        return x <= v1;
      case 'eq':
        return Math.abs(x - v1) < 1e-9;
      case 'ge':
        return x >= v1;
      case 'gt':
        return x > v1;
      case 'between':
        return x >= Math.min(v1, v2) && x <= Math.max(v1, v2);
      default:
        return false;
    }
  };

  const ids: string[] = [];

  if (fam.kind === 'node') {
    for (const n of Object.values(network.nodes)) {
      if (family === 'junctions' && n.type !== 'junction') continue;
      let ok = false;
      if (prop.source === 'node-res') {
        const series = results?.nodes[n.id]?.[prop.resKey as 'pressure'];
        let x = aggregate(series, agg, ti);
        if (x != null && prop.resKey === 'demand') x = Math.abs(x);
        ok = matchNum(x);
      } else if (prop.id === 'elevation') {
        const e =
          n.type === 'junction' ? n.elevation : n.type === 'tank' ? n.elevation : undefined;
        ok = matchNum(e);
      }
      if (ok) ids.push(n.id);
    }
    return { ids, kind: 'node', needsResults };
  }

  // liens
  for (const l of Object.values(network.links)) {
    if (family === 'pipes' && l.type !== 'pipe') continue;
    if (family === 'pumps' && l.type !== 'pump') continue;
    if (family === 'valves' && l.type !== 'valve') continue;
    let ok = false;
    if (prop.source === 'link-res') {
      const series = results?.links[l.id]?.[prop.resKey as 'flow'];
      let x = aggregate(series, agg, ti);
      if (x != null && (prop.resKey === 'velocity' || prop.resKey === 'flow')) x = Math.abs(x);
      ok = matchNum(x);
    } else if (prop.source === 'static-num') {
      const v =
        prop.id === 'diameter'
          ? (l as { diameter?: number }).diameter
          : prop.id === 'length'
            ? (l as { length?: number }).length
            : undefined;
      ok = matchNum(v);
    } else if (prop.source === 'static-str') {
      const mat = ((l as { material?: string }).material ?? '').toLowerCase();
      ok = text.trim() !== '' && mat.includes(text.trim().toLowerCase());
    }
    if (ok) ids.push(l.id);
  }
  return { ids, kind: 'link', needsResults };
}

export default function SelectByFilterDialog() {
  const open = useNetworkStore((s) => s.selectDialogOpen);
  const setOpen = useNetworkStore((s) => s.setSelectDialogOpen);
  const network = useNetworkStore((s) => s.network);
  const results = useNetworkStore((s) => s.results);
  const ti = useNetworkStore((s) => s.currentTimeIndex);
  const setMultiSelection = useNetworkStore((s) => s.setMultiSelection);
  const selNodes = useNetworkStore((s) => s.selNodes);
  const selLinks = useNetworkStore((s) => s.selLinks);

  const us = isUSUnits(network.options.flowUnits);
  const [family, setFamily] = useState<Family>('pipes');
  const [propId, setPropId] = useState('velocity');
  const [agg, setAgg] = useState<Agg>('current');
  const [op, setOp] = useState<Op>('lt');
  const [v1, setV1] = useState(0.3);
  const [v2, setV2] = useState(1);
  const [text, setText] = useState('');
  const [combine, setCombine] = useState<Combine>('new');

  const props = propsFor(family);
  const prop = props.find((p) => p.id === propId) ?? props[0];

  // recadre la propriété si elle n'existe pas dans la nouvelle famille
  useEffect(() => {
    if (!props.find((p) => p.id === propId)) setPropId(props[0].id);
  }, [family]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const result = useMemo(
    () => evaluate(network, results, ti, family, prop, agg, op, v1, v2, text),
    [network, results, ti, family, prop, agg, op, v1, v2, text],
  );

  if (!open) return null;

  const isStr = prop.source === 'static-str';
  const isRes = prop.source === 'node-res' || prop.source === 'link-res';
  const unit = prop.unit ? prop.unit(us) : prop.id === 'flow' || prop.id === 'demand' ? network.options.flowUnits : '';

  const apply = () => {
    let nodes = result.kind === 'node' ? result.ids : [];
    let links = result.kind === 'link' ? result.ids : [];
    if (combine === 'add') {
      nodes = Array.from(new Set([...selNodes, ...nodes]));
      links = Array.from(new Set([...selLinks, ...links]));
    } else if (combine === 'remove') {
      const rmN = new Set(result.kind === 'node' ? result.ids : []);
      const rmL = new Set(result.kind === 'link' ? result.ids : []);
      nodes = selNodes.filter((id) => !rmN.has(id));
      links = selLinks.filter((id) => !rmL.has(id));
    }
    setMultiSelection(nodes, links);
    setOpen(false);
  };

  const noResultsWarning = result.needsResults && !results;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Sélection par filtre</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="modal-body">
          <label className="set-field">
            <span className="set-label">Famille d’éléments</span>
            <span className="set-input">
              <select value={family} onChange={(e) => setFamily(e.target.value as Family)}>
                {FAMILIES.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </span>
          </label>

          <label className="set-field">
            <span className="set-label">Propriété</span>
            <span className="set-input">
              <select value={prop.id} onChange={(e) => setPropId(e.target.value)}>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </span>
          </label>

          {isRes && (
            <label className="set-field">
              <span className="set-label">
                Valeur évaluée
                <em className="set-hint">sur la simulation</em>
              </span>
              <span className="set-input">
                <select value={agg} onChange={(e) => setAgg(e.target.value as Agg)}>
                  <option value="current">Au pas de temps affiché</option>
                  <option value="max">Maximum sur la période</option>
                  <option value="min">Minimum sur la période</option>
                  <option value="avg">Moyenne sur la période</option>
                </select>
              </span>
            </label>
          )}

          {isStr ? (
            <label className="set-field">
              <span className="set-label">Contient le texte</span>
              <span className="set-input">
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex. PEHD" style={{ width: 150, textAlign: 'left' }} />
              </span>
            </label>
          ) : (
            <>
              <label className="set-field">
                <span className="set-label">Condition</span>
                <span className="set-input">
                  <select value={op} onChange={(e) => setOp(e.target.value as Op)}>
                    {OPS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  <input type="number" value={v1} step="any" onChange={(e) => setV1(parseFloat(e.target.value) || 0)} />
                  {unit && <span className="set-suffix">{unit}</span>}
                </span>
              </label>
              {op === 'between' && (
                <label className="set-field">
                  <span className="set-label">et</span>
                  <span className="set-input">
                    <input type="number" value={v2} step="any" onChange={(e) => setV2(parseFloat(e.target.value) || 0)} />
                    {unit && <span className="set-suffix">{unit}</span>}
                  </span>
                </label>
              )}
            </>
          )}

          <label className="set-field">
            <span className="set-label">Mode de sélection</span>
            <span className="set-input">
              <select value={combine} onChange={(e) => setCombine(e.target.value as Combine)}>
                <option value="new">Nouvelle sélection</option>
                <option value="add">Ajouter à la sélection</option>
                <option value="remove">Retirer de la sélection</option>
              </select>
            </span>
          </label>

          {noResultsWarning ? (
            <p className="hint" style={{ color: 'var(--danger)', marginBottom: 0 }}>
              ⚠ Cette propriété nécessite des résultats : lancez d’abord une simulation.
            </p>
          ) : (
            <p className="hint" style={{ marginBottom: 0 }}>
              <strong>{result.ids.length}</strong> élément(s) correspondent au filtre.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => setOpen(false)}>Annuler</button>
          <button
            className="btn btn-primary"
            onClick={apply}
            disabled={noResultsWarning || (combine === 'new' && result.ids.length === 0)}
          >
            Sélectionner ({result.ids.length})
          </button>
        </div>
      </div>
    </div>
  );
}
