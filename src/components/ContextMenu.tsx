import { useEffect, useRef } from 'react';

export interface MenuItem {
  type?: 'item' | 'separator';
  label?: string;
  icon?: string;
  danger?: boolean;
  onClick?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // différé pour ne pas capter le même évènement qui a ouvert le menu
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);
      window.addEventListener('wheel', onClose, { passive: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  // Évite que le menu sorte de l'écran
  const maxX = window.innerWidth - 220;
  const maxY = window.innerHeight - items.length * 34 - 16;

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: Math.min(x, maxX), top: Math.min(y, Math.max(8, maxY)) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.type === 'separator' ? (
          <div key={i} className="context-sep" />
        ) : (
          <button
            key={i}
            className={`context-item ${it.danger ? 'danger' : ''}`}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
          >
            <span className="context-icon">{it.icon}</span>
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
