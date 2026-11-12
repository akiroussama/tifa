/* One language picker shared by the home, sources and legal pages. */
(() => {
  'use strict';
  const languages = {
    fr: { name: 'Français', flag: '<path fill="#fff" d="M0 0h28v20H0z"/><path fill="#0055a4" d="M0 0h9.34v20H0z"/><path fill="#ef4135" d="M18.66 0H28v20h-9.34z"/>' },
    en: { name: 'English', flag: '<path fill="#012169" d="M0 0h28v20H0z"/><path stroke="#fff" stroke-width="4" d="m0 0 28 20M28 0 0 20"/><path stroke="#c8102e" stroke-width="1.5" d="m0 0 28 20M28 0 0 20"/><path stroke="#fff" stroke-width="7" d="M14 0v20M0 10h28"/><path stroke="#c8102e" stroke-width="4" d="M14 0v20M0 10h28"/>' },
    ar: { name: 'العربية', flag: '<path fill="#e70013" d="M0 0h28v20H0z"/><circle cx="14" cy="10" r="5.6" fill="#fff"/><circle cx="13.7" cy="10" r="3.5" fill="#e70013"/><circle cx="14.9" cy="10" r="2.8" fill="#fff"/><path fill="#e70013" d="m16.9 8.3-.7 1.2 1 1-1.4-.1-.6 1.3-.3-1.4-1.4-.2 1.2-.7-.2-1.4 1 1z"/>' },
    hi: { name: 'हिन्दी', flag: '<path fill="#fff" d="M0 0h28v20H0z"/><path fill="#ff9933" d="M0 0h28v6.667H0z"/><path fill="#138808" d="M0 13.333h28V20H0z"/><circle cx="14" cy="10" r="2.55" fill="none" stroke="#000080" stroke-width=".5"/><path stroke="#000080" stroke-width=".34" d="M14 7.5v5M11.5 10h5m-4.27-1.77 3.54 3.54m0-3.54-3.54 3.54m.81-4.08 1.92 4.62m-3.27-1.35 4.62-1.92m-4.62 0 4.62 1.92m-3.27 1.35 1.92-4.62"/>' },
  };
  const root = document.documentElement;
  const key = 'tifa-language';
  const invited = 'tifa-language-invited';
  const available = value => value === 'fr' || (Object.hasOwn(languages, value) && Boolean(window.TIFA_MESSAGES?.[value]));
  const getPreference = () => { try { return localStorage.getItem(key); } catch { return null; } };
  const getInvitation = () => { try { return sessionStorage.getItem(invited); } catch { return null; } };
  const requested = new URLSearchParams(location.search).get('lang');
  const preference = getPreference();
  let language = available(requested) ? requested : available(preference) ? preference :
    (navigator.languages || [navigator.language]).map(value => (value || '').toLowerCase().split('-')[0]).find(available) || 'fr';
  const bundle = () => window.TIFA_MESSAGES?.[language];
  const t = (source, args = {}) => (bundle()?.text?.[source] ?? source)
    .replace(/\{(\w+)\}/g, (placeholder, name) => Object.hasOwn(args, name) ? String(args[name]) : placeholder);

  const staticTexts = [];
  const staticAttributes = [];
  const original = element => element.closest('script, style, svg, noscript, template, [lang]:not(html)');
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue;
    if (!/\p{L}/u.test(value) || original(node.parentElement)) continue;
    staticTexts.push({ node, value, source: value.trim().replace(/\s+/g, ' '),
      prefix: value.match(/^\s*/)[0], suffix: value.match(/\s*$/)[0] });
  }
  document.querySelectorAll('[aria-label], [alt], [title], meta[name="description"], meta[property="og:title"], meta[property="og:description"]').forEach(node => {
    if (original(node)) return;
    for (const attr of node.matches('meta') ? ['content'] : ['aria-label', 'alt', 'title']) {
      const value = node.getAttribute(attr);
      if (value) staticAttributes.push({ node, attr, value, source: value.trim().replace(/\s+/g, ' ') });
    }
  });

  function href(value) {
    if (!/^(?:index|constitution|mentions-legales)\.html(?:$|[?#])/.test(value)) return value;
    const url = new URL(value, location.href);
    url.searchParams.set('lang', language);
    return url.pathname + url.search + url.hash;
  }
  const documentLinks = [...document.querySelectorAll('a[href]')]
    .map(node => ({ node, value: node.getAttribute('href') }))
    .filter(({ value }) => /^(?:index|constitution|mentions-legales)\.html(?:$|[?#])/.test(value));

  const panel = document.createElement('aside');
  panel.className = 'language-nudge';
  panel.id = 'language-nudge';
  panel.hidden = true;
  panel.innerHTML = '<span class="language-nudge-label"></span><div class="language-nudge-options"></div><button class="language-nudge-close" type="button">×</button>';
  const label = panel.querySelector('.language-nudge-label');
  const options = panel.querySelector('.language-nudge-options');
  const close = panel.querySelector('.language-nudge-close');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'language-trigger';
  trigger.id = 'language-trigger';
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<span aria-hidden="true">🌐</span><span dir="ltr"></span>';
  for (const [code, { name, flag }] of Object.entries(languages)) {
    if (!available(code)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.language = code;
    button.lang = code;
    button.innerHTML = `<svg class="language-flag" viewBox="0 0 28 20" aria-hidden="true" focusable="false">${flag}</svg><span dir="auto">${name}</span>`;
    options.append(button);
    button.addEventListener('click', () => { apply(code, true); dismiss(true); });
  }
  document.querySelector('#language-dock').append(trigger, panel);

  function apply(next, remember = false) {
    language = next;
    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    for (const { node, value, source, prefix, suffix } of staticTexts) {
      const translation = bundle()?.text?.[source];
      node.nodeValue = translation == null ? value : prefix + translation + suffix;
    }
    for (const { node, attr, value, source } of staticAttributes) {
      node.setAttribute(attr, bundle()?.text?.[source] ?? value);
    }
    for (const { node, value } of documentLinks) node.setAttribute('href', href(value));
    for (const button of options.children) button.setAttribute('aria-pressed', String(button.dataset.language === language));
    label.textContent = t('Votre langue');
    panel.setAttribute('aria-label', t('Choisir une langue'));
    close.setAttribute('aria-label', t('Fermer'));
    trigger.setAttribute('aria-label', t('Changer de langue'));
    trigger.lastElementChild.textContent = language.toUpperCase();
    if (remember) {
      try { localStorage.setItem(key, language); } catch { /* The link still carries the choice. */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      try { history.replaceState(history.state, '', url); } catch { /* Language remains usable. */ }
    }
    window.dispatchEvent(new CustomEvent('tifa:languagechange', { detail: { language } }));
  }

  let inviteTimer, dismissTimer, automatic = false;
  function show(invitation = false) {
    clearTimeout(inviteTimer);
    clearTimeout(dismissTimer);
    if (document.querySelector('dialog[open]')) return;
    automatic = invitation;
    panel.hidden = false;
    requestAnimationFrame(() => { if (!panel.hidden) panel.classList.add('is-visible'); });
    trigger.setAttribute('aria-expanded', 'true');
    if (invitation) dismissTimer = setTimeout(() => dismiss(), 8500);
    else options.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }
  function dismiss(returnFocus = false) {
    clearTimeout(inviteTimer);
    clearTimeout(dismissTimer);
    automatic = false;
    panel.classList.remove('is-visible');
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    try { sessionStorage.setItem(invited, 'yes'); } catch { /* Per-page behavior is unchanged. */ }
    if (returnFocus) trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', () => panel.hidden ? show() : dismiss(true));
  close.addEventListener('click', () => dismiss(true));
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) dismiss();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); dismiss(!automatic); }
  });
  window.addEventListener('scroll', () => { if (automatic) dismiss(); }, { passive: true });

  window.TIFA_I18N = Object.freeze({ t, href, get language() { return language; },
    event: event => ({ ...event, ...bundle()?.events?.[event.id] }) });
  apply(language);
  if (!available(requested) && !available(preference) && !getInvitation() && window.scrollY < 40) {
    inviteTimer = setTimeout(() => { if (window.scrollY < 40) show(true); }, 500);
  }
})();
