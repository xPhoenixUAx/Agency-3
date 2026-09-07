import { configReady } from './brand.js';
import { motion } from './motion.js';
import './accordions.js';
import './cookie-notice.js';
const dialog = document.querySelector('#site-menu'),
  opener = document.querySelector('[data-menu-open]');
let previousOverflow = '';
function closeMenu() {
  if (dialog?.open) dialog.close();
}
opener?.addEventListener('click', () => {
  previousOverflow = document.body.style.overflow;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  opener.setAttribute('aria-expanded', 'true');
  motion(dialog, 220, 12);
});
dialog?.addEventListener('close', () => {
  document.body.style.overflow = previousOverflow;
  opener.setAttribute('aria-expanded', 'false');
  if (matchMedia('(max-width:1199px)').matches) opener.focus();
});
dialog?.querySelector('[data-menu-close]').addEventListener('click', closeMenu);
dialog?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
dialog?.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = [
    ...dialog.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"]'),
  ].filter((el) => el.getClientRects().length);
  const first = focusable[0],
    last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
matchMedia('(min-width:1200px)').addEventListener('change', (e) => {
  if (e.matches) closeMenu();
});
const services = document.querySelector('[data-services]'),
  links = document.querySelector('#services-links');
function closeServices() {
  if (!services) return;
  services.setAttribute('aria-expanded', 'false');
  links.hidden = true;
}
services?.addEventListener('click', () => {
  const expanded = services.getAttribute('aria-expanded') === 'true';
  services.setAttribute('aria-expanded', String(!expanded));
  links.hidden = expanded;
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.services-menu')) closeServices();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && services?.getAttribute('aria-expanded') === 'true') {
    closeServices();
    services.focus();
  }
});
document.querySelector('.services-menu')?.addEventListener('focusout', (e) => {
  if (!e.currentTarget.contains(e.relatedTarget)) closeServices();
});
document.querySelectorAll('[data-tabs]').forEach((root) => {
  const tabs = [...root.querySelectorAll('[role=tab]')];
  function activate(tab, animate = true) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.hidden = !on;
      if (on && animate) motion(panel, 180, 6);
    });
  }
  activate(tabs[0], false);
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next]);
      tabs[next].focus();
    });
  });
});
configReady
  .then((c) => {
    const need = new URLSearchParams(location.search).get('need');
    const allowedNeed = { tracking: 'Tracking & Analytics' }[need];
    const needField = document.querySelector('select[name=need]');
    if (allowedNeed && needField && c.form.needs.includes(allowedNeed))
      needField.value = allowedNeed;
    const root = document.querySelector('[data-results]');
    if (!root) return;
    const buttons = [...root.querySelectorAll('[data-filter]')],
      cards = [...root.querySelectorAll('[data-case]')];
    function filter(type) {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === type)));
      let count = 0;
      cards.forEach((card) => {
        const visible =
          (!card.hasAttribute('data-illustrative') || c.features.showIllustrativeCases) &&
          (type === 'all' || card.dataset.case === type);
        card.hidden = !visible;
        if (visible) count++;
      });
      root.querySelector('[data-results-status]').textContent =
        `${count} ${count === 1 ? 'story' : 'stories'} shown${c.features.showIllustrativeCases ? ' · approach examples are illustrative' : ''}.`;
      root.querySelector('[data-empty]').hidden = count !== 0;
    }
    const known = buttons.map((b) => b.dataset.filter),
      query = new URLSearchParams(location.search).get('type');
    filter(known.includes(query) ? query : 'all');
    buttons.forEach((b) =>
      b.addEventListener('click', () => {
        filter(b.dataset.filter);
        const u = new URL(location.href);
        if (b.dataset.filter === 'all') u.searchParams.delete('type');
        else u.searchParams.set('type', b.dataset.filter);
        history.replaceState(null, '', u);
      }),
    );
  })
  .catch(() => {});
