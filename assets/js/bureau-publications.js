(() => {
  'use strict';

  const MAX_PHOTOS = 12;
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 2000;
  const categories = {
    culture: 'Culture',
    cooperation: 'Coopération',
    diplomatie: 'Diplomatie',
    association: 'Vie associative'
  };
  const $ = id => document.getElementById(id);
  const views = ['loading', 'login', 'list', 'editor', 'preview'];
  const state = {
    authenticated: false,
    publications: [],
    tab: 'published',
    view: 'loading',
    draft: null,
    busy: false,
    processingPhotos: false,
    loginBusy: false
  };
  let confirmationResolver = null;

  class RequestError extends Error {
    constructor(status, code) {
      super(code || 'request_failed');
      this.status = status;
      this.code = code || '';
    }
  }

  async function request(path, payload) {
    let response;
    try {
      response = await fetch(path, {
        method: payload === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: payload === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-TIFA-Admin': '1' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
      });
    } catch (_) {
      throw new RequestError(0, 'network');
    }
    let data = null;
    try { data = await response.json(); } catch (_) { /* The response can be empty on an error. */ }
    if (!response.ok) throw new RequestError(response.status, data?.code || data?.error || 'request_failed');
    if (!data || typeof data !== 'object') throw new RequestError(502, 'invalid_response');
    return data;
  }

  function friendlyError(error) {
    const draftNote = state.draft ? ' Votre brouillon reste dans cette page.' : '';
    if (error?.status === 0) return 'La connexion a été interrompue. Vérifiez votre accès à Internet, puis réessayez.' + draftNote;
    if (error?.status === 409) return state.draft
      ? 'Cette publication a changé depuis son ouverture. Vos modifications n’ont pas été enregistrées. Pour reprendre la version actuelle, annulez ce brouillon puis rouvrez la publication.'
      : 'Cette publication a changé depuis l’affichage de la liste. Vérifiez son état avant de réessayer.';
    if (error?.status === 413) return 'L’une des photos est trop volumineuse. Retirez-la, puis choisissez une photo JPEG ou PNG plus petite.';
    if (error?.status === 429) return 'Il y a eu plusieurs tentatives rapprochées. Patientez un moment, puis réessayez.';
    if (error?.status === 403) return 'Cette action n’a pas été autorisée. Rouvrez cet espace depuis son adresse habituelle, puis reconnectez-vous.';
    if (error?.status >= 500) return 'L’espace de publication est momentanément indisponible. Réessayez dans un moment.' + draftNote;
    const messages = {
      invalid_title: 'Le titre doit contenir entre 3 et 180 caractères.',
      invalid_body: 'Le texte doit contenir entre 10 et 20 000 caractères.',
      invalid_date: 'Choisissez une date réelle entre 1950 et 2100, ou laissez la date vide.',
      invalid_event_date: 'Choisissez une date réelle entre 1950 et 2100, ou laissez la date vide.',
      invalid_location: 'Le lieu doit contenir au maximum 160 caractères.',
      invalid_category: 'Choisissez un thème dans la liste.',
      invalid_photos: 'Vérifiez les photos de la publication. Vous pouvez en ajouter 12 au maximum.',
      invalid_image: 'Cette photo n’a pas pu être ouverte. Essayez une autre image JPEG ou PNG.',
      not_found: 'Cette publication n’est plus disponible. Rechargez la liste pour vérifier son état.'
    };
    return messages[error?.code] || 'L’action n’a pas pu être confirmée. Réessayez dans un moment.' + draftNote;
  }

  function notice(message, isError = false) {
    $('notice').textContent = message;
    $('notice').classList.toggle('notice-error', isError);
    $('notice').hidden = !message;
  }

  function inlineError(id, message) {
    $(id).textContent = message;
    $(id).hidden = !message;
  }

  function showView(name, focus = true) {
    state.view = name;
    for (const view of views) $(view + '-view').hidden = view !== name;
    $('logout-button').hidden = !state.authenticated;
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      const heading = $(name + '-view').querySelector('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    updateControls();
  }

  function requireLogin() {
    state.authenticated = false;
    $('bureau-password').value = '';
    inlineError('login-error', '');
    $('login-context').textContent = state.draft
      ? 'Votre session est terminée. Reconnectez-vous pour continuer : votre texte et vos photos restent dans cette page.'
      : 'Votre session est terminée. Reconnectez-vous pour retrouver vos publications.';
    $('login-context').hidden = false;
    notice('');
    showView('login');
    $('bureau-password').focus();
  }

  function handleFailure(error, target) {
    if (error?.status === 401) {
      requireLogin();
      return;
    }
    if (error?.status === 409 && state.draft) state.draft.conflict = true;
    if (target) {
      inlineError(target, friendlyError(error));
      if ($(target).hasAttribute('tabindex')) $(target).focus();
    } else notice(friendlyError(error), true);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function safeImageUrl(value) {
    if (typeof value !== 'string') return '';
    if (/^blob:/.test(value) || /^data:image\/jpeg;base64,/.test(value)) return value;
    try {
      // Legacy photo paths are relative to the site root, including on a trailing-slash admin URL.
      const url = new URL(value, window.location.origin + '/');
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function imageElement(url, alt, loading = 'lazy') {
    const image = createElement('img');
    const safeUrl = safeImageUrl(url);
    if (safeUrl) image.src = safeUrl;
    image.alt = alt || '';
    image.loading = loading;
    image.decoding = 'async';
    return image;
  }

  function validIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function formatDate(value) {
    if (!validIsoDate(value)) return '';
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
  }

  function publicationDate(publication) {
    return String(publication.dateLabel || '').trim() || formatDate(publication.eventDate) || 'Date non précisée';
  }

  async function loadPublications() {
    const data = await request('/api/publications?admin=1');
    if (!Array.isArray(data.publications)) throw new RequestError(502, 'invalid_response');
    state.publications = data.publications;
    renderList();
  }

  function renderList() {
    const archived = state.tab === 'archived';
    const rows = state.publications.filter(publication => Boolean(publication.archived) === archived);
    $('published-count').textContent = String(state.publications.filter(publication => !publication.archived).length);
    $('archived-count').textContent = String(state.publications.filter(publication => publication.archived).length);
    for (const tab of ['published', 'archived']) {
      $(tab + '-tab').setAttribute('aria-selected', String(state.tab === tab));
      $(tab + '-tab').tabIndex = state.tab === tab ? 0 : -1;
    }
    $('publication-list').setAttribute('aria-labelledby', state.tab + '-tab');
    $('list-description').textContent = archived ? 'Ces publications sont conservées ici et ne sont plus visibles sur le site.' : 'Ces publications sont visibles sur le site.';
    $('empty-title').textContent = archived ? 'Aucune publication retirée' : 'Votre première nouvelle';
    $('empty-copy').textContent = archived ? 'Une publication retirée du site apparaîtra ici. Vous pourrez la restaurer à tout moment.' : 'Ajoutez une publication pour raconter la vie de l’association.';
    $('empty-state').hidden = rows.length > 0;
    $('publication-list').replaceChildren();
    for (const publication of rows) {
      const card = createElement('article', 'publication-card');
      const thumbnail = createElement('div', 'publication-thumb');
      const cover = Array.isArray(publication.photos) ? publication.photos[0] : null;
      if (cover?.url) thumbnail.append(imageElement(cover.url, cover.alt || ''));
      else thumbnail.append(createElement('span', '', 'Sans photo'));
      const content = createElement('div', 'publication-content');
      content.append(createElement('p', 'publication-date', publicationDate(publication)), createElement('h2', '', String(publication.title || 'Publication sans titre')));
      if (publication.summary) content.append(createElement('p', 'publication-summary', String(publication.summary)));
      const actions = createElement('div', 'card-actions');
      if (!archived) {
        const edit = createElement('button', 'button button-secondary', 'Modifier');
        edit.type = 'button';
        edit.setAttribute('aria-label', 'Modifier : ' + publication.title);
        edit.addEventListener('click', () => openEditor(publication));
        const remove = createElement('button', 'button button-danger', 'Retirer du site');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Retirer du site : ' + publication.title);
        remove.addEventListener('click', () => changePublicationState(publication, 'archive'));
        actions.append(edit, remove);
      } else {
        const restore = createElement('button', 'button button-secondary restore-button', 'Restaurer');
        restore.type = 'button';
        restore.setAttribute('aria-label', 'Restaurer : ' + publication.title);
        restore.addEventListener('click', () => changePublicationState(publication, 'restore'));
        actions.append(restore);
      }
      card.append(thumbnail, content, actions);
      $('publication-list').append(card);
    }
    updateControls();
  }

  function askConfirmation({ title, copy, accept, cancel = 'Annuler', danger = false }) {
    if (confirmationResolver) return Promise.resolve(false);
    $('confirm-title').textContent = title;
    $('confirm-copy').textContent = copy;
    $('confirm-accept').textContent = accept;
    $('confirm-cancel').textContent = cancel;
    $('confirm-accept').className = 'button ' + (danger ? 'button-danger' : 'button-primary');
    return new Promise(resolve => {
      confirmationResolver = resolve;
      $('confirm-dialog').showModal();
      $('confirm-cancel').focus();
    });
  }

  function finishConfirmation(accepted) {
    const resolve = confirmationResolver;
    confirmationResolver = null;
    $('confirm-dialog').close();
    if (resolve) resolve(accepted);
  }

  async function changePublicationState(publication, action) {
    if (state.busy) return;
    const archive = action === 'archive';
    const confirmed = await askConfirmation({
      title: archive ? 'Retirer cette publication ?' : 'Restaurer cette publication ?',
      copy: archive ? '« ' + publication.title + ' » ne sera plus visible sur le site. Ses photos seront conservées et vous pourrez la restaurer dans l’onglet « Retirées ».' : '« ' + publication.title + ' » sera à nouveau visible sur le site, avec ses photos.',
      accept: archive ? 'Retirer du site' : 'Restaurer',
      danger: archive
    });
    if (!confirmed) return;
    state.busy = true;
    updateControls();
    notice(archive ? 'Retrait de la publication…' : 'Restauration de la publication…');
    inlineError('list-error', '');
    try {
      const data = await request('/api/publications', { action, id: publication.id, revision: publication.revision });
      if (data.publication?.id) upsertPublication(data.publication);
      else await loadPublications();
      renderList();
      notice(archive ? 'La publication a été retirée du site. Vous la retrouverez dans « Retirées ».' : 'La publication est de nouveau visible sur le site.');
    } catch (error) {
      notice('');
      handleFailure(error, 'list-error');
      if (error?.status === 409) {
        try { await loadPublications(); } catch (refreshError) { if (refreshError?.status === 401) requireLogin(); }
      }
    } finally {
      state.busy = false;
      updateControls();
    }
  }

  function upsertPublication(publication) {
    const index = state.publications.findIndex(item => item.id === publication.id);
    if (index < 0) state.publications.unshift(publication);
    else state.publications[index] = publication;
  }

  function photoKey(photo) { return photo.clientId || String(photo.id); }

  function draftSnapshot() {
    const draft = state.draft;
    if (!draft) return '';
    return JSON.stringify({ title: draft.title, body: draft.body, eventDate: draft.eventDate, location: draft.location, category: draft.category, photos: draft.photos.map(photoKey) });
  }

  function isDirty() { return Boolean(state.draft && draftSnapshot() !== state.draft.baseline); }

  function revokeDraftPhotos() {
    if (state.draft) for (const photo of state.draft.photos) if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
  }

  async function canDiscardDraft() {
    if (state.busy || state.processingPhotos) return false;
    if (!isDirty()) return true;
    return askConfirmation({ title: 'Quitter sans enregistrer ?', copy: 'Votre texte et vos nouvelles photos ne seront pas conservés. Vous pouvez continuer à modifier votre publication.', accept: 'Quitter sans enregistrer', cancel: 'Continuer à modifier', danger: true });
  }

  async function openEditor(publication = null) {
    if (!(await canDiscardDraft())) return;
    revokeDraftPhotos();
    state.draft = {
      id: publication?.id,
      revision: publication?.revision,
      title: String(publication?.title || ''),
      body: String(publication?.body || ''),
      eventDate: validIsoDate(publication?.eventDate) ? publication.eventDate : '',
      initialEventDate: validIsoDate(publication?.eventDate) ? publication.eventDate : '',
      legacyDateLabel: String(publication?.dateLabel || '').trim(),
      location: String(publication?.location || ''),
      category: Object.hasOwn(categories, publication?.category) ? publication.category : 'culture',
      photos: (Array.isArray(publication?.photos) ? publication.photos : []).map(photo => ({ id: photo.id, url: photo.url, alt: photo.alt || '', width: photo.width, height: photo.height })),
      baseline: ''
    };
    state.draft.baseline = draftSnapshot();
    fillEditor();
    inlineError('editor-error', '');
    inlineError('preview-error', '');
    inlineError('photo-error', '');
    $('photo-status').textContent = '';
    notice('');
    showView('editor');
    $('publication-title').focus();
  }

  function fillEditor() {
    if (!state.draft) return;
    const draft = state.draft;
    $('editor-title').textContent = draft.id ? 'Modifier la publication' : 'Ajouter une publication';
    $('publication-title').value = draft.title;
    $('publication-body').value = draft.body;
    $('publication-date').value = draft.eventDate;
    renderExistingDateNote();
    $('publication-location').value = draft.location;
    $('publication-category').value = draft.category;
    for (const input of $('publication-form').querySelectorAll('input,textarea')) {
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
    }
    renderPhotos();
    updateDraftState();
  }

  function renderExistingDateNote() {
    const draft = state.draft;
    const note = $('existing-date-note');
    const hasPartialDate = Boolean(draft?.legacyDateLabel && !draft.initialEventDate && !draft.eventDate);
    note.textContent = hasPartialDate ? 'Date actuellement affichée : ' + draft.legacyDateLabel + '. Laissez le champ vide pour la conserver.' : '';
    note.hidden = !hasPartialDate;
  }

  function syncDraft() {
    if (!state.draft) return;
    state.draft.title = $('publication-title').value;
    state.draft.body = $('publication-body').value;
    state.draft.eventDate = $('publication-date').value;
    renderExistingDateNote();
    state.draft.location = $('publication-location').value;
    state.draft.category = $('publication-category').value;
    updateDraftState();
  }

  function updateDraftState() {
    $('draft-state').textContent = isDirty() ? 'Modifications non enregistrées' : 'Brouillon';
  }

  function updateControls() {
    const locked = state.busy || state.processingPhotos;
    $('logout-button').disabled = locked;
    $('add-button').disabled = locked;
    $('editor-fields').disabled = locked;
    $('preview-button').disabled = locked;
    $('publish-button').disabled = locked;
    $('back-to-edit').disabled = locked;
    $('choose-photos').disabled = locked || (state.draft?.photos.length || 0) >= MAX_PHOTOS;
    for (const button of document.querySelectorAll('.cancel-editor,.card-actions button,.tabs button')) button.disabled = locked;
    $('login-button').disabled = state.loginBusy;
    $('bureau-password').disabled = state.loginBusy;
    $('login-button').textContent = state.loginBusy ? 'Connexion…' : 'Se connecter';
    $('publish-button').textContent = state.busy && state.view === 'preview' ? 'Enregistrement…' : (state.draft?.id ? 'Enregistrer les modifications' : 'Publier');
  }

  function renderPhotos() {
    $('photo-list').replaceChildren();
    const photos = state.draft?.photos || [];
    $('photo-count').textContent = photos.length + ' / ' + MAX_PHOTOS;
    photos.forEach((photo, index) => {
      const item = createElement('li', 'photo-item');
      const picture = createElement('div', 'photo-image');
      picture.append(imageElement(photo.objectUrl || photo.url || photo.dataUrl, 'Photo ' + (index + 1), 'eager'));
      if (!index) picture.append(createElement('span', 'cover-badge', 'Couverture'));
      picture.append(createElement('span', 'photo-position', String(index + 1)));
      const tools = createElement('div', 'photo-tools');
      const before = photoButton('←', 'Déplacer la photo ' + (index + 1) + ' avant', () => movePhoto(index, index - 1), index === 0);
      const after = photoButton('→', 'Déplacer la photo ' + (index + 1) + ' après', () => movePhoto(index, index + 1), index === photos.length - 1);
      const remove = photoButton('Retirer', 'Retirer la photo ' + (index + 1), () => removePhoto(index));
      remove.classList.add('remove');
      tools.append(before, after, remove);
      if (index > 0) {
        const cover = photoButton('Mettre en couverture', 'Mettre la photo ' + (index + 1) + ' en couverture', () => movePhoto(index, 0));
        cover.classList.add('photo-cover-button');
        tools.append(cover);
      }
      item.append(picture, tools);
      $('photo-list').append(item);
    });
    updateControls();
  }

  function photoButton(text, label, action, disabled = false) {
    const button = createElement('button', 'photo-tool', text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.addEventListener('click', action);
    return button;
  }

  function movePhoto(from, to) {
    if (state.busy || state.processingPhotos || !state.draft || to < 0 || to >= state.draft.photos.length) return;
    const [photo] = state.draft.photos.splice(from, 1);
    state.draft.photos.splice(to, 0, photo);
    renderPhotos();
    updateDraftState();
    $('photo-status').textContent = to === 0 ? 'La photo choisie est maintenant la couverture.' : 'La photo est maintenant en position ' + (to + 1) + '.';
    $('photo-list').children[to]?.querySelector('button:not(:disabled)')?.focus();
  }

  function removePhoto(index) {
    if (state.busy || state.processingPhotos || !state.draft) return;
    const [photo] = state.draft.photos.splice(index, 1);
    if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
    renderPhotos();
    updateDraftState();
    $('photo-status').textContent = 'La photo a été retirée du brouillon.';
    const next = $('photo-list').children[Math.min(index, state.draft.photos.length - 1)];
    if (next) next.querySelector('button:not(:disabled)')?.focus();
    else $('choose-photos').focus();
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch (_) { /* Try the browser's image decoder for camera formats. */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (_) {
      URL.revokeObjectURL(url);
      throw new Error('image_decode');
    }
  }

  async function preparePhoto(file) {
    if (!file.size || (file.type && !file.type.startsWith('image/'))) throw new Error('image_decode');
    const decoded = await decodeImage(file);
    const canvas = document.createElement('canvas');
    try {
      if (!decoded.width || !decoded.height) throw new Error('image_decode');
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(decoded.width, decoded.height));
      let width = Math.max(1, Math.round(decoded.width * scale));
      let height = Math.max(1, Math.round(decoded.height * scale));
      let quality = 0.88;
      let blob;
      for (let attempt = 0; attempt < 10; attempt++) {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('image_decode');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(decoded.image, 0, 0, width, height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= MAX_IMAGE_BYTES && blob.type === 'image/jpeg') break;
        if (quality > 0.56) quality -= 0.12;
        else { width = Math.max(1, Math.round(width * 0.82)); height = Math.max(1, Math.round(height * 0.82)); }
      }
      if (!blob || blob.size > MAX_IMAGE_BYTES || blob.type !== 'image/jpeg') throw new Error('image_size');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { clientId: crypto.randomUUID(), dataUrl, objectUrl: URL.createObjectURL(blob), width, height, alt: '' };
    } finally {
      decoded.release();
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  async function addPhotos(files) {
    if (!state.draft || state.busy || state.processingPhotos || !files.length) return;
    inlineError('photo-error', '');
    const remaining = MAX_PHOTOS - state.draft.photos.length;
    if (files.length > remaining) {
      inlineError('photo-error', remaining ? 'Vous pouvez encore ajouter ' + remaining + ' photo' + (remaining > 1 ? 's' : '') + '. Choisissez moins de photos à la fois.' : 'Vous avez déjà 12 photos. Retirez une photo pour en ajouter une autre.');
      return;
    }
    state.processingPhotos = true;
    updateControls();
    let added = 0;
    let failed = 0;
    try {
      for (let index = 0; index < files.length; index++) {
        $('photo-status').textContent = 'Préparation de la photo ' + (index + 1) + ' sur ' + files.length + '…';
        try {
          const photo = await preparePhoto(files[index]);
          state.draft.photos.push(photo);
          added++;
          renderPhotos();
        } catch (_) { failed++; }
      }
      $('photo-status').textContent = added ? added + ' photo' + (added > 1 ? 's ajoutées' : ' ajoutée') + '. Vous pouvez changer leur ordre ci-dessous.' : '';
      if (failed) inlineError('photo-error', failed + ' photo' + (failed > 1 ? 's n’ont' : ' n’a') + ' pas pu être ouverte' + (failed > 1 ? 's' : '') + '. Choisissez une image JPEG ou PNG pour ' + (failed > 1 ? 'les remplacer.' : 'la remplacer.'));
    } finally {
      state.processingPhotos = false;
      updateDraftState();
      updateControls();
    }
  }

  function validateDraft() {
    syncDraft();
    const draft = state.draft;
    const checks = [
      ['publication-title', draft.title.trim().length >= 3 && draft.title.trim().length <= 180, 'Écrivez un titre de 3 à 180 caractères.'],
      ['publication-body', draft.body.trim().length >= 10 && draft.body.trim().length <= 20000, 'Écrivez un texte de 10 à 20 000 caractères.'],
      ['publication-date', !draft.eventDate || (validIsoDate(draft.eventDate) && draft.eventDate >= '1950-01-01' && draft.eventDate <= '2100-12-31'), 'Choisissez une date réelle entre 1950 et 2100, ou laissez ce champ vide.'],
      ['publication-location', draft.location.trim().length <= 160, 'Le lieu doit contenir au maximum 160 caractères.']
    ];
    let firstInvalid = null;
    for (const [id, valid, message] of checks) {
      $(id).setCustomValidity(valid ? '' : message);
      $(id).setAttribute('aria-invalid', String(!valid));
      if (!valid && !firstInvalid) firstInvalid = $(id);
    }
    if (firstInvalid) {
      firstInvalid.reportValidity();
      firstInvalid.focus();
      return false;
    }
    return $('publication-form').reportValidity();
  }

  function renderPreview() {
    const draft = state.draft;
    if (!draft) return;
    $('preview-title').textContent = draft.title.trim();
    $('preview-category').textContent = categories[draft.category];
    const date = draft.eventDate === draft.initialEventDate
      ? draft.legacyDateLabel || formatDate(draft.eventDate)
      : formatDate(draft.eventDate);
    $('preview-meta').textContent = [date, draft.location.trim()].filter(Boolean).join(' · ');
    $('preview-meta').hidden = !date && !draft.location.trim();
    $('preview-body').textContent = draft.body.trim();
    $('preview-cover').replaceChildren();
    $('preview-cover').hidden = !draft.photos.length;
    $('preview-gallery').replaceChildren();
    draft.photos.forEach((photo, index) => {
      const img = imageElement(photo.objectUrl || photo.url || photo.dataUrl, photo.alt || 'Photo ' + (index + 1), index ? 'lazy' : 'eager');
      if (!index) $('preview-cover').append(img);
      else $('preview-gallery').append(img);
    });
    updateControls();
  }

  async function savePublication() {
    if (!state.draft || state.busy || state.processingPhotos) return;
    state.busy = true;
    updateControls();
    inlineError('preview-error', '');
    const draft = state.draft;
    try {
      const pending = draft.photos.filter(photo => !photo.id);
      for (let index = 0; index < pending.length; index++) {
        $('save-status').textContent = 'Envoi de la photo ' + (index + 1) + ' sur ' + pending.length + '…';
        const photo = pending[index];
        const data = await request('/api/publication-photos', { image: photo.dataUrl });
        if (!data.photo?.id || !data.photo?.url) throw new RequestError(502, 'invalid_response');
        // Keep the stable clientId and local preview when a login or retry is needed.
        Object.assign(photo, { id: data.photo.id, url: data.photo.url, width: data.photo.width, height: data.photo.height, alt: data.photo.alt || '' });
      }
      $('save-status').textContent = 'Enregistrement de la publication…';
      const publication = {
        ...(draft.id ? { id: draft.id, revision: draft.revision } : {}),
        title: draft.title.trim(),
        body: draft.body.trim(),
        eventDate: draft.eventDate,
        location: draft.location.trim(),
        category: draft.category,
        photos: draft.photos.map(photo => ({ id: photo.id, url: photo.url, alt: photo.alt || '', width: photo.width, height: photo.height }))
      };
      const data = await request('/api/publications', { action: 'save', publication });
      if (!data.publication?.id) throw new RequestError(502, 'invalid_response');
      const wasEditing = Boolean(draft.id);
      upsertPublication(data.publication);
      revokeDraftPhotos();
      state.draft = null;
      state.tab = 'published';
      renderList();
      showView('list');
      notice(wasEditing ? 'Les modifications sont enregistrées et visibles sur le site.' : 'Votre publication est en ligne.');
      // The saved response already confirms success; a list refresh must not turn it into a save error.
      try { await loadPublications(); } catch (error) { if (error?.status === 401) requireLogin(); }
    } catch (error) {
      handleFailure(error, 'preview-error');
    } finally {
      state.busy = false;
      $('save-status').textContent = '';
      updateControls();
    }
  }

  async function closeEditor() {
    if (!(await canDiscardDraft())) return;
    const refresh = state.draft?.conflict;
    revokeDraftPhotos();
    state.draft = null;
    renderList();
    showView('list');
    notice('');
    if (refresh) {
      try { await loadPublications(); }
      catch (error) { handleFailure(error, 'list-error'); }
    }
  }

  async function login(event) {
    event.preventDefault();
    if (state.loginBusy || !$('login-form').reportValidity()) return;
    state.loginBusy = true;
    inlineError('login-error', '');
    updateControls();
    try {
      const result = await request('/api/bureau', { action: 'login', password: $('bureau-password').value });
      if (result.authenticated !== true) throw new RequestError(401, 'unauthorized');
      state.authenticated = true;
      $('bureau-password').value = '';
      $('login-context').hidden = true;
      await loadPublications();
      if (state.draft) {
        fillEditor();
        showView('editor');
        notice('Vous êtes reconnecté. Votre brouillon a été conservé. Relisez-le avant de l’enregistrer.');
      } else showView('list');
    } catch (error) {
      state.authenticated = false;
      inlineError('login-error', error?.status === 401 ? 'Ce mot de passe n’est pas reconnu. Vérifiez-le puis réessayez.' : friendlyError(error));
      $('bureau-password').value = '';
    } finally {
      state.loginBusy = false;
      updateControls();
      if (state.view === 'login') $('bureau-password').focus();
    }
  }

  async function logout() {
    if (state.busy || state.processingPhotos || !(await canDiscardDraft())) return;
    state.busy = true;
    updateControls();
    try {
      await request('/api/bureau', { action: 'logout' });
      revokeDraftPhotos();
      state.draft = null;
      state.publications = [];
      state.authenticated = false;
      $('publication-list').replaceChildren();
      $('publication-form').reset();
      $('photo-list').replaceChildren();
      $('preview-body').textContent = '';
      $('preview-gallery').replaceChildren();
      $('preview-cover').replaceChildren();
      $('login-context').hidden = true;
      inlineError('login-error', '');
      showView('login');
      notice('Vous êtes déconnecté.');
    } catch (error) { handleFailure(error); }
    finally { state.busy = false; updateControls(); }
  }

  $('login-form').addEventListener('submit', login);
  $('logout-button').addEventListener('click', logout);
  $('add-button').addEventListener('click', () => openEditor());
  $('publication-form').addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    event.target.removeAttribute('aria-invalid');
    syncDraft();
  });
  $('publication-form').addEventListener('change', syncDraft);
  $('publication-form').addEventListener('submit', event => {
    event.preventDefault();
    if (state.busy || state.processingPhotos || !validateDraft()) return;
    inlineError('preview-error', '');
    renderPreview();
    showView('preview');
  });
  $('back-to-edit').addEventListener('click', () => { if (!state.busy) showView('editor'); });
  $('publish-button').addEventListener('click', savePublication);
  document.querySelectorAll('.cancel-editor').forEach(button => button.addEventListener('click', closeEditor));
  $('choose-photos').addEventListener('click', () => $('photo-input').click());
  $('photo-input').addEventListener('change', event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addPhotos(files);
  });
  for (const tab of document.querySelectorAll('[data-tab]')) {
    tab.addEventListener('click', () => {
      if (state.busy) return;
      state.tab = tab.dataset.tab;
      inlineError('list-error', '');
      renderList();
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || state.busy) return;
      event.preventDefault();
      state.tab = event.key === 'Home' ? 'published' : event.key === 'End' ? 'archived' : state.tab === 'published' ? 'archived' : 'published';
      renderList();
      $(state.tab + '-tab').focus();
    });
  }
  $('confirm-accept').addEventListener('click', () => finishConfirmation(true));
  $('confirm-cancel').addEventListener('click', () => finishConfirmation(false));
  $('confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); finishConfirmation(false); });
  window.addEventListener('beforeunload', event => {
    if (!isDirty() && !state.busy && !state.processingPhotos) return;
    event.preventDefault();
    event.returnValue = '';
  });

  (async function start() {
    try {
      const session = await request('/api/bureau');
      if (session.authenticated !== true) throw new RequestError(401, 'unauthorized');
      state.authenticated = true;
      await loadPublications();
      showView('list', false);
    } catch (error) {
      state.authenticated = false;
      showView('login', false);
      if (error?.status !== 401) inlineError('login-error', friendlyError(error));
    }
  })();
})();
