export function createFormEnvelope(form) {
  const scene = form.closest('[data-form-scene]');
  const envelope = scene.querySelector('[data-form-envelope]');
  const message = scene.querySelector('.envelope-message');
  const restart = scene.querySelector('[data-form-restart]');
  const announcement = scene.querySelector('[data-form-announcement]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let interrupted = false;

  async function animate(node, keyframes, options) {
    if (
      interrupted ||
      reduced.matches ||
      document.documentElement.dataset.animations === 'off' ||
      !node.animate
    )
      return;
    const animation = node.animate(keyframes, {
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
      ...options,
    });
    animations.add(animation);
    await animation.finished.catch(() => {});
  }

  function settle() {
    interrupted = true;
    for (const animation of animations) animation.finish();
  }

  reduced.addEventListener('change', () => {
    if (reduced.matches) settle();
  });
  window.addEventListener('resize', () => {
    if (scene.dataset.state === 'folding') settle();
  });

  async function show() {
    interrupted = false;
    scene.style.setProperty('--form-height', `${form.getBoundingClientRect().height}px`);
    scene.dataset.state = 'folding';
    form.inert = true;
    envelope.hidden = false;
    restart.disabled = true;

    await Promise.all([
      animate(
        form,
        [
          { transform: 'translateY(0) rotateX(0deg) scale(1)', opacity: 1, offset: 0 },
          { transform: 'translateY(-24px) rotateX(22deg) scale(0.82)', opacity: 1, offset: 0.3 },
          { transform: 'translateY(-8px) rotateX(62deg) scale(0.62)', opacity: 1, offset: 0.65 },
          { transform: 'translateY(90px) rotateX(72deg) scale(0.28)', opacity: 0, offset: 1 },
        ],
        { duration: 1050 },
      ),
      animate(
        envelope,
        [
          { opacity: 0, translate: '0 35px' },
          { opacity: 1, translate: '0 0' },
        ],
        {
          delay: 350,
          duration: 500,
        },
      ),
    ]);
    form.hidden = true;
    await animate(
      scene.querySelector('.envelope-letter'),
      [{ transform: 'translateY(-100px)' }, { transform: 'translateY(20px)' }],
      { duration: 320 },
    );
    await animate(
      scene.querySelector('.envelope-flap'),
      [{ transform: 'rotateX(180deg)' }, { transform: 'rotateX(0deg)' }],
      { duration: 380, easing: 'ease-in-out' },
    );
    await animate(
      message,
      [
        { opacity: 0, translate: '0 8px', scale: 0.97 },
        { opacity: 1, translate: '0 0', scale: 1 },
      ],
      { duration: 260 },
    );
    scene.dataset.state = 'sent';
    for (const animation of animations) animation.cancel();
    animations.clear();
    announcement.textContent = message.innerText;
    message.focus({ preventScroll: true });
  }

  restart.addEventListener('click', () => {
    envelope.hidden = true;
    form.hidden = false;
    form.inert = false;
    scene.removeAttribute('data-state');
    scene.style.removeProperty('--form-height');
    announcement.textContent = '';
    delete form.dataset.delivery;
    form.querySelector('[name="name"]').focus({ preventScroll: true });
  });

  return {
    show,
    ready: () => {
      restart.disabled = false;
    },
  };
}
