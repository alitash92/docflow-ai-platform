import { useEffect, useRef } from 'react';

/**
 * Reveal-on-scroll. Returns a ref for a container; any descendant tagged with
 * the `.reveal` class fades + rises in when it scrolls into view. Honors
 * prefers-reduced-motion (and ?screenshot=1 freeze) by revealing immediately.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (els.length === 0) return;

    const reduce =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      new URLSearchParams(window.location.search).get('screenshot') === '1';

    if (reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('reveal-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return ref;
}
