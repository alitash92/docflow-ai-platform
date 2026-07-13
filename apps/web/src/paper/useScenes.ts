import { useEffect, useRef } from 'react';

/**
 * Scene trigger for the paper landing. Generalizes anim/useReveal.ts:
 * every [data-scene] descendant starts in its FINAL revealed state (plain
 * CSS default). When animation is allowed, scenes are marked .is-pending
 * (decorations hidden) and flipped to .is-play once ~a quarter is visible,
 * which runs their time-based keyframes exactly once.
 *
 * No JS / prefers-reduced-motion / ?screenshot=1 → nothing is ever hidden.
 */
export function useScenes<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));
    if (scenes.length === 0) return;

    const reduce =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      new URLSearchParams(window.location.search).get('screenshot') === '1';
    if (reduce || typeof IntersectionObserver === 'undefined') return;

    scenes.forEach((s) => s.classList.add('is-pending'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.remove('is-pending');
            el.classList.add('is-play');
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.22, rootMargin: '0px 0px -8% 0px' },
    );
    scenes.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return ref;
}
