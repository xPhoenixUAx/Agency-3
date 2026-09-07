import { configReady } from './brand.js';
import { createCampaignStory } from './campaign-story.js';
import { createCampaignRail } from './campaign-rail.js';

const scene = document.querySelector('.page-index .campaign-scene');

if (scene) {
  createCampaignRail(scene);
  const story = createCampaignStory(scene);
  const slots = [...scene.querySelectorAll('.campaign-slot')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1200px)');
  let configured = false;
  let visible = false;
  let suspended = false;
  let bounds;
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function resetPointer() {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    bounds = null;
    slots.forEach((slot) => {
      slot.style.removeProperty('--pointer-x');
      slot.style.removeProperty('--pointer-y');
      slot.style.removeProperty('--pointer-angle');
    });
  }

  function sync() {
    const allowed = configured && !reduced.matches;
    const running = allowed && visible && !document.hidden && !suspended;
    scene.toggleAttribute('data-campaign-motion', allowed);
    scene.dataset.campaignRunning = String(running);
    story.setState({ allowed, running });
    if (!running || !pointer.matches) resetPointer();
  }

  scene.addEventListener('pointerenter', () => {
    bounds = scene.getBoundingClientRect();
  });
  scene.addEventListener('pointermove', (event) => {
    if (!pointer.matches || scene.dataset.campaignRunning !== 'true') return;
    bounds ||= scene.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    pointerY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      slots.forEach((slot, index) => {
        const depth = [0.65, 1, 0.8, 0.55][index];
        slot.style.setProperty('--pointer-x', `${(pointerX * 4 * depth).toFixed(2)}px`);
        slot.style.setProperty('--pointer-y', `${(pointerY * 3 * depth).toFixed(2)}px`);
        slot.style.setProperty('--pointer-angle', `${(pointerX * 0.4 * depth).toFixed(2)}deg`);
      });
    });
  });
  scene.addEventListener('pointerleave', resetPointer);
  scene.addEventListener('pointercancel', resetPointer);
  window.addEventListener('resize', resetPointer, { passive: true });
  window.addEventListener('scroll', resetPointer, { passive: true });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  pointer.addEventListener('change', sync);
  window.addEventListener('pagehide', () => {
    suspended = true;
    sync();
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    sync();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    observer.observe(scene);
  } else {
    visible = true;
  }

  configReady
    .then((config) => {
      configured = config.features.animations;
      sync();
    })
    .catch(() => {
      configured = false;
      sync();
    });
}
