import { useEffect } from 'react';

/**
 * Défilement du site web comme sur un site classique.
 *
 * Chaque page défile dans une zone centrée : sans cette aide, la molette ne faisait rien quand
 * la souris était sur les marges, et les touches du clavier (flèches, Page suivante, Espace,
 * Début, Fin) ne faisaient pas défiler la page.
 */

const canScrollY = (el) => {
  if (!el || el === document.body || el === document.documentElement) return false;
  const overflowY = window.getComputedStyle(el).overflowY;
  return /(auto|scroll)/.test(overflowY) && el.scrollHeight > el.clientHeight + 4;
};

/** La zone de défilement principale : la plus grande zone visible qui peut défiler. */
const findMainScroller = () => {
  let best = null;
  let bestArea = 0;
  const nodes = document.querySelectorAll('div');
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    if (el.scrollHeight <= el.clientHeight + 4) continue;
    if (!canScrollY(el)) continue;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (rect.height > 120 && area > bestArea) {
      best = el;
      bestArea = area;
    }
  }
  return best;
};

const hasScrollableAncestor = (target, deltaY) => {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (canScrollY(el)) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
    }
    el = el.parentElement;
  }
  return false;
};

const isTyping = (target) => {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true
  );
};

export default function WebScrollAssist() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    let cached = null;
    const mainScroller = () => {
      if (!cached || !cached.isConnected || !canScrollY(cached)) cached = findMainScroller();
      return cached;
    };

    const onWheel = (event) => {
      if (event.ctrlKey || event.defaultPrevented || !event.deltaY) return;
      if (hasScrollableAncestor(event.target, event.deltaY)) return;
      const scroller = mainScroller();
      if (!scroller) return;
      const factor = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? scroller.clientHeight : 1;
      scroller.scrollTop += event.deltaY * factor;
    };

    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      const scroller = mainScroller();
      if (!scroller) return;
      const page = Math.max(120, scroller.clientHeight * 0.85);
      let delta = null;
      switch (event.key) {
        case 'ArrowDown': delta = 60; break;
        case 'ArrowUp': delta = -60; break;
        case 'PageDown': delta = page; break;
        case 'PageUp': delta = -page; break;
        case ' ': delta = event.shiftKey ? -page : page; break;
        case 'Home': delta = -scroller.scrollHeight; break;
        case 'End': delta = scroller.scrollHeight; break;
        default: return;
      }
      // Espace sur un bouton ou un lien : on laisse le navigateur l'activer.
      if (event.key === ' ' && event.target instanceof Element && event.target.closest('[role="button"], [role="link"], button, a')) return;
      event.preventDefault();
      scroller.scrollBy({ top: delta, behavior: 'smooth' });
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
