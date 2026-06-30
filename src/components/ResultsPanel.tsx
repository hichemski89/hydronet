import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useNetworkStore } from '../store/networkStore';
import { formatClock, flowUnitLabel } from '../utils/format';
import { fmt } from '../utils/format';
import { collectViolations } from '../utils/compliance';

export default function ResultsPanel() {
  const results = useNetworkStore((s) => s.results);
  const selection = useNetworkStore((s) => s.selection);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const network = useNetworkStore((s) => s.network);

  if (!results) {
    return (
      <div className="results-panel empty">
        <p className="hint">Lancez une simulation pour visualiser les résultats.</p>
      </div>
    );
  }

  const flowU = flowUnitLabel(results.flowUnits);
  const lenU = results.lengthUnit;
  const presU = results.pressureUnit;
  const extended = results.times.length > 1;

  if (!selection) {
    return (
      <div className="results-panel">
        <h3 className="props-title">Résultats</h3>
        <p className="hint">Sélectionnez un nœud ou une conduite pour afficher l’évolution temporelle.</p>
        <SummaryStats />
        <ComplianceSummary />
      </div>
    );
  }

  if (selection.kind === 'node') {
    const r = results.nodes[selection.id];
    if (!r) return null;
    const data = results.times.map((t, i) => ({
      t: formatClock(t),
      Pression: round(r.pressure[i]),
      Charge: round(r.head[i]),
      Demande: round(r.demand[i]),
    }));
    return (
      <div className="results-panel">
        <h3 className="props-title">Résultats — {selection.id}</h3>
        <CurrentValues
          rows={[
            [`Pression (${presU})`, fmt(r.pressure[timeIndex])],
            [`Charge (${lenU})`, fmt(r.head[timeIndex])],
            [`Demande (${flowU})`, fmt(r.demand[timeIndex])],
          ]}
        />
        {extended && (
          <>
            <ChartBlock
              title={`Pression (${presU})`}
              data={data}
              keys={['Pression']}
              colors={['#1d4ed8']}
              activeLabel={data[timeIndex]?.t}
            />
            <ChartBlock
              title={`Demande (${flowU})`}
              data={data}
              keys={['Demande']}
              colors={['#0891b2']}
              activeLabel={data[timeIndex]?.t}
            />
          </>
        )}
      </div>
    );
  }

  const r = results.links[selection.id];
  if (!r) return null;
  const link = network.links[selection.id];
  const data = results.times.map((t, i) => ({
    t: formatClock(t),
    Débit: round(r.flow[i]),
    Vitesse: round(r.velocity[i]),
    Perte: round(r.headloss[i]),
  }));
  return (
    <div className="results-panel">
      <h3 className="props-title">Résultats — {selection.id}</h3>
      <CurrentValues
        rows={[
          [`Débit (${flowU})`, fmt(r.flow[timeIndex])],
          [`Vitesse (${lenU}/s)`, fmt(r.velocity[timeIndex])],
          [`Perte de charge (${lenU})`, fmt(r.headloss[timeIndex])],
          ...(link?.type === 'pipe'
            ? [['Perte unitaire (m/km)', fmt(((r.headloss[timeIndex] ?? 0) / (link.length || 1)) * 1000)] as [string, string]]
            : []),
        ]}
      />
      {extended && (
        <>
          <ChartBlock title={`Débit (${flowU})`} data={data} keys={['Débit']} colors={['#1d4ed8']} activeLabel={data[timeIndex]?.t} />
          <ChartBlock title={`Vitesse (${lenU}/s)`} data={data} keys={['Vitesse']} colors={['#ca0020']} activeLabel={data[timeIndex]?.t} />
        </>
      )}
    </div>
  );
}

function round(v: number | undefined): number | null {
  return v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000;
}

