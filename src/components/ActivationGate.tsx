import { useEffect, useState } from 'react';
import { LICENSE } from '../license/config';
import {
  activate,
  checkStoredLicense,
  revalidateIfDue,
  getMachineId,
} from '../license/license';
import { PRODUCT, APP_VERSION } from '../legal/eula';

type Phase = 'checking' | 'activated' | 'need-key';

/**
 * Bloque l'application tant qu'une licence valide n'est pas active.
 * Inactif si LICENSE.ENABLED est false (développement / app non protégée).
 */
export default function ActivationGate() {
  const [phase, setPhase] = useState<Phase>(LICENSE.ENABLED ? 'checking' : 'activated');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!LICENSE.ENABLED) return;
    let cancelled = false;
    (async () => {
      const state = await checkStoredLicense();
      if (cancelled) return;
      if (state.status === 'ok') {
        const stillValid = await revalidateIfDue(state.payload);
        if (cancelled) return;
        setPhase(stillValid ? 'activated' : 'need-key');
      } else {
        setPhase('need-key');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!LICENSE.ENABLED || phase === 'activated') return null;

  const onActivate = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError('');
    const res = await activate(key);
    setBusy(false);
    if (res.ok) setPhase('activated');
    else setError(res.error);
  };

  return (
    <div className="modal-overlay license-overlay">
      <div className="modal license-modal" style={{ width: 460 }}>
        <div className="modal-header">
          <h3>Activation de {PRODUCT}</h3>
        </div>
        <div className="modal-body">
          {phase === 'checking' ? (
            <p className="license-about">Vérification de la licence…</p>
          ) : (
            <>
              <p className="license-about">
                Saisissez votre clé de licence pour activer {PRODUCT}. La clé est liée à ce poste.
              </p>
              <label className="field">
                <span className="field-label">Clé de licence</span>
                <input
                  type="text"
                  autoFocus
                  placeholder="HN-XXXX-XXXX-XXXX-XXXX"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onActivate()}
                  style={{ textTransform: 'uppercase' }}
                />
              </label>
              {error && <p className="license-error">{error}</p>}
              <p className="hint" style={{ marginBottom: 0 }}>
                Identifiant du poste : <code>{getMachineId().slice(0, 8)}…</code> · version {APP_VERSION}
              </p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <span className="license-foot-note">Une licence valide est requise.</span>
          <button
            className="btn btn-primary"
            onClick={onActivate}
            disabled={busy || phase === 'checking' || !key.trim()}
          >
            {busy ? 'Activation…' : 'Activer'}
          </button>
        </div>
      </div>
    </div>
  );
}
