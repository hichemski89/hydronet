import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useNetworkStore } from '../store/networkStore';

export default function PatternManager() {
  const open = useNetworkStore((s) => s.patternDialogOpen);
  const setOpen = useNetworkStore((s) => s.setPatternDialogOpen);
  const patterns = useNetworkStore((s) => s.network.patterns);
  const addPattern = useNetworkStore((s) => s.addPattern);
  const updatePattern = useNetworkStore((s) => s.updatePattern);
  const renamePattern = useNetworkStore((s) => s.renamePattern);
  const deletePattern = useNetworkStore((s) => s.deletePattern);
  const commit = useNetworkStore((s) => s.commit);
  const [selected, setSelected] = useState<string | null>(null);

  const ids = Object.keys(patterns);
  const current = selected && patterns[selected] ? patterns[selected] : null;

  useEffect(() => {
    if (!open) return;
    if ((!selected || !patterns[selected]) && ids.length) setSelected(ids[0]);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selected, ids, patterns, setOpen]);

  if (!open) return null;

  const stepH = 1; // pas de modulation EPANET : 1 h par coefficient
  const setMul = (i: number, v: number) => {
    if (!current) return;
    updatePattern(current.id, {
      multipliers: current.multipliers.map((m, idx) => (idx === i ? v : m)),
    });
  };

  const chartData = current
    ? current.multipliers.map((m, i) => ({ t: +(i * stepH).toFixed(2), m }))
    : [];

  const fmtTime = (i: number) => {
    const h = i * stepH;
    const hh = Math.floor(h) % 24;
    const mm = Math.round((h - Math.floor(h)) * 60);
    return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
  };

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal curve-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Courbes de modulation</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="curve-body">
          {/* Liste */}
          <div className="curve-list">
            <div className="curve-list-items">
              {ids.length === 0 && (
                <div className="hint" style={{ padding: 8 }}>Aucune modulation.</div>
              )}
              {ids.map((id) => (
                <button
                  key={id}
                  className={`curve-item ${selected === id ? 'active' : ''}`}
                  onClick={() => setSelected(id)}
                >
                  <strong>{id}</strong>
                  <span>{patterns[id].multipliers.length} pas</span>
                </button>
              ))}
            </div>
            <div className="curve-add">
              <button
                className="btn btn-sm btn-primary"
                style={{ width: '100%' }}
                onClick={() => setSelected(addPattern())}
              >
                + Nouvelle modulation
              </button>
            </div>
          </div>

          {/* Détail */}
          {current ? (
            <div className="curve-detail">
              <div className="curve-fields">
                <label className="field">
                  <span className="field-label">Identifiant</span>
                  <input
                    type="text"
                    defaultValue={current.id}
                    key={current.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== current.id) {
                        renamePattern(current.id, v);
                        setSelected(v);
                      }
                    }}
                  />
                </label>
                <div className="field">
                  <span className="field-label">Pas de temps</span>
                  <div style={{ padding: '6px 0', fontSize: 13 }}>1 h / coefficient</div>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                Chaque coefficient multiplie la demande (ou la vitesse de pompe) pendant un pas de
                temps hydraulique. Coefficient 1 = valeur de base ; 1,5 = +50 %.
              </p>

              <div className="curve-cols2">
                <div className="curve-points">
                  <div className="curve-pts-head">
                    <span>Heure</span>
                    <span>Coefficient</span>
                    <span />
                  </div>
                  <div className="curve-pts-rows">
                    {current.multipliers.map((m, i) => (
                      <div className="curve-pt-row" key={i}>
                        <input type="text" value={fmtTime(i)} readOnly tabIndex={-1} className="pat-time" />
                        <input
                          type="number"
                          step={0.05}
                          min={0}
                          value={m}
                          onFocus={commit}
                          onChange={(e) => setMul(i, Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                        <button
                          className="curve-del"
                          title="Supprimer ce pas"
                          onClick={() => {
                            commit();
                            updatePattern(current.id, {
                              multipliers: current.multipliers.filter((_, idx) => idx !== i),
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ width: '100%', marginTop: 6 }}
                    onClick={() => {
                      const last = current.multipliers[current.multipliers.length - 1] ?? 1;
                      commit();
                      updatePattern(current.id, { multipliers: [...current.multipliers, last] });
                    }}
                  >
                    + Pas de temps
                  </button>
                </div>

                <div className="curve-plot">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        tick={{ fontSize: 10 }}
                        label={{ value: 'Heures', position: 'insideBottom', offset: -8, fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 10 }} width={42} />
                      <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => Number(v).toFixed(2)} />
                      <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Bar dataKey="m" fill="#1d4ed8" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '10px 0 0', borderTop: 'none' }}>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    deletePattern(current.id);
                    setSelected(null);
                  }}
                >
                  Supprimer cette modulation
                </button>
              </div>
            </div>
          ) : (
            <div className="curve-detail">
              <p className="hint">Sélectionnez ou créez une courbe de modulation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
