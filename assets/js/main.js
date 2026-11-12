(() => {
  'use strict';
  const { events: sourceEvents, founders } = window.TIFA_CONTENT;
  const { t, href, event: translateEvent } = window.TIFA_I18N;
  const create = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
  let events = [];
  let photoItems = [];
  let publicationFeed;
  let photoIndex = 0;
  const eventDialog = document.querySelector('#event-dialog');
  const photoDialog = document.querySelector('#photo-dialog');
  let eventOpener = null;
  let photoOpener = null;
  let activeEventId = null;
  const markFrench = (element, french) => { if (french) { element.lang = 'fr'; element.dir = 'ltr'; } return element; };
  const publicationText = (tag, event, field, className = '') => markFrench(create(tag, className, event[field]), event.french?.has(field));
  const photoImage = (photo, className = '') => {
    const img = create('img', className);
    img.src = photo.url; img.alt = photo.alt;
    img.width = photo.width || 590; img.height = photo.height || 393;
    return markFrench(img, photo.lang === 'fr');
  };
  const setScrollLock = () => document.body.classList.toggle('dialog-open', eventDialog.open || photoDialog.open);
  const openDialog = (dialog, opener) => { if (dialog === eventDialog) eventOpener = opener; else photoOpener = opener; dialog.showModal(); setScrollLock(); };
  const sourceLink = source => { const a = create('a', 'text-link', t('Voir la source · {source} ↗', { source: t(source.sourceLabel) })); a.href = href(source.source); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const renderPhoto = () => {
    const photo = photoItems[photoIndex];
    const img = document.querySelector('#photo-image'); img.src = photo.url; img.alt = photo.alt;
    if (photo.lang) img.lang = photo.lang; else img.removeAttribute('lang');
    const caption = document.querySelector('#photo-caption');
    caption.replaceChildren(markFrench(create('span', '', photo.alt), photo.lang === 'fr'));
    if (photo.event.dateLabel) caption.append(` — ${photo.event.dateLabel}`);
    document.querySelector('#photo-count').textContent = `${photoIndex + 1} / ${photoItems.length}`;
    const source = document.querySelector('#photo-source'); source.hidden = !photo.event.source;
    if (photo.event.source) source.href = href(photo.event.source); else source.removeAttribute('href');
  };
  const openPhoto = (id, opener) => { photoIndex = photoItems.findIndex(p => p.id === id); if (photoIndex < 0) return; renderPhoto(); openDialog(photoDialog, opener); };
  const renderEvent = event => {
    const container = document.querySelector('#dialog-content'); container.replaceChildren();
    if (event.photos.length) container.append(photoImage(event.photos[0], 'dialog-banner'));
    const body = create('div', 'dialog-body'); body.append(create('p', 'eyebrow dark', [t(event.categoryLabel), event.dateLabel].filter(Boolean).join(' · ')));
    const title = publicationText('h2', event, 'title'); title.id = 'dialog-title'; body.append(title);
    if (event.french?.size) body.append(create('p', 'publication-language-note', t('Texte publié en français')));
    body.append(publicationText('p', event, 'body', 'publication-text'));
    if (event.photos.length) {
      const gallery = create('div', 'dialog-gallery'); gallery.setAttribute('aria-label', t('Photographies de la rencontre'));
      event.photos.forEach(photo => { const button = create('button'); button.type = 'button'; button.setAttribute('aria-label', t('Agrandir : {title}', { title: photo.alt })); const img = photoImage(photo); img.alt = ''; button.append(img); button.addEventListener('click', () => openPhoto(photo.id, button)); gallery.append(button); }); body.append(gallery);
    }
    const references = [event, ...(event.additionalSources || [])].filter(source => source.source);
    if (references.length) {
      const sources = create('div', 'dialog-sources'); sources.append(...references.map(sourceLink)); body.append(sources);
    }
    if (event.dateNote || event.original || references.length) {
      const details = create('details'); details.append(create('summary', '', t('À propos de cette fiche et de sa source')));
      const note = [event.dateNote, references.length && t('Cette fiche adapte le contenu de la source.')].filter(Boolean).join(' ');
      if (note) details.append(create('p', 'dialog-date-note', note));
      if (event.original) {
        const quotation = create('p', 'original-text', event.original);
        quotation.lang = 'en'; quotation.dir = 'ltr';
        details.append(create('p', '', t('Texte original (anglais)')), quotation);
      }
      body.append(details);
    }
    container.append(body);
  };
  const openEvent = (event, opener) => { activeEventId = event.id; renderEvent(event); openDialog(eventDialog, opener); };
  const eventGrid = document.querySelector('#events-grid');
  const renderCard = event => {
    const card = create('article', `event-card reveal${event.photos.length ? '' : ' text-event'}`); card.dataset.category = event.category;
    if (event.photos.length) { const button = create('button', 'event-photo'); button.type = 'button'; button.setAttribute('aria-label', t('Lire : {title}', { title: event.title })); const img = photoImage(event.photos[0]); img.loading = 'lazy'; button.append(img, create('span', 'image-arrow', '↗')); button.lastChild.setAttribute('aria-hidden', 'true'); button.addEventListener('click', () => openEvent(event, button)); card.append(button); }
    else { const mark = create('span', 'event-mark', event.id === 'diwali-2025' ? '✦' : '↔'); mark.setAttribute('aria-hidden', 'true'); card.append(mark); }
    const copy = create('div', 'event-copy'); const meta = create('div', 'event-meta');
    meta.append(create('span', 'event-category', t(event.categoryLabel)));
    if (event.dateLabel) { const time = create('time', '', event.dateLabel); if (/^\d{4}-\d{2}(-\d{2})?$/.test(event.date)) time.dateTime = event.date; meta.append(time); }
    copy.append(meta, publicationText('h3', event, 'title'), publicationText('p', event, 'summary'));
    const read = create('button', 'text-link', t('Découvrir la rencontre ↗')); read.type = 'button'; read.setAttribute('aria-label', t('Découvrir : {title}', { title: event.title })); read.addEventListener('click', () => openEvent(event, read)); copy.append(read); card.append(copy); return card;
  };
  const renderFounder = founder => {
    const card = create('article', 'founder reveal');
    const initials = create('div', 'founder-initials', founder.initials); initials.setAttribute('aria-hidden', 'true');
    card.append(initials, create('h3', '', t(founder.name)), create('p', 'founder-role', t(founder.role)), create('p', 'founder-profession', t(founder.profession)));
    return card;
  };
  const renderGalleryPhoto = photo => {
    const button = create('button', `gallery-photo${photo.portrait ? ' portrait-photo' : ''}`);
    button.type = 'button'; button.setAttribute('aria-label', t('Agrandir : {title}', { title: photo.alt }));
    const img = photoImage(photo); img.loading = 'lazy';
    const plus = create('span', '', '+'); plus.setAttribute('aria-hidden', 'true');
    button.append(img, plus); button.addEventListener('click', () => openPhoto(photo.id, button)); return button;
  };
  const archiveToggle = document.querySelector('#archive-toggle');
  const initialEventCount = 4; let activeFilter = 'all'; let archiveExpanded = false;
  const refreshEvents = () => {
    let count = 0;
    eventGrid.querySelectorAll('.event-card').forEach(card => {
      const matches = activeFilter === 'all' || activeFilter === card.dataset.category;
      card.hidden = !matches || (activeFilter === 'all' && !archiveExpanded && count >= initialEventCount);
      if (!card.hidden) count++;
    });
    document.querySelector('#filter-status').textContent = t(activeFilter === 'all' ? 'Rencontres affichées : {count} sur {total}' : 'Rencontres affichées : {count}', { count, total: events.length });
    archiveToggle.hidden = activeFilter !== 'all' || events.length <= initialEventCount;
    archiveToggle.setAttribute('aria-expanded', String(archiveExpanded));
    archiveToggle.textContent = archiveExpanded ? t('Réduire la liste ↑') : t('Voir toutes les rencontres ({total}) ↓', { total: events.length });
  };
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    refreshEvents();
  }));
  archiveToggle.addEventListener('click', () => {
    archiveExpanded = !archiveExpanded; refreshEvents();
    if (!archiveExpanded) requestAnimationFrame(() => archiveToggle.scrollIntoView({ block: 'nearest' }));
  });
  const menu = document.querySelector('.menu-toggle'); const navigation = document.querySelector('#navigation');
  const closeMenu = () => { navigation.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); navigation.classList.toggle('is-open', open); });
  navigation.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('pointerdown', e => {
    if (navigation.classList.contains('is-open') && !navigation.contains(e.target) && !menu.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', e => { if (!e.defaultPrevented && e.key === 'Escape' && navigation.classList.contains('is-open')) { closeMenu(); menu.focus(); } });
  [eventDialog, photoDialog].forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { setScrollLock(); const opener = dialog === eventDialog ? eventOpener : photoOpener; if (opener?.isConnected) opener.focus(); });
  });
  document.querySelector('#photo-prev').addEventListener('click', () => { photoIndex = (photoIndex - 1 + photoItems.length) % photoItems.length; renderPhoto(); });
  document.querySelector('#photo-next').addEventListener('click', () => { photoIndex = (photoIndex + 1) % photoItems.length; renderPhoto(); });
  photoDialog.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const rtl = document.documentElement.dir === 'rtl'; const next = (e.key === 'ArrowRight') !== rtl; photoIndex = (photoIndex + (next ? 1 : -1) + photoItems.length) % photoItems.length; renderPhoto(); } });
  document.querySelector('#year').textContent = new Date().getFullYear();
  const header = document.querySelector('#header');
  const onScroll = () => { header.classList.toggle('is-scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  let reveal;
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('js');
    reveal = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveal.unobserve(entry.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
  }
  const foundersGrid = document.querySelector('#founders-grid');
  const galleryGrid = document.querySelector('#gallery-grid');
  function renderContent() {
    for (const node of [...eventGrid.children, ...foundersGrid.children]) reveal?.unobserve(node);
    const currentPhoto = photoDialog.open ? photoItems[photoIndex]?.id : null;
    events = window.TIFA_PUBLICATIONS.merge(sourceEvents, publicationFeed, { translate: translateEvent,
      language: window.TIFA_I18N.language, t, local: ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) });
    photoItems = events.flatMap(event => event.photos.map(photo => ({ ...photo, event })));
    eventGrid.replaceChildren(...events.map(renderCard));
    foundersGrid.replaceChildren(...founders.map(renderFounder));
    galleryGrid.replaceChildren(...photoItems.map(renderGalleryPhoto));
    refreshEvents();
    for (const node of [...eventGrid.children, ...foundersGrid.children]) reveal?.observe(node);
    if (eventDialog.open) {
      const current = events.find(event => event.id === activeEventId);
      if (current) renderEvent(current); else eventDialog.close();
    }
    if (currentPhoto) {
      photoIndex = photoItems.findIndex(photo => photo.id === currentPhoto);
      if (photoIndex >= 0) renderPhoto(); else photoDialog.close();
    }
  }
  window.addEventListener('tifa:languagechange', renderContent);
  renderContent();
  fetch('/api/publications', { credentials: 'omit', headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : null)
    .then(feed => {
      if (!Array.isArray(feed?.publications) || !Array.isArray(feed?.hiddenIds)) return;
      if (!feed.publications.length && !feed.hiddenIds.length) return;
      publicationFeed = feed;
      renderContent();
    }).catch(() => { /* The versioned archive remains visible if the bureau is unavailable. */ });
})();
