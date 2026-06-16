import { useRef } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { parseDxf } from '../engine/dxfImport';
import { readFileAsText } from '../engine/projectIO';

export default function BackdropPanel() {
  const open = useNetworkStore((s) => s.backdropPanelOpen);
  const setOpen = useNetworkStore((s) => s.setBackdropPanelOpen);
  const backdrop = useNetworkStore((s) => s.backdrop);
  const setBackdrop = useNetworkStore((s) => s.setBackdrop);
  const clearBackdrop = useNetworkStore((s) => s.clearBackdrop);
  const updateBackdrop = useNetworkStore((s) => s.updateBackdrop);
  const toggleLayer = useNetworkStore((s) => s.toggleLayer);
  const setAllLayers = useNetworkStore((s) => s.setAllLayers);
  const metersPerUnit = useNetworkStore((s) => s.metersPerUnit);
  const setMetersPerUnit = useNetworkStore((s) => s.setMetersPerUnit);
  const autoLength = useNetworkStore((s) => s.autoLength);
  const setAutoLength = useNetworkStore((s) => s.setAutoLength);
  const recomputeLengths = useNetworkStore((s) => s.recomputeLengths);
  const requestFit = useNetworkStore((s) => s.requestFit);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      setBackdrop(parseDxf(text, file.name));
    } catch (err) {
      alert('Import DXF impossible : ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="backdrop-panel">
      <div className="bp-header">
        <strong>Fond de plan (DAO)</strong>
        <button className="modal-close" onClick={() => setOpen(false)} title="Fermer">
          ×
        </button>
      </div>

      <div className="bp-body">
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
          {backdrop ? 'Remplacer le fichier DXF…' : 'Importer un fichier DXF…'}
        </button>
        <input ref={fileRef} type="file" accept=".dxf" onChange={onImport} style={{ display: 'none' }} />

        {!backdrop ? (
          <p className="hint" style={{ marginTop: 10 }}>
            Importez un plan DXF pour l’utiliser comme calque de fond et tracer les conduites à
            l’échelle réelle. (DWG → exportez-le en DXF depuis votre logiciel de DAO.)
          </p>
        ) : (
          <>
            <div className="bp-name">📐 {backdrop.name} — {backdrop.entityCount} entité(s)</div>

            <label className="bp-row">
              <input type="checkbox" checked={backdrop.visible} onChange={(e) => updateBackdrop({ visible: e.target.checked })} />
              Afficher le fond
            </label>

            <div className="bp-field">
              <span>Opacité</span>
              <input type="range" min={0.1} max={1} step={0.05} value={backdrop.opacity} onChange={(e) => updateBackdrop({ opacity: parseFloat(e.target.value) })} />
            </div>

            <div className="bp-field">
              <span>Échelle (m/unité)</span>
              <input type="number" step="0.001" value={metersPerUnit} onChange={(e) => setMetersPerUnit(parseFloat(e.target.value) || 1)} />
            </div>

            <label className="bp-row">
              <input type="checkbox" checked={autoLength} onChange={(e) => setAutoLength(e.target.checked)} />
              Longueurs auto depuis le tracé
            </label>

            <div className="bp-actions">
              <button className="btn btn-sm" onClick={recomputeLengths}>Recalculer longueurs</button>
              <button className="btn btn-sm" onClick={requestFit}>Recadrer</button>
            </div>

            <div className="bp-layers-head">
              <span>Calques ({backdrop.layers.length})</span>
              <span>
                <button className="bp-link" onClick={() => setAllLayers(true)}>tous</button>
                {' · '}
                <button className="bp-link" onClick={() => setAllLayers(false)}>aucun</button>
              </span>
            </div>
            <div className="bp-layers">
              {backdrop.layers.map((l) => (
                <label className="bp-layer" key={l.name} title={l.name}>
                  <input type="checkbox" checked={l.visible} onChange={() => toggleLayer(l.name)} />
                  <span className="bp-layer-name">{l.name || '(sans nom)'}</span>
                </label>
              ))}
            </div>

            <button className="btn btn-sm btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={clearBackdrop}>
              Retirer le fond de plan
            </button>
          </>
        )}
      </div>
    </div>
  );
}
