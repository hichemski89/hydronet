import { useEffect, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { saveProjectFile } from '../engine/projectIO';
import { clearPersistedNetwork } from '../store/persist';
import type {} from '../types/electron';

/**
 * Intercepte la fermeture de l'application (Electron). Si des modifications ne
 * sont pas enregistrées, propose : Enregistrer / Ne pas enregistrer / Annuler.
 *
 * - « Ne pas enregistrer » efface aussi l'auto-sauvegarde, afin que les
 *   modifications abandonnées ne réapparaissent pas au prochain lancement.
 * - Une fermeture non confirmée (plantage) conserve l'auto-sauvegarde
 *   (récupération possible).
 */
export default function CloseConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const updateMeta = useNetworkStore((s) => s.updateMeta);
  const addRecent = useNetworkStore((s) => s.addRecent);
  const markSaved = useNetworkStore((s) => s.markSaved);

  useEffect(() => {
    const api = window.electronApp;
    if (!api?.onCloseRequest) return;
    return api.onCloseRequest(() => {
      const s = useNetworkStore.getState();
      const dirty = s.network !== s.savedRef;
      if (!dirty) {
        api.confirmClose(); // rien à enregistrer : on ferme
        return;
      }
      setOpen(true);
    });
  }, []);

  const onSave = async () => {
    setBusy(true);
    try {
      const net = useNetworkStore.getState().network;
      const name = await saveProjectFile(net, { saveAs: false });
      if (!name) return; // enregistrement annulé : on reste ouvert
      updateMeta({ name });
      addRecent(name, { ...net, meta: { ...net.meta, name } });
      markSaved();
      window.electronApp?.confirmClose();
    } finally {
      setBusy(false);
    }
  };

  const onDiscard = () => {
    clearPersistedNetwork(); // abandonne les modifications non enregistrées
    window.electronApp?.confirmClose();
  };

  const onCancel = () => setOpen(false);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Enregistrer les modifications ?</h3>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0 }}>
            Le projet comporte des modifications non enregistrées. Voulez-vous les enregistrer avant
            de quitter HydroNet ?
          </p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" onClick={onDiscard} disabled={busy}>
              Ne pas enregistrer
            </button>
            <button className="btn btn-primary" onClick={onSave} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
