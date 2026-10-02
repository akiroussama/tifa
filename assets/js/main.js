(() => {
  'use strict';
  const { events, founders } = window.TIFA_CONTENT;
  const imagePath = id => `assets/images/facebook-${id}.jpg`;
  const create = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
  const photoItems = events.flatMap(event => event.images.map((id, index) => ({ id, event, alt: event.imageAlts[index] })));
  let photoIndex = 0;
  const eventDialog = document.querySelector('#event-dialog');
  const photoDialog = document.querySelector('#photo-dialog');
  let eventOpener = null;
  let photoOpener = null;
  const setScrollLock = () => document.body.classList.toggle('dialog-open', eventDialog.open || photoDialog.open);
  const openDialog = (dialog, opener) => { if (dialog === eventDialog) eventOpener = opener; else photoOpener = opener; dialog.showModal(); setScrollLock(); };
  const sourceLink = event => { const a = create('a', 'text-link', `Voir la source · ${event.sourceLabel} ↗`); a.href = event.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const renderPhoto = () => {
    const photo = photoItems[photoIndex];
    const img = document.querySelector('#photo-image'); img.src = imagePath(photo.id); img.alt = photo.alt;
    document.querySelector('#photo-caption').textContent = `${photo.alt} — ${photo.event.dateLabel}`;
    document.querySelector('#photo-count').textContent = `${photoIndex + 1} / ${photoItems.length}`;
    document.querySelector('#photo-source').href = photo.event.source;
  };
  const openPhoto = (id, opener) => { photoIndex = photoItems.findIndex(p => p.id === id); if (photoIndex < 0) return; renderPhoto(); openDialog(photoDialog, opener); };
  const openEvent = (event, opener) => {
    const container = document.querySelector('#dialog-content'); container.replaceChildren();
    if (event.images.length) { const img = create('img', 'dialog-banner'); img.src = imagePath(event.images[0]); img.alt = event.imageAlts[0]; container.append(img); }
    const body = create('div', 'dialog-body'); body.append(create('p', 'eyebrow dark', `${event.categoryLabel} · ${event.dateLabel}`));
    const title = create('h2', '', event.title); title.id = 'dialog-title'; body.append(title, create('p', '', event.body));
    if (event.images.length) { const gallery = create('div', 'dialog-gallery'); gallery.setAttribute('aria-label', 'Photographies de la rencontre'); event.images.forEach((id, i) => { const button = create('button'); button.type = 'button'; button.setAttribute('aria-label', `Agrandir : ${event.imageAlts[i]}`); const img = create('img'); img.src = imagePath(id); img.alt = ''; button.append(img); button.addEventListener('click', () => openPhoto(id, button)); gallery.append(button); }); body.append(gallery); }
    body.append(sourceLink(event));
    const details = create('details'); details.append(create('summary', '', 'À propos de cette fiche et de sa source'));
    details.append(create('p', 'dialog-date-note', `${event.dateNote} Le texte français est une adaptation éditoriale du contenu source.`));
    if (event.original) { details.append(create('p', '', 'Texte original de TIFA (anglais)'), create('p', 'original-text', event.original)); }
    body.append(details); container.append(body); openDialog(eventDialog, opener);
  };
  const eventGrid = document.querySelector('#events-grid');
  events.forEach(event => {
    const card = create('article', `event-card${event.images.length ? '' : ' text-event'}`); card.dataset.category = event.category;
    if (event.images.length) { const button = create('button', 'event-photo'); button.type = 'button'; button.setAttribute('aria-label', `Lire : ${event.title}`); const img = create('img'); img.src = imagePath(event.images[0]); img.alt = event.imageAlts[0]; img.loading = 'lazy'; img.width = 590; img.height = event.id.includes('leadership') ? 443 : 393; button.append(img, create('span', 'image-arrow', '↗')); button.lastChild.setAttribute('aria-hidden', 'true'); button.addEventListener('click', () => openEvent(event, button)); card.append(button); }
    else { const mark = create('span', 'event-mark', event.id === 'diwali-2025' ? '✦' : '↔'); mark.setAttribute('aria-hidden', 'true'); card.append(mark); }
    const copy = create('div', 'event-copy'); const meta = create('div', 'event-meta'); const time = create('time', '', event.dateLabel); time.dateTime = event.date;
    meta.append(create('span', 'event-category', event.categoryLabel), time); copy.append(meta, create('h3', '', event.title), create('p', '', event.summary));
    const read = create('button', 'text-link', 'Découvrir la rencontre ↗'); read.type = 'button'; read.setAttribute('aria-label', `Découvrir : ${event.title}`); read.addEventListener('click', () => openEvent(event, read)); copy.append(read); card.append(copy); eventGrid.append(card);
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter; let count = 0;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    eventGrid.querySelectorAll('.event-card').forEach(card => { card.hidden = filter !== 'all' && filter !== card.dataset.category; if (!card.hidden) count++; });
    document.querySelector('#filter-status').textContent = `${count} rencontre${count > 1 ? 's' : ''} affichée${count > 1 ? 's' : ''}`;
  }));
  founders.forEach(founder => { const card = create('article', 'founder'); const initials = create('div', 'founder-initials', founder.initials); initials.setAttribute('aria-hidden', 'true'); card.append(initials, create('h3', '', founder.name), create('p', 'founder-role', founder.role), create('p', 'founder-profession', founder.profession)); document.querySelector('#founders-grid').append(card); });
  photoItems.forEach(photo => { const button = create('button', `gallery-photo${photo.event.images.indexOf(photo.id) > 2 && photo.event.id.includes('leadership') ? ' portrait-photo' : ''}`); button.type = 'button'; button.setAttribute('aria-label', `Agrandir : ${photo.alt}`); const img = create('img'); img.src = imagePath(photo.id); img.alt = photo.alt; img.loading = 'lazy'; img.width = 590; img.height = 393; const plus = create('span', '', '+'); plus.setAttribute('aria-hidden', 'true'); button.append(img, plus); button.addEventListener('click', () => openPhoto(photo.id, button)); document.querySelector('#gallery-grid').append(button); });
  const menu = document.querySelector('.menu-toggle'); const navigation = document.querySelector('#navigation');
  const closeMenu = () => { navigation.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); navigation.classList.toggle('is-open', open); });
  navigation.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && navigation.classList.contains('is-open')) { closeMenu(); menu.focus(); } });
  [eventDialog, photoDialog].forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { setScrollLock(); const opener = dialog === eventDialog ? eventOpener : photoOpener; if (opener?.isConnected) opener.focus(); });
  });
  document.querySelector('#photo-prev').addEventListener('click', () => { photoIndex = (photoIndex - 1 + photoItems.length) % photoItems.length; renderPhoto(); });
  document.querySelector('#photo-next').addEventListener('click', () => { photoIndex = (photoIndex + 1) % photoItems.length; renderPhoto(); });
  photoDialog.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); photoIndex = (photoIndex + (e.key === 'ArrowRight' ? 1 : -1) + photoItems.length) % photoItems.length; renderPhoto(); } });
  document.querySelector('#year').textContent = new Date().getFullYear();
})();
