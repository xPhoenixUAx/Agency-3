import { configReady } from './brand.js';
import { createFormEnvelope } from './form-envelope.js';

const form = document.querySelector('[data-audit-form]');
const endpoint = new URL('../api/lead.php', import.meta.url);

if (form) {
  const status = form.closest('[data-form-scene]').querySelector('[data-form-announcement]');
  const confirmation = createFormEnvelope(form);
  const submit = form.querySelector('[type=submit]');
  const submitLabel = submit.querySelector('[data-content="submit"]');
  let csrf = '';
  let sending = false;
  let cfg;
  let sessionRequest;

  function token() {
    if (sessionRequest) return sessionRequest;
    sessionRequest = (async () => {
      const response = await fetch(endpoint, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      const result = await response.json();
      if (!response.ok || typeof result.csrf !== 'string') throw new Error('Session unavailable');
      csrf = result.csrf;
    })().finally(() => {
      sessionRequest = null;
    });
    return sessionRequest;
  }

  // Server availability does not prevent the visitor from completing the form.
  void token().catch(() => {});
  configReady
    .then((config) => {
      cfg = config;
    })
    .catch(() => {})
    .finally(() => {
      submit.disabled = false;
    });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || form.inert || !form.reportValidity()) return;

    sending = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your request\u2026';
    submitLabel.textContent = 'Sending your request\u2026';
    const data = new FormData(form);
    const presentation = confirmation.show();
    let confirmed = false;

    try {
      if (!csrf) await token();
      data.set('csrf', csrf);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json();
      confirmed = response.ok && result.ok === true;
    } catch {
      // The requested presentation is identical even when delivery is unconfirmed.
    } finally {
      // Keep the actual delivery outcome distinct from the visual confirmation.
      form.dataset.delivery = confirmed ? 'confirmed' : 'unconfirmed';
      await presentation;
      form.reset();
      submitLabel.textContent = cfg?.content.submit || 'Request my free audit';
      form.removeAttribute('aria-busy');
      submit.disabled = false;
      sending = false;
      csrf = '';
      confirmation.ready();
    }
  });
}
