// Public brand details only. Mail transport settings belong in api/server.php.
const configURL = new URL('../config/site.json', import.meta.url);
const formURL = new URL('../config/form.json', import.meta.url);
const siteURL = new URL('../', import.meta.url);
const pages = ['index', 'google-ads', 'tracking', 'results', 'privacy', 'terms', 'cookie-policy'];

function assetURL(value) {
  if (!value) return null;
  if (typeof value !== 'string' || /[\r\n]/.test(value))
    throw new Error('Invalid brand asset path.');
  const url = new URL(value, siteURL);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid brand asset URL.');
  return url.href;
}

export function validateConfig(brand) {
  if (!brand || typeof brand !== 'object') throw new Error('Invalid brand config.');
  for (const key of ['name', 'legalName', 'email', 'address', 'website', 'description']) {
    if (typeof brand[key] !== 'string' || !brand[key].trim())
      throw new Error(`Missing ${key} in site.json.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brand.email)) throw new Error('Invalid contact email.');
  const website = new URL(brand.website);
  if (
    !['https:', 'http:'].includes(website.protocol) ||
    website.username ||
    website.password ||
    website.search ||
    website.hash
  )
    throw new Error('Invalid website URL.');
  for (const key of ['logo', 'logoLight', 'favicon']) {
    if (brand[key] !== undefined && typeof brand[key] !== 'string')
      throw new Error(`Invalid ${key} in site.json.`);
    assetURL(brand[key]);
  }
  if (brand.logoShowName !== undefined && typeof brand.logoShowName !== 'boolean')
    throw new Error('Invalid logoShowName in site.json.');
  if (brand.indexable !== undefined && typeof brand.indexable !== 'boolean')
    throw new Error('Invalid indexable in site.json.');
  if (
    !brand.titles ||
    typeof brand.titles !== 'object' ||
    Array.isArray(brand.titles) ||
    pages.some((page) => typeof brand.titles[page] !== 'string' || !brand.titles[page].trim())
  )
    throw new Error('Invalid titles in site.json.');
  return brand;
}

function validateForm(options) {
  for (const key of ['businessTypes', 'budgets', 'needs']) {
    if (
      !Array.isArray(options?.[key]) ||
      !options[key].length ||
      options[key].some((value) => typeof value !== 'string' || !value.trim())
    )
      throw new Error(`Invalid ${key} in form.json.`);
  }
  return options;
}

export function applyBrand(brand) {
  document.documentElement.dataset.longBrand = brand.name.length > 18 ? 'true' : 'false';
  document.querySelectorAll('[data-brand]').forEach((el) => {
    const value = brand[el.dataset.brand];
    if (typeof value === 'string') el.textContent = value;
  });
  document.querySelectorAll('[data-email]').forEach((el) => {
    if (!el.hasAttribute('data-email-label')) el.textContent = brand.email;
    el.href = `mailto:${brand.email}`;
  });
  document.querySelectorAll('[data-logo]').forEach((el) => {
    el.closest('a')?.setAttribute('aria-label', `${brand.name} home`);
    const source = el.dataset.logoVariant === 'light' ? brand.logoLight || brand.logo : brand.logo;
    const url = assetURL(source);
    const showName = brand.logoShowName !== false || !url;
    const wordmark = document.createElement('span');
    wordmark.className = 'brand-wordmark';
    wordmark.textContent = brand.name;
    el.classList.toggle('brand-lockup', showName);
    if (!url) {
      el.replaceChildren(wordmark);
      return;
    }
    const img = document.createElement('img');
    img.alt = showName ? '' : brand.name;
    if (showName) img.setAttribute('aria-hidden', 'true');
    img.addEventListener(
      'error',
      () => {
        if (!img.isConnected) return;
        el.classList.add('brand-lockup');
        el.replaceChildren(wordmark);
      },
      { once: true },
    );
    img.src = url;
    el.replaceChildren(...(showName ? [img, wordmark] : [img]));
  });
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  const page = location.pathname.split('/').pop() || 'index.html';
  const title = brand.titles[page.replace(/\.html$/, '')];
  document.title = `${title} | ${brand.name}`;
  document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', brand.name);
  document
    .querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')
    .forEach((el) => el.setAttribute('content', document.title));
  const canonical = new URL(page, `${brand.website.replace(/\/+$/, '')}/`).href;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
  document
    .querySelector('meta[name="robots"]')
    ?.setAttribute('content', brand.indexable ? 'index, follow' : 'noindex, nofollow');
  if (page === 'index.html') {
    document
      .querySelectorAll(
        'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]',
      )
      .forEach((el) => el.setAttribute('content', brand.description));
  }

  const faviconURL = assetURL(brand.favicon);
  if (faviconURL) {
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.append(icon);
    }
    icon.href = faviconURL;
    // Let the browser detect SVG, PNG or ICO instead of retaining the old SVG type.
    icon.removeAttribute('type');
  } else {
    document.querySelectorAll('link[rel="icon"]').forEach((icon) => icon.remove());
  }
}

async function readJSON(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Cannot load ${url.pathname}.`);
  return response.json();
}

const brandReady = readJSON(configURL)
  .then(validateConfig)
  .then((brand) => {
    applyBrand(brand);
    return brand;
  });
const formReady = readJSON(formURL)
  .then(validateForm)
  .then((options) => {
    document.querySelectorAll('select[data-options]').forEach((el) => {
      const selected = el.value;
      el.replaceChildren(new Option('Select an option', ''));
      options[el.dataset.options].forEach((value) => el.add(new Option(value, value)));
      if (options[el.dataset.options].includes(selected)) el.value = selected;
    });
    return options;
  });

// Internal behavior defaults; these are not part of the editable brand file.
export const configReady = Promise.all([brandReady, formReady]).then(([brand, form]) => ({
  brand,
  form,
  features: { animations: true, showIllustrativeCases: true },
}));
configReady.catch(() => {
  document.querySelectorAll('[data-config-error]').forEach((el) => {
    el.hidden = false;
  });
});
