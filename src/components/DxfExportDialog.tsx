import { useState, useEffect } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { buildDxf } from '../engine/dxfExport';

const SCALES = [0, 100, 200, 500, 1000, 2000, 5000];

export default function DxfExportDialog() {
  const open = useNetworkStore((s) => s.dxfDialogOpen);
  const setOpen = useNetworkStore((s) => s.setDxfDialogOpen);
  const network = useNetworkStore((s) => s.network);
  const results = useNetworkStore((s) => s.results);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const metersPerUnit = useNetworkStore((s) => s.metersPerUnit);
  const [scale, setScale] = useState(500);
  const [textMm, setTextMm] = useState(2.5);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const doExport = () => {
    const dxf = buildDxf(network, results, timeIndex, metersPerUnit, scale, textMm);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(network.meta.name || 'reseau').replace(/[^\w\-]+/g, '_')}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  // Aperçu de la hauteur de texte résultante (en unités du dessin)
  const thModel = scale > 0 ? ((textMm / 1000) * scale) / (metersPerUnit || 1) : null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" style={{ width: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Exporter en DXF</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span className="field-label">Échelle de tracé</span>
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              <option value={0}>Auto (adapté à l’emprise)</option>
              {SCALES.filter((s) => s > 0).map((s) => (
                <option key={s} value={s}>1 : {s}</option>
              ))}
            </select>
          </label>

          {scale > 0 && (
            <>
              <label className="field">
                <span className="field-label">
                  Échelle personnalisée (1 : N)
                </span>
                <input
                  type="number"
                  min={1}
                  step={50}
                  value={scale}
                  onChange={(e) => setScale(Math.max(1, parseFloat(e.target.value) || 1))}
                />
              </label>
              <label className="field">
                <span className="field-label">Hauteur du texte sur le plan (mm)</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={textMm}
                  onChange={(e) => setTextMm(Math.max(0.5, parseFloat(e.target.value) || 2.5))}
                />
              </label>
              <p className="hint" style={{ marginTop: 0 }}>
                À 1:{scale}, le texte mesurera ≈ <strong>{thModel?.toFixed(2)}</strong> unité(s) du
                dessin. Les symboles s’adaptent à la même échelle.
                {metersPerUnit !== 1 && ` (échelle du fond : ${metersPerUnit} m/unité)`}
              </p>
            </>
          )}
          {scale === 0 && (
            <p className="hint" style={{ marginTop: 0 }}>
              Les tailles sont calculées automatiquement d’après l’étendue du réseau.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setOpen(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={doExport}>Exporter le DXF</button>
        </div>
      </div>
    </div>
  );
}
