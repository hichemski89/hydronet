import { useEffect } from 'react';
import { useNetworkStore } from '../store/networkStore';

/** Fenêtre d'information/erreur intégrée (remplace alert() natif). */
export default function NoticeDialog() {
  const notice = useNetworkStore((s) => s.notice);
  const setNotice = useNetworkStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') setNotice(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notice, setNotice]);

  if (!notice) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setNotice(null)}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>HydroNet</h3>
          <button className="modal-close" onClick={() => setNotice(null)}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 13.5, lineHeight: 1.55 }}>
            {notice}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => setNotice(null)}>OK</button>
        </div>
      </div>
    </div>
  );
}
