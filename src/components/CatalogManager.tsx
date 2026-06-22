import { useEffect, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import {
  buildDiametersFromRows,
  materialRows,
  DEFAULT_MATERIALS,
  PipeMaterial,
} from '../data/pipeCatalog';

interface Row {
  dn: number;
  pn: number;
  thickness: number;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Assistant de gestion du catalogue de conduites (édition en brouillon). */
export default function CatalogManager() {
  const open = useNetworkStore((s) => s.catalogDialogOpen);
  const setOpen = useNetworkStore((s) => s.setCatalogDialogOpen);
  const catalog = useNetworkStore((s) => s.catalog);
  const setCatalog = useNetworkStore((s) => s.setCatalog);

  const [draft, setDraft] = useState<PipeMaterial[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [confirm, setConfirm] = useState<{ msg: string; ok: () => void } | null>(null);

  const current = draft.find((m) => m.id === selected) ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(catalog);

  // (Ré)initialise le brouillon à l'ouverture
  useEffect(() => {
    if (!open) return;
    const d = clone(catalog);
    setDraft(d);
    setSelected(d[0]?.id ?? null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge les lignes éditables quand le matériau sélectionné change
  useEffect(() => {
    const m = draft.find((x) => x.id === selected);
    setRows(m ? materialRows(m) : []);
  }, [selected, draft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && tryClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const patchMaterial = (id: string, patch: Partial<PipeMaterial>) =>
    setDraft((d) => d.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const saveRows = (newRows: Row[]) => {
    setRows(newRows);
    if (current) patchMaterial(current.id, { diameters: buildDiametersFromRows(newRows) });
  };
  const setRow = (i: number, patch: Partial<Row>) =>
    saveRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => {
    const last = rows[rows.length - 1];
    saveRows([...rows, { dn: last?.dn ?? 110, pn: last?.pn ?? 16, thickness: last?.thickness ?? 10 }]);
  };
  const delRow = (i: number) => saveRows(rows.filter((_, idx) => idx !== i));

  const addMaterial = () => {
    let i = 1;
    while (draft.some((m) => m.id === `mat-${i}`)) i++;
    const id = `mat-${i}`;
    const mat: PipeMaterial = {
      id,
      name: 'Nouveau matériau',
      norm: '',
      hwRoughness: 130,
      dwRoughness: 0.01,
      cmRoughness: 0.011,
      bendRadiusFactor: 25,
      diameters: [],
    };
    setDraft((d) => [...d, mat]);
    setSelected(id);
  };

  const deleteMaterial = () => {
    if (!current || draft.length <= 1) return;
    setDraft((d) => d.filter((m) => m.id !== current.id));
    setSelected(null);
  };

  const doSave = () =>
    setConfirm({
      msg: 'Enregistrer les modifications du catalogue de conduites ?',
      ok: () => setCatalog(clone(draft)),
    });

  const doReset = () =>
    setConfirm({
      msg: 'Restaurer le catalogue par défaut (PE100 SETIF) ? Vos matériaux personnalisés non enregistrés seront remplacés. L’enregistrement reste à confirmer ensuite.',
      ok: () => {
        const d = clone(DEFAULT_MATERIALS);
        setDraft(d);
        setSelected(d[0]?.id ?? null);
      },
    });

  const tryClose = () => {
    if (dirty) {
      setConfirm({
        msg: 'Des modifications ne sont pas enregistrées. Fermer sans enregistrer ?',
        ok: () => setOpen(false),
      });
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={tryClose}>
      <div className="modal catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Catalogue de conduites{dirty ? ' •' : ''}</h3>
          <button className="modal-close" onClick={tryClose}>×</button>
        </div>

        <div className="curve-body">
          <div className="curve-list">
            <div className="curve-list-items">
              {draft.map((m) => (
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
              <button className="btn btn-sm btn-primary" style={{ width: '100%' }} onClick={addMaterial}>
                + Nouveau matériau
              </button>
              <button className="btn btn-sm" style={{ width: '100%' }} onClick={doReset}>
                ↺ Catalogue par défaut
              </button>
            </div>
          </div>

          {current ? (
            <div className="curve-detail catalog-detail">
              <div className="cat-grid">
                <label className="field">
                  <span className="field-label">Nom du matériau</span>
                  <input type="text" value={current.name} onChange={(e) => patchMaterial(current.id, { name: e.target.value })} />
                </label>
                <label className="field">
                  <span className="field-label">Norme</span>
                  <input type="text" value={current.norm} onChange={(e) => patchMaterial(current.id, { norm: e.target.value })} placeholder="ex. EN 12201" />
                </label>
                <label className="field">
                  <span className="field-label">C (Hazen-Williams)</span>
                  <input type="number" step={1} value={current.hwRoughness} onChange={(e) => patchMaterial(current.id, { hwRoughness: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span className="field-label">ε rugosité (mm, Darcy)</span>
                  <input type="number" step={0.0005} value={current.dwRoughness} onChange={(e) => patchMaterial(current.id, { dwRoughness: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span className="field-label">n (Manning)</span>
                  <input type="number" step={0.001} value={current.cmRoughness} onChange={(e) => patchMaterial(current.id, { cmRoughness: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="field">
                  <span className="field-label">Facteur rayon courbure (× DN)</span>
                  <input type="number" step={1} value={current.bendRadiusFactor} onChange={(e) => patchMaterial(current.id, { bendRadiusFactor: parseFloat(e.target.value) || 0 })} />
                </label>
              </div>

              <div className="cat-sizes-head">
                <span className="field-label">Dimensions (Ø intérieur et SDR calculés)</span>
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

              <div style={{ marginTop: 10 }}>
                <button className="btn btn-sm btn-danger" disabled={draft.length <= 1} onClick={deleteMaterial}>
                  Supprimer ce matériau
                </button>
              </div>
            </div>
          ) : (
            <div className="curve-detail"><p className="hint">Sélectionnez ou ajoutez un matériau.</p></div>
          )}
        </div>

        <div className="modal-footer">
          <span className="license-foot-note">
            {dirty ? 'Modifications non enregistrées' : 'Catalogue à jour'}
          </span>
          <button className="btn" onClick={tryClose}>Fermer</button>
          <button className="btn btn-primary" onClick={doSave} disabled={!dirty}>
            Enregistrer
          </button>
        </div>
      </div>

      {confirm && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setConfirm(null)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmation</h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{confirm.msg}</p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setConfirm(null)}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  confirm.ok();
                  setConfirm(null);
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
