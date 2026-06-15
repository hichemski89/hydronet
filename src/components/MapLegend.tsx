import { ResultMetric, useNetworkStore } from '../store/networkStore';
import { colorFor, METRIC_LABELS, metricUnit, NODE_METRICS, LINK_METRICS } from '../utils/colorScale';
import { nodeDomain, linkDomain } from '../utils/resultsAccess';
import { STATUS_COLOR } from '../utils/compliance';
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
  const criteria = useNetworkStore((s) => s.network.criteria);

  if (!results) return null;

  const flowU = flowUnitLabel(results.flowUnits);
  const nDomain = nodeDomain(results, nodeMetric, timeIndex);
  const lDomain = linkDomain(results, linkMetric, timeIndex);

  const nodeUnit = metricUnit(nodeMetric, results.lengthUnit, results.pressureUnit, flowU);
  const linkUnit = metricUnit(linkMetric, results.lengthUnit, results.pressureUnit, flowU);
  const presU = results.pressureUnit;

  return (
    <div className="map-legend">
      <div className="legend-row legend-toggle">
        <label>
          <input type="checkbox" checked={showOverlay} onChange={toggleOverlay} /> Colorer les résultats
        </label>
      </div>

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
          <LegendBar
            title="Nœuds"
            metric={nodeMetric}
            metrics={NODE_METRICS}
            onMetric={setNodeMetric}
            min={nDomain.min}
            max={nDomain.max}
            unit={nodeUnit}
          />
          <LegendBar
            title="Conduites"
            metric={linkMetric}
            metrics={LINK_METRICS}
            onMetric={setLinkMetric}
            min={lDomain.min}
            max={lDomain.max}
            unit={linkUnit}
          />
        </>
      ) : (
        <div className="legend-block">
          <div className="legend-status">
            <span><i style={{ background: STATUS_COLOR.ok }} /> Conforme</span>
            <span><i style={{ background: STATUS_COLOR.low }} /> Insuffisant</span>
            <span><i style={{ background: STATUS_COLOR.high }} /> Excessif</span>
          </div>
          <div className="legend-criteria">
            Pression : {criteria.minPressure}–{criteria.maxPressure} {presU} · Vitesse max :{' '}
            {criteria.maxVelocity} {results.lengthUnit}/s
          </div>
        </div>
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
}: {
  title: string;
  metric: ResultMetric;
  metrics: ResultMetric[];
  onMetric: (m: ResultMetric) => void;
  min: number;
  max: number;
  unit: string;
}) {
  const gradient = Array.from({ length: GRADIENT_STEPS }, (_, i) =>
    colorFor(i / (GRADIENT_STEPS - 1)),
  );
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
      <div className="legend-gradient">
        {gradient.map((c, i) => (
          <span key={i} style={{ background: c }} />
        ))}
      </div>
      <div className="legend-scale">
        <span>{min.toFixed(1)}</span>
        <span className="legend-unit">{unit}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}
