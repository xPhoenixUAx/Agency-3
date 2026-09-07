// Informational notice: there are currently no optional tracking categories.
const endpoint = new URL('../api/cookie-notice.php', import.meta.url);
const policy = new URL('../cookie-policy.html', import.meta.url);
const notice = document.createElement('section');
notice.className = 'cookie-notice';
notice.hidden = true;
notice.setAttribute('aria-labelledby', 'cookie-notice-title');
notice.innerHTML = `
  <div class="cookie-notice-heading">
    <span class="cookie-notice-icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 3 27 7v8c0 7-6 11-11 14C11 26 5 22 5 15V7L16 3Z"
          stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        <path d="m11 16 3 3 7-7" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <div>
      <p class="cookie-notice-label">YOUR PRIVACY</p>
      <h2 id="cookie-notice-title">Only the essentials.</h2>
    </div>
  </div>
  <p class="cookie-notice-copy">We use a necessary session cookie to protect our enquiry form.
    No analytics or advertising cookies.</p>
  <p class="cookie-notice-memory">Closing this notice is remembered in your secure session until it expires.</p>
  <div class="cookie-notice-actions">
    <a class="cookie-notice-policy">Cookie Policy <span aria-hidden="true">↗</span></a>
    <button class="button" type="button" data-cookie-dismiss>Got it <span aria-hidden="true">✓</span></button>
  </div>
`;
notice.querySelector('a').href = policy.href;
const header = document.querySelector('.site-header');
if (header) header.after(notice);
else document.body.prepend(notice);

const reopen = document.createElement('button');
reopen.type = 'button';
reopen.className = 'cookie-notice-reopen';
reopen.textContent = 'Cookie notice';
reopen.setAttribute('aria-controls', 'cookie-notice');
reopen.setAttribute('aria-expanded', 'false');
notice.id = 'cookie-notice';
document.querySelector('.footer-bottom nav')?.append(reopen);

const dismiss = notice.querySelector('[data-cookie-dismiss]');
let openedManually = false;
let interacted = false;

function resizeNotice() {
  const space = notice.hidden ? 0 : Math.ceil(notice.getBoundingClientRect().height) + 40;
  document.documentElement.style.setProperty('--cookie-notice-space', `${space}px`);
}

function showNotice() {
  notice.hidden = false;
  reopen.setAttribute('aria-expanded', 'true');
  resizeNotice();
}

async function request(method = 'GET') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(endpoint, {
      method,
      credentials: 'same-origin',
      keepalive: method === 'POST',
      cache: 'no-store',
      signal: controller.signal,
      ...(method === 'POST' ? { headers: { 'X-Cookie-Notice': '1' } } : {}),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.ok === true ? result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

reopen.addEventListener('click', () => {
  interacted = true;
  openedManually = true;
  showNotice();
  dismiss.focus({ preventScroll: true });
});

dismiss.addEventListener('click', () => {
  interacted = true;
  notice.hidden = true;
  reopen.setAttribute('aria-expanded', 'false');
  resizeNotice();
  if (openedManually) reopen.focus({ preventScroll: true });
  else {
    const main = document.querySelector('main');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }
  openedManually = false;
  // A failed save only means the notice may appear again; browsing stays available.
  void request('POST');
});

if ('ResizeObserver' in window) new ResizeObserver(resizeNotice).observe(notice);
window.addEventListener('resize', resizeNotice);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    void request().then((state) => {
      if (state?.dismissed === true && !openedManually) {
        notice.hidden = true;
        reopen.setAttribute('aria-expanded', 'false');
        resizeNotice();
      }
    });
  }
});

void request().then((state) => {
  if (!interacted && state?.dismissed !== true) showNotice();
});
