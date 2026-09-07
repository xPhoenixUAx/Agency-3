const scenarioURL = new URL('../config/campaigns.json', import.meta.url);
const assetBase = new URL('../', scenarioURL);
const cycleDuration = 12000;
const clamp = (value) => Math.max(0, Math.min(1, value));

export function createCampaignStory(scene) {
  const find = (selector) => scene.querySelector(selector);
  const query = find('[data-story-query]');
  const accessibleQuery = find('[data-story-query-label]');
  const search = find('.search-result');
  const shopping = find('.shopping-card .ad-content');
  const film = find('.video-card .ad-content');
  const rendered = { search: -1, shopping: -1, film: -1 };
  let scenarios = [];
  let allowed = false;
  let running = false;
  let frame = 0;
  let previousTime = null;
  let elapsed = 0;

  function text(selector, value) {
    const node = find(selector);
    if (node.textContent !== value) node.textContent = value;
  }

  function productImage(selector, src, alt) {
    const image = find(selector);
    image.src = new URL(src, assetBase).href;
    image.alt = alt;
  }

  function applySearch(index) {
    if (rendered.search === index) return;
    const item = scenarios[index];
    text('[data-story-domain]', item.domain);
    text('.search-result h3', item.searchTitle);
    text('.search-result p', item.searchDescription);
    accessibleQuery.textContent = `Example search: ${item.query}`;
    productImage('.search-result .shoe', item.image, item.imageAlt);
    scene.querySelectorAll('.search-sitelinks span').forEach((node, i) => {
      node.textContent = item.sitelinks[i];
    });
    rendered.search = index;
  }

  function applyShopping(index) {
    if (rendered.shopping === index) return;
    const item = scenarios[index];
    text('.shopping-card .ad-content h3', item.productName);
    text('.shopping-card .product-caption', item.productCaption);
    text('.shopping-card .product-bottom strong', item.price);
    productImage('.shopping-card .ad-content > .shoe', item.image, item.imageAlt);
    rendered.shopping = index;
  }

  function applyFilm(index) {
    if (rendered.film === index) return;
    const item = scenarios[index];
    productImage('.poster-frame .poster', item.poster, item.posterAlt);
    text('[data-story-slogan]', item.slogan);
    text('.video-card .ad-content h3', item.videoTitle);
    rendered.film = index;
  }

  function transition(node, time, start, apply, current, previous) {
    const progress = clamp((time - start) / 500);
    apply(progress < 0.5 ? previous : current);
    const opacity = Math.abs(progress * 2 - 1);
    node.style.opacity = opacity.toFixed(3);
    node.style.translate = `0 ${((1 - opacity) * 5).toFixed(2)}px`;
  }

  function render() {
    if (!scenarios.length) return;
    const turn = Math.floor(elapsed / cycleDuration);
    const current = turn % scenarios.length;
    const previous = turn === 0 ? 0 : (current + scenarios.length - 1) % scenarios.length;
    const time = elapsed % cycleDuration;
    const phrase = scenarios[current].query;
    const previousPhrase = scenarios[previous].query;
    let typed = phrase;
    if (time < 400)
      typed = previousPhrase.slice(0, Math.ceil(previousPhrase.length * (1 - time / 400)));
    else if (time < 2200)
      typed = phrase.slice(0, Math.floor(phrase.length * clamp((time - 550) / 1500)));
    if (query.textContent !== typed) query.textContent = typed;
    scene.toggleAttribute('data-story-typing', time < 2200);
    transition(search, time, 2200, applySearch, current, previous);
    transition(shopping, time, 3200, applyShopping, current, previous);
    transition(film, time, 4200, applyFilm, current, previous);

    const filmProgress = time < 4450 && turn > 0 ? 1 : clamp((time - 4700) / 6000);
    const titleProgress = time < 4450 && turn > 0 ? 1 : clamp((time - 4800) / 650);
    scene.style.setProperty('--film-progress', filmProgress.toFixed(4));
    scene.style.setProperty('--film-scale', (1.02 + filmProgress * 0.075).toFixed(4));
    scene.style.setProperty('--film-pan', `${(-1 + filmProgress * 2).toFixed(3)}%`);
    scene.style.setProperty('--film-title-opacity', titleProgress.toFixed(3));
    scene.style.setProperty('--film-title-offset', `${((1 - titleProgress) * 9).toFixed(2)}px`);
    const conversion =
      time >= 10200 && time <= 11400 ? Math.sin(((time - 10200) / 1200) * Math.PI) : 0;
    scene.style.setProperty('--conversion-strength', conversion.toFixed(4));
  }

  function tick(timestamp) {
    frame = 0;
    if (!running || !allowed || !scenarios.length) return;
    if (previousTime !== null) elapsed += Math.min(timestamp - previousTime, 100);
    previousTime = timestamp;
    render();
    frame = requestAnimationFrame(tick);
  }

  function staticScene() {
    elapsed = 0;
    if (!scenarios.length) return;
    applySearch(0);
    applyShopping(0);
    applyFilm(0);
    query.textContent = scenarios[0].query;
    scene.removeAttribute('data-story-typing');
    for (const node of [search, shopping, film]) {
      node.style.removeProperty('opacity');
      node.style.removeProperty('translate');
    }
  }

  function setState(state) {
    allowed = state.allowed;
    running = state.running;
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    scene.toggleAttribute('data-campaign-story', allowed && scenarios.length > 0);
    if (!allowed) staticScene();
    if (running && scenarios.length) frame = requestAnimationFrame(tick);
  }

  function decode(src) {
    const image = new Image();
    image.src = new URL(src, assetBase).href;
    return image.decode();
  }

  // A failed asset cannot replace a working static card with a broken image.
  fetch(scenarioURL)
    .then((response) => {
      if (!response.ok) throw new Error('Campaign examples unavailable');
      return response.json();
    })
    .then(async (config) => {
      const fields = [
        'query',
        'compactQuery',
        'domain',
        'searchTitle',
        'searchDescription',
        'productName',
        'productCaption',
        'price',
        'image',
        'imageAlt',
        'poster',
        'posterAlt',
        'slogan',
        'videoTitle',
      ];
      const candidates = config.scenarios.filter(
        (item) =>
          item &&
          fields.every((key) => typeof item[key] === 'string' && item[key].trim()) &&
          Array.isArray(item.sitelinks) &&
          item.sitelinks.length === 3 &&
          item.sitelinks.every((label) => typeof label === 'string'),
      );
      const ready = await Promise.allSettled(
        candidates.map(async (item) => {
          await Promise.all([decode(item.image), decode(item.poster)]);
          return item;
        }),
      );
      scenarios = ready
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      setState({ allowed, running });
    })
    .catch(() => {});

  return { setState };
}
