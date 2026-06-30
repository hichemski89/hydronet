import { useEffect } from 'react';

/**
 * Rend déplaçables toutes les fenêtres flottantes de l'application
 * (dialogues `.modal` et panneau de fond de plan `.backdrop-panel`) en les
 * saisissant par leur barre de titre (`.modal-header` / `.bp-header`).
 *
 * Mécanisme global et non intrusif : un seul jeu d'écouteurs au niveau du
 * document applique un `transform: translate()` à la fenêtre concernée. Le
 * décalage est mémorisé sur l'élément lui-même ; il repart donc de zéro
 * (fenêtre recentrée) à chaque réouverture.
 */
export default function DraggableWindows() {
  useEffect(() => {
    let win: HTMLElement | null = null;
    let handle: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let offX = 0;
    let offY = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const h = target.closest('.modal-header, .bp-header') as HTMLElement | null;
      if (!h) return;
      // Ne pas déclencher de glissement depuis un bouton ou un champ.
      if (target.closest('button, input, select, textarea, a, .modal-close')) return;
      const w = h.closest('.modal, .backdrop-panel') as HTMLElement | null;
      if (!w) return;

      win = w;
      handle = h;
      startX = e.clientX;
      startY = e.clientY;
      offX = parseFloat(w.dataset.dragX || '0') || 0;
      offY = parseFloat(w.dataset.dragY || '0') || 0;
      h.setPointerCapture(e.pointerId);
      h.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!win) return;
      const x = offX + (e.clientX - startX);
      const y = offY + (e.clientY - startY);
      win.style.transform = `translate(${x}px, ${y}px)`;
      win.dataset.dragX = String(x);
      win.dataset.dragY = String(y);
    };

    const onUp = (e: PointerEvent) => {
      if (handle) {
        handle.style.cursor = '';
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      win = null;
      handle = null;
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, []);

  return null;
}
