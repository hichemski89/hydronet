import { useEffect, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { EULA_TEXT, PRODUCT, COPYRIGHT, APP_VERSION } from '../legal/eula';
import { getLicenseInfo } from '../license/license';

const ACCEPT_KEY = 'hydronet:eula:accepted:v1';

/**
 * Affiche le contrat de licence :
 * - au 1er lancement, en mode « acceptation » bloquant (doit accepter) ;
 * - à la demande (menu À propos / Licence), en lecture seule.
 */
export default function LicenseGate() {
  const licenseOpen = useNetworkStore((s) => s.licenseOpen);
  const setLicenseOpen = useNetworkStore((s) => s.setLicenseOpen);
  const [accepted, setAccepted] = useState(true); // optimiste -> ajusté au montage
  const [declined, setDeclined] = useState(false);
  const [licensee, setLicensee] = useState('');

  useEffect(() => {
    setAccepted(localStorage.getItem(ACCEPT_KEY) === '1');
  }, []);

  const mustAccept = !accepted;
  const visible = mustAccept || licenseOpen;

  // Charge le titulaire de la licence quand la fenêtre « À propos » s'ouvre.
  useEffect(() => {
    if (!visible || mustAccept) return;
    let cancelled = false;
    getLicenseInfo().then((info) => {
      if (!cancelled) setLicensee(info?.email || '');
    });
    return () => {
      cancelled = true;
    };
  }, [visible, mustAccept]);

  if (!visible) return null;

  const accept = () => {
    try {
      localStorage.setItem(ACCEPT_KEY, '1');
    } catch {
      /* ignore */
    }
    setAccepted(true);
    setLicenseOpen(false);
  };

  const close = () => {
    if (mustAccept) return; // pas de fermeture tant que non accepté
    setLicenseOpen(false);
  };

  const decline = () => {
    // Application PC : ferme la fenêtre Electron. Web : on bloque avec un message.
    try {
      window.close();
    } catch {
      /* ignore */
    }
    setDeclined(true);
  };

  // Écran de refus (web) : impossible d'utiliser le logiciel sans accepter.
  if (mustAccept && declined) {
    return (
      <div className="modal-overlay license-overlay">
        <div className="modal license-modal" style={{ width: 440 }}>
          <div className="modal-header">
            <h3>Conditions refusées</h3>
          </div>
          <div className="modal-body">
            <p className="license-about">
              Vous avez refusé le contrat de licence. L’utilisation de {PRODUCT} n’est pas
              autorisée sans acceptation. Veuillez fermer l’application.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setDeclined(false)}>
              Revoir le contrat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay license-overlay" onClick={close}>
      <div className="modal license-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mustAccept ? `Contrat de licence — ${PRODUCT}` : `À propos de ${PRODUCT}`}</h3>
          {!mustAccept && (
            <button className="modal-close" onClick={close}>×</button>
          )}
        </div>
        <div className="modal-body">
          {!mustAccept && (
            <p className="license-about">
              <strong>{PRODUCT}</strong> — version {APP_VERSION}
              <br />
              {COPYRIGHT}
              {licensee && (
                <>
                  <br />
                  Licence enregistrée à : <strong>{licensee}</strong>
                </>
              )}
            </p>
          )}
          <pre className="license-text">{EULA_TEXT}</pre>
        </div>
        <div className="modal-footer">
          {mustAccept ? (
            <>
              <span className="license-foot-note">
                Vous devez accepter pour utiliser le logiciel.
              </span>
              <button className="btn" onClick={decline}>
                Refuser
              </button>
              <button className="btn btn-primary" onClick={accept}>
                J’accepte
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={close}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}
