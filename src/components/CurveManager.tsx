import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useNetworkStore } from '../store/networkStore';
import { CurveType, CURVE_TYPE_LABELS } from '../types/network';

const AXIS: Record<CurveType, { x: string; y: string }> = {
  PUMP: { x: 'Débit', y: 'Hauteur' },
  EFFICIENCY: { x: 'Débit', y: 'Rendement (%)' },
  VOLUME: { x: 'Niveau', y: 'Volume' },
  HEADLOSS: { x: 'Débit', y: 'Perte' },
};

export default function CurveManager() {
  const open = useNetworkStore((s) => s.curveDialogOpen);
  const setOpen = useNetworkStore((s) => s.setCurveDialogOpen);
  const curves = useNetworkStore((s) => s.network.curves);
  const addCurve = useNetworkStore((s) => s.addCurve);
  const updateCurve = useNetworkStore((s) => s.updateCurve);
  const renameCurve = useNetworkStore((s) => s.renameCurve);
  const deleteCurve = useNetworkStore((s) => s.deleteCurve);
  const commit = useNetworkStore((s) => s.commit);
  const [selected, setSelected] = useState<string | null>(null);

  const ids = Object.keys(curves);
  const current = selected && curves[selected] ? curves[selected] : null;

  useEffect(() => {
    if (!open) return;
    if ((!selected || !curves[selected]) && ids.length) setSelected(ids[0]);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selected, ids, curves, setOpen]);

  if (!open) return null;

  const setPoint = (i: number, key: 'x' | 'y', v: number) => {
    if (!current) return;
    updateCurve(current.id, {
      points: current.points.map((p, idx) => (idx === i ? { ...p, [key]: v } : p)),
    });
  };

  const axis = current ? AXIS[current.type] : AXIS.PUMP;
  const chartData = current ? current.points.map((p) => ({ x: p.x, y: p.y })) : [];

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal curve-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Éditeur de courbes</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="curve-body">
          {/* Liste */}
          <div className="curve-list">
            <div className="curve-list-items">
              {ids.length === 0 && <div className="hint" style={{ padding: 8 }}>Aucune courbe.</div>}
              {ids.map((id) => (
                <button
                  key={id}
                  className={`curve-item ${selected === id ? 'active' : ''}`}
                  onClick={() => setSelected(id)}
                >
                  <strong>{id}</strong>
                  <span>{curves[id].type}</span>
                </button>
              ))}
            </div>
            <div className="curve-add">
              <select id="newCurveType" defaultValue="PUMP">
                {(Object.keys(CURVE_TYPE_LABELS) as CurveType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const sel = document.getElementById('newCurveType') as HTMLSelectElement;
                  const id = addCurve((sel?.value as CurveType) || 'PUMP');
                  setSelected(id);
                }}
              >
                + Ajouter
              </button>
            </div>
          </div>

          {/* Détail */}
          {current ? (
            <div className="curve-detail">
              <div className="curve-fields">
                <label className="field">
                  <span className="field-label">ID Courbe</span>
                  <input
                    type="text"
                    defaultValue={current.id}
                    key={current.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== current.id) {
                        renameCurve(current.id, v);
                        setSelected(v);
                      }
                    }}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Type de courbe</span>
                  <select
                    value={current.type}
                    onFocus={commit}
                    onChange={(e) => updateCurve(current.id, { type: e.target.value as CurveType })}
                  >
                    {(Object.keys(CURVE_TYPE_LABELS) as CurveType[]).map((t) => (
                      <option key={t} value={t}>{CURVE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span className="field-label">Description</span>
                <input
                  type="text"
                  value={current.description ?? ''}
                  onFocus={commit}
                  onChange={(e) => updateCurve(current.id, { description: e.target.value })}
                />
              </label>

              <div className="curve-cols2">
                <div className="curve-points">
                  <div className="curve-pts-head">
                    <span>{axis.x}</span>
                    <span>{axis.y}</span>
                    <span />
                  </div>
                  <div className="curve-pts-rows">
                    {current.points.map((p, i) => (
                      <div className="curve-pt-row" key={i}>
                        <input type="number" value={p.x} onFocus={commit} onChange={(e) => setPoint(i, 'x', parseFloat(e.target.value) || 0)} />
                        <input type="number" value={p.y} onFocus={commit} onChange={(e) => setPoint(i, 'y', parseFloat(e.target.value) || 0)} />
                        <button
                          className="curve-del"
                          onClick={() => updateCurve(current.id, { points: current.points.filter((_, idx) => idx !== i) })}
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
                      const last = current.points[current.points.length - 1] ?? { x: 0, y: 0 };
                      commit();
                      updateCurve(current.id, { points: [...current.points, { x: last.x + 10, y: last.y }] });
                    }}
                  >
                    + Point
                  </button>
                </div>

                <div className="curve-plot">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="x" type="number" tick={{ fontSize: 10 }} label={{ value: axis.x, position: 'insideBottom', offset: -8, fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} width={42} label={{ value: axis.y, angle: -90, position: 'insideLeft', fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="y" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '10px 0 0', borderTop: 'none' }}>
                <button className="btn btn-sm btn-danger" onClick={() => { deleteCurve(current.id); setSelected(null); }}>
                  Supprimer cette courbe
                </button>
              </div>
            </div>
          ) : (
            <div className="curve-detail">
              <p className="hint">Sélectionnez ou ajoutez une courbe.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