function CurrentValues({ rows }: { rows: [string, string][] }) {
  return (
    <table className="value-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td className="value-cell">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartBlock({
  title,
  data,
  keys,
  colors,
  activeLabel,
}: {
  title: string;
  data: Record<string, string | number | null>[];
  keys: string[];
  colors: string[];
  activeLabel?: string;
}) {
  // Format compact des graduations de l'axe Y : évite des libellés trop longs
  // (et donc tronqués) tout en restant lisible pour les valeurs négatives.
  const fmtTick = (v: number) => {
    if (v == null || !isFinite(v)) return '';
    const a = Math.abs(v);
    return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  };
  return (
    <div className="chart-block">
      <div className="chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="t" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9 }} width={48} tickFormatter={fmtTick} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          {activeLabel && <ReferenceLine x={activeLabel} stroke="#1d4ed8" strokeDasharray="4 2" />}
          {/* Repère du zéro : utile quand le débit change de sens (valeurs négatives) */}
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={colors[i]} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComplianceSummary() {
  const results = useNetworkStore((s) => s.results)!;
  const network = useNetworkStore((s) => s.network);
  const select = useNetworkStore((s) => s.select);
  const setColorMode = useNetworkStore((s) => s.setColorMode);
  const setTimeIndex = useNetworkStore((s) => s.setCurrentTimeIndex);
  const report = collectViolations(network, results);
  const presU = results.pressureUnit;
  const lenU = results.lengthUnit;

  const total = report.violations.length;

  return (
    <div className="compliance-summary">
      <div className="compliance-head">
        <h4>Conformité</h4>
        <button className="btn btn-sm" onClick={() => setColorMode('compliance')}>
          Voir sur la carte
        </button>
      </div>
      {total === 0 ? (
        <div className="compliance-ok">
          ✓ Tous les nœuds ({report.nodesChecked}) et conduites ({report.linksChecked}) sont conformes.
        </div>
      ) : (
        <>
          <div className="compliance-count">
            {total} non-conformité{total > 1 ? 's' : ''} détectée{total > 1 ? 's' : ''}
          </div>
          <ul className="violation-list">
            {report.violations.slice(0, 12).map((v, i) => (
              <li
                key={i}
                className={`viol viol-${v.kind}`}
                onClick={() => {
                  select({ kind: v.type === 'Nœud' ? 'node' : 'link', id: v.id });
                  setTimeIndex(v.timeIndex);
                }}
                title="Cliquer pour localiser et se placer à l’instant critique"
              >
                <span className="viol-id">{v.id}</span>
                <span className="viol-desc">
                  {v.metric} {v.kind === 'low' ? '<' : '>'} {v.threshold}
                  {v.metric === 'pression' ? ` ${presU}` : ` ${lenU}/s`} → {v.value.toFixed(1)} à{' '}
                  {formatClock(v.time)}
                </span>
              </li>
            ))}
          </ul>
          {total > 12 && <div className="hint">… et {total - 12} autre(s).</div>}
        </>
      )}
    </div>
  );
}

function SummaryStats() {
  const results = useNetworkStore((s) => s.results)!;
  const network = useNetworkStore((s) => s.network);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const presU = results.pressureUnit;
  const lenU = results.lengthUnit;

  // Pression : uniquement aux nœuds de demande (jonctions). Les bâches et
  // réservoirs sont à charge imposée — leur « pression » (souvent 0) fausserait
  // le minimum recherché par l'utilisateur.
  const pressures = Object.entries(results.nodes)
    .filter(([id]) => network.nodes[id]?.type === 'junction')
    .map(([, n]) => n.pressure[timeIndex])
    .filter((v) => isFinite(v));
  // Vitesse : uniquement dans les conduites (les pompes ont une vitesse nulle,
  // ce qui fausserait le minimum).
  const velocities = Object.entries(results.links)
    .filter(([id]) => network.links[id]?.type === 'pipe')
    .map(([, l]) => l.velocity[timeIndex])
    .filter((v) => isFinite(v));

  const minP = pressures.length ? Math.min(...pressures) : NaN;
  const maxP = pressures.length ? Math.max(...pressures) : NaN;
  const minV = velocities.length ? Math.min(...velocities) : NaN;
  const maxV = velocities.length ? Math.max(...velocities) : NaN;

  return (
    <div className="summary-stats">
      <div className="stat-card">
        <div className="stat-value">{fmt(minP, 1)}</div>
        <div className="stat-label">Pression min ({presU})</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(maxP, 1)}</div>
        <div className="stat-label">Pression max ({presU})</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(minV, 2)}</div>
        <div className="stat-label">Vitesse min ({lenU}/s)</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(maxV, 2)}</div>
        <div className="stat-label">Vitesse max ({lenU}/s)</div>
      </div>
    </div>
  );
}
