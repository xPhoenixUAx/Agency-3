import { configReady } from './brand.js';
const reduced = matchMedia('(prefers-reduced-motion: reduce)'),
  active = new Set();
let enabled = false,
  observer;
export function motion(el, duration = 480, y = 20, delay = 0) {
  if (!enabled || reduced.matches || !el?.animate) return;
  const animation = el.animate(
    [
      { opacity: 0, transform: `translateY(${y}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)' },
  );
  active.add(animation);
  animation.finished.catch(() => {}).finally(() => active.delete(animation));
}
function stop() {
  observer?.disconnect();
  for (const a of active) a.cancel();
  active.clear();
}
configReady
  .then((c) => {
    enabled = c.features.animations;
    if (!enabled || reduced.matches) return;
    const mobile = matchMedia('(max-width:767px)').matches;
    motion(document.querySelector('.site-header'), 240, -8);
    motion(document.querySelector('.hero-heading h1'), 520, 20, 80);
    motion(document.querySelector('.hero-intro'), 480, 20, 180);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              motion(e.target, mobile ? 360 : 480, mobile ? 12 : 20);
              observer.unobserve(e.target);
            }
        },
        { threshold: 0.15 },
      );
      document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    }
  })
  .catch(() => {});
reduced.addEventListener('change', () => {
  if (reduced.matches) stop();
});
window.addEventListener('pagehide', stop);
