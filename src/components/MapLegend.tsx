import { useState } from 'react';
import { ResultMetric, useNetworkStore, DEFAULT_CLASS_BREAKS } from '../store/networkStore';
import {
  colorFor,
  classColor,
  METRIC_LABELS,
  metricUnit,
  NODE_METRICS,
  LINK_METRICS,
} from '../utils/colorScale';
import { nodeDomain, linkDomain, nodeValue, linkValue } from '../utils/resultsAccess';
import { STATUS_COLOR, VELOCITY_STATUS_COLOR, pressureStatus, velocityStatus } from '../utils/compliance';
import { flowUnitLabel } from '../utils/format';

const GRADIENT_STEPS = 24;

export default function MapLegend() {
  const results = useNetworkStore((s) => s.results);
  const showOverlay = useNetworkStore((s) => s.showResultsOverlay);
  const toggleOverlay = useNetworkStore((s) => s.toggleResultsOverlay);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const nodeMetric = useNetworkStore((s) => s.nodeMetric);
  const linkMetric = useNetworkStore((s) => s.linkMetric);
  const setNodeMetric = useNetworkStore((s) => s.setNodeMetric);
  const setLinkMetric = useNetworkStore((s) => s.setLinkMetric);
  const colorMode = useNetworkStore((s) => s.colorMode);
  const setColorMode = useNetworkStore((s) => s.setColorMode);
  const network = useNetworkStore((s) => s.network);
  const criteria = network.criteria;
  const display = useNetworkStore((s) => s.display);
  const updateDisplay = useNetworkStore((s) => s.updateDisplay);
  const [collapsed, setCollapsed] = useState(false);

  if (!results) return null;

  // Comptes de conformité au pas de temps courant
  const nCount = { low: 0, ok: 0, high: 0 };
  const lCount = { low: 0, ok: 0, high: 0 };
  if (colorMode === 'compliance') {
    for (const n of Object.values(network.nodes)) {
      if (n.type !== 'junction') continue;
      const s = pressureStatus(nodeValue(results, n.id, 'pressure', timeIndex), criteria);
      if (s === 'low' || s === 'ok' || s === 'high') nCount[s]++;
    }
    for (const l of Object.values(network.links)) {
      if (l.type !== 'pipe') continue;
      const s = velocityStatus(linkValue(results, l.id, 'velocity', timeIndex), criteria);
      if (s === 'low' || s === 'ok' || s === 'high') lCount[s]++;
    }
  }

  const flowU = flowUnitLabel(results.flowUnits);
  const nDomain = nodeDomain(results, nodeMetric, timeIndex);
  const lDomain = linkDomain(results, linkMetric, timeIndex);

  const nodeUnit = metricUnit(nodeMetric, results.lengthUnit, results.pressureUnit, flowU);
  const linkUnit = metricUnit(linkMetric, results.lengthUnit, results.pressureUnit, flowU);
  const presU = results.pressureUnit;

  const setBreaks = (metric: ResultMetric, breaks: number[]) =>
    updateDisplay({ classBreaks: { ...display.classBreaks, [metric]: breaks } });

  return (
    <div className={`map-legend ${collapsed ? 'collapsed' : ''}`}>
      <div className="legend-row legend-toggle">
        <label>
          <input type="checkbox" checked={showOverlay} onChange={toggleOverlay} /> Colorer les résultats
        </label>
        <button
          className="legend-collapse"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Développer la légende' : 'Réduire la légende'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>

      {collapsed ? null : (
      <>
      <div className="legend-modes">
        <button
          className={`legend-mode ${colorMode === 'metric' ? 'active' : ''}`}
          onClick={() => setColorMode('metric')}
        >
          Valeurs
        </button>
        <button
          className={`legend-mode ${colorMode === 'compliance' ? 'active' : ''}`}
          onClick={() => setColorMode('compliance')}
        >
          Conformité
        </button>
      </div>

      {colorMode === 'metric' ? (
        <>
          <label className="legend-scalemode">
            <input
              type="checkbox"
              checked={display.colorClasses}
              onChange={(e) => updateDisplay({ colorClasses: e.target.checked })}
            />
            Intervalles fixes
          </label>

          <LegendBar
            title="Nœuds"
            metric={nodeMetric}
            metrics={NODE_METRICS}
            onMetric={setNodeMetric}
            min={nDomain.min}
            max={nDomain.max}
            unit={nodeUnit}
            classes={display.colorClasses}
            breaks={display.classBreaks[nodeMetric]}
            onBreaks={(b) => setBreaks(nodeMetric, b)}
          />
          <LegendBar
            title="Conduites"
            metric={linkMetric}
            metrics={LINK_METRICS}
            onMetric={setLinkMetric}
            min={lDomain.min}
            max={lDomain.max}
            unit={linkUnit}
            classes={display.colorClasses}
            breaks={display.classBreaks[linkMetric]}
            onBreaks={(b) => setBreaks(linkMetric, b)}
          />
        </>
      ) : (
        <div className="legend-block">
          <div className="legend-conf-title">Nœuds — pression ({presU})</div>
          <div className="legend-status">
            <span>
              <i style={{ background: STATUS_COLOR.low }} /> Insuffisante &lt; {criteria.minPressure}
              <b>{nCount.low}</b>
            </span>
            <span>
              <i style={{ background: STATUS_COLOR.ok }} /> Conforme {criteria.minPressure}–
              {criteria.maxPressure}
              <b>{nCount.ok}</b>
            </span>
            <span>
              <i style={{ background: STATUS_COLOR.high }} /> Excessive &gt; {criteria.maxPressure}
              <b>{nCount.high}</b>
            </span>
          </div>

          <div className="legend-conf-title" style={{ marginTop: 10 }}>
            Conduites — vitesse ({results.lengthUnit}/s)
          </div>
          <div className="legend-status">
            <span>
              <i style={{ background: VELOCITY_STATUS_COLOR.low }} /> Trop faible &lt;{' '}
              {criteria.minVelocity}
              <b>{lCount.low}</b>
            </span>
            <span>
              <i style={{ background: VELOCITY_STATUS_COLOR.ok }} /> Correcte
              <b>{lCount.ok}</b>
            </span>
            <span>
              <i style={{ background: VELOCITY_STATUS_COLOR.high }} /> Trop élevée &gt;{' '}
              {criteria.maxVelocity}
              <b>{lCount.high}</b>
            </span>
          </div>
          <div className="legend-criteria">
            Seuils modifiables dans <strong>Paramètres ▸ Conformité</strong>.
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function LegendBar({
  title,
  metric,
  metrics,
  onMetric,
  min,
  max,
  unit,
  classes,
  breaks,
  onBreaks,
}: {
  title: string;
  metric: ResultMetric;
  metrics: ResultMetric[];
  onMetric: (m: ResultMetric) => void;
  min: number;
  max: number;
  unit: string;
  classes: boolean;
  breaks: number[];
  onBreaks: (b: number[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(breaks.join(', '));
    setEditing(true);
  };
  const commit = () => {
    const b = draft
      .split(/[,;\s]+/)
      .map((s) => parseFloat(s))
      .filter((n) => isFinite(n))
      .sort((a, b) => a - b);
    if (b.length) onBreaks(b);
    setEditing(false);
  };

  return (
    <div className="legend-block">
      <div className="legend-head">
        <span className="legend-title">{title}</span>
        <select value={metric} onChange={(e) => onMetric(e.target.value as ResultMetric)}>
          {metrics.map((m) => (
            <option key={m} value={m}>
              {METRIC_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {classes ? (
        <>
          <div className="legend-classes">
            {[...breaks, Infinity].map((b, i) => {
              const lo = i === 0 ? null : breaks[i - 1];
              const label =
                i === 0
                  ? `< ${breaks[0]}`
                  : b === Infinity
                    ? `≥ ${breaks[breaks.length - 1]}`
                    : `${lo} – ${b}`;
              return (
                <span key={i} className="legend-class">
                  <i style={{ background: classColor(i, breaks.length + 1) }} />
                  {label}
                </span>
              );
            })}
          </div>
          <div className="legend-class-foot">
            <span className="legend-unit">{unit}</span>
            {editing ? (
              <span className="legend-edit">
                <input
                  type="text"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  placeholder="ex. 10, 20, 40, 60"
                />
                <button className="link-btn" onClick={commit}>OK</button>
              </span>
            ) : (
              <span className="legend-edit-actions">
                <button className="link-btn" onClick={startEdit}>Seuils…</button>
                <button
                  className="link-btn"
                  onClick={() => onBreaks([...DEFAULT_CLASS_BREAKS[metric]])}
                  title="Réinitialiser les seuils par défaut"
                >
                  ↺
                </button>
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="legend-gradient">
            {Array.from({ length: GRADIENT_STEPS }, (_, i) => (
              <span key={i} style={{ background: colorFor(i / (GRADIENT_STEPS - 1)) }} />
            ))}
          </div>
          <div className="legend-scale">
            <span>{min.toFixed(1)}</span>
            <span className="legend-unit">{unit}</span>
            <span>{max.toFixed(1)}</span>
          </div>
        </>
      )}
    </div>
  );
}
