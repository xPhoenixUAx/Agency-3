import { configReady } from './brand.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set();
let enabled = false;

document.querySelectorAll('details').forEach((details) => {
  const summary = details.querySelector(':scope > summary');
  if (!summary || !details.animate) return;

  let animation = null;
  let expanded = details.open;
  let previousOverflow = '';

  function finish() {
    details.open = expanded;
    animation?.cancel();
    animation = null;
    details.style.overflow = previousOverflow;
    active.delete(finish);
  }

  summary.addEventListener('click', (event) => {
    // Native summary activation also handles Enter and Space.
    if (event.defaultPrevented || event.target.closest('a, button, input, select, textarea'))
      return;
    if (!enabled || reduced.matches) return;
    event.preventDefault();

    const start = details.getBoundingClientRect().height;
    if (!animation) {
      expanded = details.open;
      previousOverflow = details.style.overflow;
    }
    expanded = !expanded;
    animation?.cancel();

    // Keep the content rendered until the closing transition has finished.
    details.open = true;
    details.style.overflow = 'hidden';
    const style = getComputedStyle(details);
    const closedHeight =
      summary.getBoundingClientRect().height +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const end = expanded ? details.getBoundingClientRect().height : closedHeight;

    animation = details.animate([{ height: `${start}px` }, { height: `${end}px` }], {
      duration: 340,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    });
    animation.onfinish = finish;
    active.add(finish);
  });
});

function settle() {
  for (const finish of active) finish();
}

reduced.addEventListener('change', () => {
  if (reduced.matches) settle();
});
window.addEventListener('resize', settle);
window.addEventListener('pagehide', settle);
configReady
  .then((config) => {
    enabled = Boolean(config.features.animations);
    if (!enabled) settle();
  })
  .catch(() => {});
