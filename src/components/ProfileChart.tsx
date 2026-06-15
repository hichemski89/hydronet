import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useNetworkStore } from '../store/networkStore';
import { computeProfile } from '../utils/profile';
import { fmt } from '../utils/format';

export default function ProfileChart() {
  const network = useNetworkStore((s) => s.network);
  const results = useNetworkStore((s) => s.results);
  const profilePath = useNetworkStore((s) => s.profilePath);
  const clearProfile = useNetworkStore((s) => s.clearProfile);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);

  if (profilePath.length < 1) return null;

  const points = computeProfile(network, results, profilePath, timeIndex);
  const lenU = results?.lengthUnit ?? 'm';
  const presU = results?.pressureUnit ?? 'm';

  const data = points.map((p) => ({
    name: p.id,
    distance: Math.round(p.distance),
    Terrain: round(p.ground),
    'Ligne piézométrique': p.head != null ? round(p.head) : null,
    pressure: p.pressure,
  }));

  const minPressure =
    results && points.length
      ? Math.min(...points.map((p) => (p.pressure ?? Infinity)).filter((v) => isFinite(v)))
      : NaN;

  return (
    <div className="profile-drawer">
      <div className="profile-header">
        <div>
          <strong>Profil en long</strong>
          <span className="profile-sub">
            {profilePath.length} nœud{profilePath.length > 1 ? 's' : ''}
            {results && isFinite(minPressure) && ` · pression min ${fmt(minPressure, 1)} ${presU}`}
          </span>
        </div>
        <div className="profile-actions">
          {!results && <span className="hint" style={{ margin: 0 }}>Lancez une simulation pour la ligne piézométrique.</span>}
          <button className="btn btn-sm" onClick={clearProfile}>
            Effacer le tracé
          </button>
        </div>
      </div>
      <div className="profile-body">
        {profilePath.length < 2 ? (
          <div className="profile-empty">Cliquez d’autres nœuds sur la carte pour étendre le profil.</div>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="distance"
                type="number"
                tick={{ fontSize: 10 }}
                label={{ value: `Distance (${lenU})`, position: 'insideBottomRight', offset: -2, fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} width={46} label={{ value: lenU, angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} labelFormatter={(d) => `Distance : ${d} ${lenU}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="Terrain"
                stroke="#a16207"
                fill="#fde68a"
                fillOpacity={0.6}
                isAnimationActive={false}
              />
              {results && (
                <Line
                  type="monotone"
                  dataKey="Ligne piézométrique"
                  stroke="#1d4ed8"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
