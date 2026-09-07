// The desktop cascade becomes a native swipe rail on smaller screens.
export function createCampaignRail(scene) {
  const rail = scene.querySelector('.campaign-cascade');
  const slots = [...rail.querySelectorAll('.campaign-slot')];
  const navigation = scene.querySelector('.campaign-navigation');
  const buttons = [...navigation.querySelectorAll('button')];
  const compact = matchMedia('(max-width: 1199px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let settleTimer;
  let resizeFrame;
  let previousWidth = 0;

  function update(index) {
    active = index;
    buttons.forEach((button, i) => {
      if (i === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  function show(index, instant = false) {
    if (!compact.matches) return;
    update(Math.max(0, Math.min(slots.length - 1, index)));
    rail.scrollTo({
      left: slots[active].offsetLeft - slots[0].offsetLeft,
      behavior: instant || reduced.matches ? 'instant' : 'smooth',
    });
  }

  function keyboard(event) {
    if (!compact.matches || event.altKey || event.ctrlKey || event.metaKey) return;
    const focused = buttons.indexOf(event.target);
    const origin = focused === -1 ? active : focused;
    const destination = {
      ArrowLeft: origin - 1,
      ArrowRight: origin + 1,
      Home: 0,
      End: slots.length - 1,
    }[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    show(destination);
    if (navigation.contains(document.activeElement)) buttons[active].focus({ preventScroll: true });
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => show(index)));
  navigation.addEventListener('keydown', keyboard);
  rail.addEventListener('keydown', keyboard);
  rail.addEventListener(
    'scroll',
    () => {
      clearTimeout(settleTimer);
      if (!compact.matches) return;
      settleTimer = setTimeout(() => {
        const bounds = rail.getBoundingClientRect();
        const selected = slots[active].getBoundingClientRect();
        // On tablet two cards fit: retain an explicitly selected visible card.
        if (selected.left >= bounds.left - 2 && selected.right <= bounds.right + 2) return;
        const distances = slots.map((slot) =>
          Math.abs(slot.getBoundingClientRect().left - bounds.left),
        );
        update(distances.indexOf(Math.min(...distances)));
      }, 120);
    },
    { passive: true },
  );

  function layout() {
    clearTimeout(settleTimer);
    navigation.hidden = !compact.matches;
    if (compact.matches) {
      rail.tabIndex = 0;
      rail.setAttribute('role', 'region');
      show(active, true);
    } else {
      rail.removeAttribute('tabindex');
      rail.removeAttribute('role');
      rail.scrollLeft = 0;
    }
  }

  compact.addEventListener('change', layout);
  const observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === previousWidth) return;
    previousWidth = entry.contentRect.width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layout);
  });
  observer.observe(rail);
  layout();
}
