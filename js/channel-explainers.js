import { configReady } from './brand.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const scenes = [...document.querySelectorAll('[data-channel-diagram]')].map((diagram) => ({
  diagram,
  panel: diagram.closest('[role="tabpanel"]'),
  beats: [...diagram.querySelectorAll('[data-channel-beat]')],
  visible: false,
  running: false,
  elapsed: 0,
  step: -1,
}));
let enabled = false;
let frame = 0;
let previousTime = null;

function tick(timestamp) {
  const delta = previousTime === null ? 0 : Math.min(timestamp - previousTime, 100);
  previousTime = timestamp;
  scenes.forEach((scene) => {
    if (!scene.running) return;
    scene.elapsed += delta;
    const step = Math.floor(scene.elapsed / 4000) % 3;
    if (scene.step !== step) {
      scene.step = step;
      scene.beats.forEach((beat) => {
        beat.classList.toggle('is-current', Number(beat.dataset.channelBeat) === step);
      });
    }
    scene.diagram.style.setProperty(
      '--channel-progress',
      ((scene.elapsed % 4000) / 4000).toFixed(4),
    );
  });
  frame = requestAnimationFrame(tick);
}

function sync() {
  const allowed = enabled && !reduced.matches;
  scenes.forEach((scene) => {
    scene.running = allowed && scene.visible && !scene.panel.hidden && !document.hidden;
    scene.diagram.toggleAttribute('data-motion', allowed);
    scene.diagram.dataset.running = String(scene.running);
    if (!allowed) {
      scene.elapsed = 0;
      scene.step = -1;
      scene.beats.forEach((beat) => beat.classList.remove('is-current'));
      scene.diagram.style.removeProperty('--channel-progress');
    }
  });
  cancelAnimationFrame(frame);
  previousTime = null;
  if (scenes.some((scene) => scene.running)) frame = requestAnimationFrame(tick);
}

const visibility = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const scene = scenes.find((item) => item.diagram === entry.target);
      scene.visible = entry.isIntersecting;
    });
    sync();
  },
  { threshold: 0.1 },
);
const tabs = new MutationObserver(sync);

scenes.forEach((scene) => {
  visibility.observe(scene.diagram);
  tabs.observe(scene.panel, { attributes: true, attributeFilter: ['hidden'] });
});
reduced.addEventListener('change', sync);
document.addEventListener('visibilitychange', sync);
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  scenes.forEach((scene) => {
    scene.diagram.dataset.running = 'false';
  });
});
window.addEventListener('pageshow', sync);
configReady
  .then((config) => {
    enabled = Boolean(config.features.animations);
    sync();
  })
  .catch(() => {});
