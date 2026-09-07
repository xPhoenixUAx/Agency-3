// One public source of truth. Do not put passwords or mail credentials in site.json.
const configURL = new URL('../config/site.json', import.meta.url);
const safeLink = (value) => {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
  try {
    const u = new URL(value, document.baseURI);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
export function validateConfig(c) {
  if (!c || typeof c !== 'object') throw new Error('Config must be an object.');
  for (const key of ['name', 'legalName', 'email', 'address', 'website', 'description', 'logo']) {
    if (typeof c.brand?.[key] !== 'string') throw new Error(`Missing brand.${key}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.brand.email)) throw new Error('Invalid contact email.');
  for (const key of [
    'primary',
    'accent',
    'ink',
    'muted',
    'surface',
    'paper',
    'border',
    'success',
  ]) {
    if (!/^#[0-9a-f]{6}$/i.test(c.colors?.[key] || '')) throw new Error(`Invalid color: ${key}`);
  }
  for (const key of ['businessTypes', 'budgets', 'needs']) {
    if (
      !Array.isArray(c.form?.[key]) ||
      !c.form[key].length ||
      c.form[key].some((x) => typeof x !== 'string' || !x.trim())
    )
      throw new Error(`Invalid form.${key}`);
  }
  for (const key of [
    'heroTitle',
    'heroTitleEnd',
    'heroDescription',
    'cta',
    'submit',
    'success',
    'footer',
  ]) {
    if (typeof c.content?.[key] !== 'string') throw new Error(`Missing content.${key}`);
  }
  for (const key of ['audit', 'privacy', 'terms']) {
    if (typeof c.links?.[key] !== 'string' || !safeLink(c.links[key]))
      throw new Error(`Invalid link: ${key}`);
  }
  if (
    !c.features ||
    typeof c.features.showIllustrativeCases !== 'boolean' ||
    typeof c.features.animations !== 'boolean'
  )
    throw new Error('Invalid features.');
  return c;
}
export function contrastInk(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return lum > 0.179 ? '#161019' : '#FFFFFF';
}
export function applyBrand(c) {
  document.documentElement.dataset.longBrand = c.brand.name.length > 18 ? 'true' : 'false';
  for (const [key, value] of Object.entries(c.colors))
    document.documentElement.style.setProperty(`--${key}`, value);
  document.querySelectorAll('[data-brand]').forEach((el) => {
    const value = c.brand[el.dataset.brand];
    if (typeof value === 'string') el.textContent = value;
  });
  document.querySelectorAll('[data-content]').forEach((el) => {
    const value = c.content[el.dataset.content];
    if (typeof value === 'string') el.textContent = value;
  });
  document.querySelectorAll('[data-link]').forEach((el) => {
    const href = safeLink(c.links[el.dataset.link]);
    if (href) {
      const target = new URL(href);
      if (el.dataset.link === 'audit' && el.dataset.auditNeed)
        target.searchParams.set('need', el.dataset.auditNeed);
      el.href = target.href;
    }
  });
  document.querySelectorAll('[data-email]').forEach((el) => {
    if (!el.hasAttribute('data-email-label')) el.textContent = c.brand.email;
    el.href = `mailto:${c.brand.email}`;
  });
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
  document.querySelectorAll('[data-logo]').forEach((el) => {
    el.closest('a')?.setAttribute('aria-label', `${c.brand.name} home`);
    const symbol = c.brand.logoMode === 'symbol';
    el.classList.toggle('brand-lockup', symbol);
    const source =
      el.dataset.logoVariant === 'light' ? c.brand.logoDark || c.brand.logo : c.brand.logo;
    const url = c.brand.logo && safeLink(source);
    if (!url) {
      el.textContent = c.brand.name;
    }
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = symbol ? '' : c.brand.name;
      if (symbol) img.setAttribute('aria-hidden', 'true');
      img.addEventListener(
        'error',
        () => {
          el.textContent = c.brand.name;
        },
        { once: true },
      );
      if (symbol) {
        const wordmark = document.createElement('span');
        wordmark.className = 'brand-wordmark';
        wordmark.textContent = c.brand.name;
        el.replaceChildren(img, wordmark);
      } else {
        el.replaceChildren(img);
      }
    }
  });
  document.querySelectorAll('select[data-options]').forEach((el) => {
    const options = c.form[el.dataset.options];
    el.replaceChildren(new Option('Select an option', ''));
    options.forEach((value) => el.add(new Option(value, value)));
  });
  document.querySelectorAll('[data-illustrative]').forEach((el) => {
    el.hidden = !c.features.showIllustrativeCases;
  });
  document.documentElement.dataset.animations = c.features.animations ? 'on' : 'off';
  document.documentElement.style.setProperty('--accent-text', contrastInk(c.colors.accent));
  document.documentElement.style.setProperty('--primary-text', contrastInk(c.colors.primary));
  const page =
    location.pathname
      .split('/')
      .pop()
      .replace(/\.html$/, '') || 'index';
  const suffix = c.seo?.pages?.[page]?.title || document.documentElement.dataset.pageTitle;
  if (suffix) document.title = `${suffix} | ${c.brand.name}`;
}
export const configReady = fetch(configURL, { cache: 'no-cache' })
  .then((response) => {
    if (!response.ok) throw new Error('Cannot load site.json');
    return response.json();
  })
  .then(validateConfig)
  .then((c) => {
    applyBrand(c);
    return c;
  });
configReady.catch(() => {
  document.querySelectorAll('[data-config-error]').forEach((el) => {
    el.hidden = false;
  });
});
