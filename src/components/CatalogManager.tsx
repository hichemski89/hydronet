import { useEffect, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { buildDiametersFromRows, materialRows } from '../data/pipeCatalog';

interface Row {
  dn: number;
  pn: number;
  thickness: number;
}

/** Assistant de gestion du catalogue de conduites (matériaux + dimensions). */
export default function CatalogManager() {
  const open = useNetworkStore((s) => s.catalogDialogOpen);
  const setOpen = useNetworkStore((s) => s.setCatalogDialogOpen);
  const catalog = useNetworkStore((s) => s.catalog);
  const addMaterial = useNetworkStore((s) => s.addMaterial);
  const updateMaterial = useNetworkStore((s) => s.updateMaterial);
  const deleteMaterial = useNetworkStore((s) => s.deleteMaterial);
  const resetCatalog = useNetworkStore((s) => s.resetCatalog);

  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const current = catalog.find((m) => m.id === selected) ?? null;

  useEffect(() => {
    if (!open) return;
    if ((!selected || !catalog.some((m) => m.id === selected)) && catalog.length) {
      setSelected(catalog[0].id);
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selected, catalog, setOpen]);

  // Charge les lignes éditables quand on change de matériau (pas à chaque frappe).
  useEffect(() => {
    const m = catalog.find((x) => x.id === selected);
    setRows(m ? materialRows(m) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (!open) return null;

  const saveRows = (newRows: Row[]) => {
    setRows(newRows);
    if (current) updateMaterial(current.id, { diameters: buildDiametersFromRows(newRows) });
  };
  const setRow = (i: number, patch: Partial<Row>) => {
    saveRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    const last = rows[rows.length - 1];
    saveRows([...rows, { dn: last?.dn ?? 110, pn: last?.pn ?? 16, thickness: last?.thickness ?? 10 }]);
  };
  const delRow = (i: number) => saveRows(rows.filter((_, idx) => idx !== i));

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Catalogue de conduites</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="curve-body">
          {/* Liste des matériaux */}
          <div className="curve-list">
            <div className="curve-list-items">
              {catalog.map((m) => (
                <button
                  key={m.id}
                  className={`curve-item ${selected === m.id ? 'active' : ''}`}
                  onClick={() => setSelected(m.id)}
                >
                  <strong>{m.name}</strong>
                  <span>{m.diameters.length} DN</span>
                </button>
              ))}
            </div>
            <div className="curve-add" style={{ flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-sm btn-primary" style={{ width: '100%' }} onClick={() => setSelected(addMaterial())}>
                + Nouveau matériau
              </button>
              <button className="btn btn-sm" style={{ width: '100%' }} onClick={resetCatalog} title="Restaurer le catalogue par défaut (PE100 SETIF)">
                ↺ Catalogue par défaut
              </button>
            </div>
          </div>

          {/* Détail du matériau */}
          {current ? (
            <div className="curve-detail catalog-detail">
              <div className="cat-grid">
                <label className="field">
                  <span className="field-label">Nom du matériau</span>
                  <input type="text" value={current.name} onChange={(e) => updateMaterial(current.id, { name: e.target.value })} />
                </label>
                <label className="field">
                  <span className="field-label">Norme</span>
                  <input type="text" value={current.norm} onChange={(e) => updateMaterial(current.id, { norm: e.target.value })} placeholder="ex. EN 12201" />
                </label>
                <label className="field">
                  <span className="field-label">C (Hazen-Williams)</span>
                  <input type="number" step={1} value={current.hwRoughness} onChange={(e) => updateMaterial(current.id, { hwRoughness: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span className="field-label">ε rugosité (mm, Darcy)</span>
                  <input type="number" step={0.0005} value={current.dwRoughness} onChange={(e) => updateMaterial(current.id, { dwRoughness: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span className="field-label">n (Manning)</span>
                  <input type="number" step={0.001} value={current.cmRoughness} onChange={(e) => updateMaterial(current.id, { cmRoughness: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span className="field-label">Facteur rayon courbure (× DN)</span>
                  <input type="number" step={1} value={current.bendRadiusFactor} onChange={(e) => updateMaterial(current.id, { bendRadiusFactor: parseFloat(e.target.value) || 0 })} />
                </label>
              </div>

              <div className="cat-sizes-head">
                <span className="field-label">Dimensions (le Ø intérieur et le SDR sont calculés)</span>
                <button className="btn btn-sm" onClick={addRow}>+ Dimension</button>
              </div>

              <div className="cat-table">
                <div className="cat-row cat-row-head">
                  <span>DN ext. (mm)</span>
                  <span>PN (bar)</span>
                  <span>Épaisseur (mm)</span>
                  <span>SDR</span>
                  <span>Ø int. (mm)</span>
                  <span />
                </div>
                <div className="cat-rows">
                  {rows.length === 0 && <div className="hint" style={{ padding: 8 }}>Aucune dimension. Cliquez « + Dimension ».</div>}
                  {rows.map((r, i) => {
                    const valid = r.thickness > 0 && r.thickness * 2 < r.dn;
                    const sdr = valid ? (r.dn / r.thickness).toFixed(1) : '—';
                    const inner = valid ? (r.dn - 2 * r.thickness).toFixed(1) : '—';
                    return (
                      <div className="cat-row" key={i}>
                        <input type="number" value={r.dn} onChange={(e) => setRow(i, { dn: parseFloat(e.target.value) || 0 })} />
                        <input type="number" value={r.pn} onChange={(e) => setRow(i, { pn: parseFloat(e.target.value) || 0 })} />
                        <input type="number" step={0.1} value={r.thickness} onChange={(e) => setRow(i, { thickness: parseFloat(e.target.value) || 0 })} />
                        <span className="cat-calc">{sdr}</span>
                        <span className="cat-calc">{inner}</span>
                        <button className="curve-del" onClick={() => delRow(i)} title="Supprimer">×</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '10px 0 0', borderTop: 'none' }}>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={catalog.length <= 1}
                  onClick={() => { deleteMaterial(current.id); setSelected(null); }}
                >
                  Supprimer ce matériau
                </button>
              </div>
            </div>
          ) : (
            <div className="curve-detail"><p className="hint">Sélectionnez ou ajoutez un matériau.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
