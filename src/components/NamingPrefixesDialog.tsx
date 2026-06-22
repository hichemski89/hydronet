import { useEffect, useState } from 'react';
import { useNetworkStore, NamingPrefixes, DEFAULT_PREFIXES } from '../store/networkStore';

const FIELDS: { key: keyof NamingPrefixes; label: string; hint: string }[] = [
  { key: 'junction', label: 'Nœud (jonction)', hint: 'point de demande' },
  { key: 'reservoir', label: 'Bâche / source', hint: 'charge fixe' },
  { key: 'tank', label: 'Réservoir', hint: 'château d’eau / stockage' },
  { key: 'pipe', label: 'Conduite', hint: 'tronçon' },
  { key: 'pump', label: 'Pompe', hint: '' },
  { key: 'valve', label: 'Vanne', hint: '' },
];

/**
 * Définition des préfixes de nommage automatique des éléments. Ex. préfixe « N »
 * pour les nœuds : les nœuds créés s'appelleront N1, N2, N3…
 */
export default function NamingPrefixesDialog() {
  const open = useNetworkStore((s) => s.prefixDialogOpen);
  const setOpen = useNetworkStore((s) => s.setPrefixDialogOpen);
  const prefixes = useNetworkStore((s) => s.prefixes);
  const setPrefixes = useNetworkStore((s) => s.setPrefixes);

  const [draft, setDraft] = useState<NamingPrefixes>(prefixes);

  useEffect(() => {
    if (open) setDraft(prefixes);
  }, [open, prefixes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const set = (key: keyof NamingPrefixes, v: string) =>
    setDraft((d) => ({ ...d, [key]: v }));

  // Un préfixe vide n'est pas accepté (on retombe sinon sur un nommage ambigu).
  const empty = FIELDS.some((f) => !draft[f.key].trim());

  const save = () => {
    const clean: NamingPrefixes = { ...draft };
    for (const f of FIELDS) clean[f.key] = draft[f.key].trim();
    setPrefixes(clean);
    setOpen(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Préfixes de nommage</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Définissez le préfixe utilisé pour nommer automatiquement chaque type
            d’élément. Exemple : préfixe <strong>N</strong> pour les nœuds → les
            nœuds créés s’appelleront <strong>N1</strong>, <strong>N2</strong>,
            <strong> N3</strong>… La numérotation se poursuit après le plus grand
            numéro déjà présent. Les éléments existants ne sont pas renommés.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px 12px', alignItems: 'center' }}>
            {FIELDS.map((f) => (
              <div key={f.key} style={{ display: 'contents' }}>
                <span style={{ fontSize: 13 }}>
                  {f.label}
                  {f.hint && <em style={{ color: '#6b7280', fontStyle: 'normal' }}> — {f.hint}</em>}
                </span>
                <input
                  type="text"
                  value={draft[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="préfixe"
                  style={{
                    width: '100%',
                    borderColor: draft[f.key].trim() ? undefined : '#dc2626',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <span className="field-label" style={{ display: 'block', marginBottom: 4 }}>Aperçu</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FIELDS.map((f) => {
                const p = draft[f.key].trim() || '?';
                return (
                  <span
                    key={f.key}
                    style={{
                      fontSize: 12,
                      padding: '3px 8px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 5,
                      color: '#1e3a8a',
                    }}
                  >
                    {p}1, {p}2, {p}3…
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => setDraft(DEFAULT_PREFIXES)}>
            Réinitialiser
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => setOpen(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={empty}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
