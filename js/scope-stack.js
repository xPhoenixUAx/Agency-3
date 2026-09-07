import { configReady } from './brand.js';

const rows = document.querySelector('.scope-rows');

if (rows) {
  const cards = [...rows.querySelectorAll('.scope-row')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 767px)');
  const properties = ['--scope-x', '--scope-y', '--scope-scale', '--scope-turn', '--scope-copy'];
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const ease = (value) => value * value * (3 - 2 * value);
  let configured = false;
  let enabled = false;
  let frame = 0;
  let measures = [];
  let previousWidth = 0;

  function render() {
    frame = 0;
    if (!enabled || !measures.length) return;
    // Each opening gap uses the scroll distance it occupies in the final layout.
    // The remaining cards travel together until it is their turn to unfold.
    const anchor = Math.min(480, innerHeight * 0.62);
    const travelled = Math.max(0, anchor - rows.getBoundingClientRect().top);
    const peek = mobile.matches ? 12 : 18;
    let consumed = 0;
    let opened = 0;
    cards.forEach((card, index) => {
      if (index === 0) return;
      const gap = measures[index].top - measures[index - 1].top;
      const progress = clamp((travelled - consumed) / gap);
      const reveal = ease(progress);
      consumed += gap;
      opened += (gap - peek) * reveal;
      const displacement = index * peek + opened - measures[index].top;
      const side = mobile.matches ? 0 : measures[0].left - measures[index].left + index * 8;
      card.style.setProperty('--scope-x', `${(side * (1 - reveal)).toFixed(2)}px`);
      card.style.setProperty('--scope-y', `${displacement.toFixed(2)}px`);
      card.style.setProperty('--scope-scale', (1 - index * 0.035 * (1 - reveal)).toFixed(4));
      card.style.setProperty(
        '--scope-turn',
        `${(mobile.matches ? 0 : (index === 1 ? -1 : 1) * (1 - reveal)).toFixed(3)}deg`,
      );
      // Keep the body quiet while another opaque card still covers its heading.
      card.style.setProperty('--scope-copy', ease(clamp((progress - 0.88) / 0.12)).toFixed(4));
    });
  }

  function queue() {
    if (enabled && !frame) frame = requestAnimationFrame(render);
  }

  function layout() {
    cancelAnimationFrame(frame);
    frame = 0;
    enabled = configured && !reduced.matches;
    rows.removeAttribute('data-scope-stack');
    rows.style.removeProperty('--scope-card-height');
    cards.forEach((card) => properties.forEach((property) => card.style.removeProperty(property)));
    if (!enabled) return;
    const tallest = Math.max(...cards.map((card) => card.offsetHeight));
    rows.style.setProperty('--scope-card-height', `${tallest}px`);
    rows.setAttribute('data-scope-stack', '');
    const origin = cards[0].offsetTop;
    measures = cards.map((card) => ({ top: card.offsetTop - origin, left: card.offsetLeft }));
    render();
  }

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('pageshow', queue);
  reduced.addEventListener('change', layout);
  mobile.addEventListener('change', layout);
  const resize = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === previousWidth) return;
    previousWidth = entry.contentRect.width;
    layout();
  });
  resize.observe(rows);
  Promise.all([configReady, document.fonts.ready])
    .then(([config]) => {
      configured = Boolean(config.features.animations);
      layout();
    })
    .catch(() => {});
}
