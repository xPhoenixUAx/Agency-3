import { configReady } from './brand.js';

const banner = document.querySelector('.scope-note');

if (banner) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = false;
  let visible = false;

  function sync() {
    const allowed = enabled && !reduced.matches;
    banner.toggleAttribute('data-gradient-motion', allowed);
    banner.dataset.gradientRunning = String(allowed && visible && !document.hidden);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(banner);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => {
    banner.dataset.gradientRunning = 'false';
  });
  window.addEventListener('pageshow', sync);
  configReady
    .then((config) => {
      enabled = Boolean(config.features.animations);
      sync();
    })
    .catch(() => {});
}
