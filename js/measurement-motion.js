import { configReady } from './brand.js';

const flow = document.querySelector('#measurement-flow');

if (flow) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = false;
  let visible = false;

  function sync() {
    const allowed = enabled && !reduced.matches;
    flow.toggleAttribute('data-flow-motion', allowed);
    flow.dataset.running = String(allowed && visible && !document.hidden);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(flow);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => {
    flow.dataset.running = 'false';
  });
  window.addEventListener('pageshow', sync);
  configReady
    .then((config) => {
      enabled = Boolean(config.features.animations);
      sync();
    })
    .catch(() => {});
}
