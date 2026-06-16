import { useNetworkStore } from '../store/networkStore';
import { ZoomInIcon, ZoomOutIcon, FitIcon } from './Icons';

export default function ZoomControls() {
  const view = useNetworkStore((s) => s.view);
  const setView = useNetworkStore((s) => s.setView);
  const requestFit = useNetworkStore((s) => s.requestFit);

  const zoomBy = (factor: number) => {
    const vp = document.querySelector('.map-viewport');
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(0.05, Math.min(20, view.scale * factor));
    // Point modèle sous le centre, conservé après zoom
    const mx = (cx - view.offsetX) / view.scale;
    const my = -(cy - view.offsetY) / view.scale;
    setView({
      scale: newScale,
      offsetX: cx - mx * newScale,
      offsetY: cy + my * newScale,
    });
  };

  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={() => zoomBy(1.25)} title="Zoom avant">
        <ZoomInIcon size={18} />
      </button>
      <button className="zoom-btn" onClick={() => zoomBy(1 / 1.25)} title="Zoom arrière">
        <ZoomOutIcon size={18} />
      </button>
      <button className="zoom-btn" onClick={requestFit} title="Zoom étendu (tout afficher)">
        <FitIcon size={18} />
      </button>
    </div>
  );
}
