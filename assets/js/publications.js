/* Apply bureau revisions to the existing archive without discarding its sources. */
(() => {
  'use strict';
  const categories = { culture: 'Culture & rencontres', cooperation: 'Formation & coopération',
    diplomatie: 'Dialogue & diplomatie', association: 'Vie associative' };
  const exactDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
  const validDate = value => exactDate(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const legacyPhoto = id => `/assets/images/facebook-${id}.jpg`;
  const allowedPhoto = (photo, baseIds, local) => {
    if (!photo || typeof photo.id !== 'string' || typeof photo.alt !== 'string') return false;
    if (baseIds.includes(photo.id) && photo.url === legacyPhoto(photo.id)) return true;
    const id = '[a-z0-9-]+\\.jpg$';
    if (local && new RegExp(`^/test-publications/images/${id}`).test(photo.url)) return true;
    return new RegExp(`^https://[a-z0-9]+\\.public\\.blob\\.vercel-storage\\.com/tifa-publications/images/${id}`).test(photo.url);
  };
  const validRecord = record => record && typeof record.id === 'string' &&
    /^[a-z0-9][a-z0-9_-]{0,100}$/.test(record.id) && Object.hasOwn(categories, record.category) &&
    ['title', 'summary', 'body', 'eventDate', 'dateLabel'].every(key => typeof record[key] === 'string') &&
    Array.isArray(record.photos) && record.photos.length <= 12;
  const showDate = (iso, language) => new Intl.DateTimeFormat(language === 'ar' ? 'ar-TN' : language, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${iso}T12:00:00Z`));

  function legacyMedia(base, localized) {
    return base.images.map((id, index) => ({ id, url: legacyPhoto(id), alt: localized.imageAlts[index],
      width: 590, height: base.id.includes('leadership') ? 443 : 393,
      portrait: index > 2 && base.id.includes('leadership') }));
  }

  function merge(sourceEvents, feed, { translate, language, t, local = false }) {
    const byId = new Map(sourceEvents.map(event => [event.id, event]));
    const revisions = new Map((feed?.publications || []).filter(validRecord).map(record => [record.id, record]));
    const hidden = new Set(feed?.hiddenIds || []);
    const ids = new Set([...byId.keys(), ...revisions.keys()]);
    const result = [];
    for (const id of ids) {
      if (hidden.has(id)) continue;
      const base = byId.get(id);
      const localized = base ? translate(base) : null;
      const revision = revisions.get(id);
      const baseMedia = base ? legacyMedia(base, localized) : [];
      if (!revision || revision.photos.some(photo => !allowedPhoto(photo, base?.images || [], local))) {
        if (localized) result.push({ ...localized, photos: baseMedia });
        continue;
      }

      const french = new Set();
      const event = { ...localized, id, category: revision.category,
        categoryLabel: base?.category === revision.category ? base.categoryLabel : categories[revision.category],
        place: revision.location, createdAt: revision.createdAt };
      for (const field of ['title', 'summary', 'body']) {
        if (base?.[field] !== revision[field]) {
          event[field] = revision[field];
          if (language !== 'fr') french.add(field);
        }
      }
      const oldExact = exactDate(base?.date) ? base.date : '';
      if (!base || revision.eventDate !== oldExact || revision.dateLabel !== base.dateLabel) {
        const valid = validDate(revision.eventDate);
        event.date = valid ? revision.eventDate : '';
        event.datePrecision = valid ? 'day' : undefined;
        event.dateLabel = valid ? showDate(event.date, language) : '';
        event.dateNote = base ? t('Date mise à jour par le bureau de TIFA.') : '';
      }
      event.photos = revision.photos.map((photo, index) => {
        const originalIndex = base?.images.indexOf(photo.id) ?? -1;
        const prior = baseMedia[originalIndex];
        if (prior && base.imageAlts[originalIndex] === photo.alt) return prior;
        return { ...photo, alt: photo.alt || t('Photo {count}', { count: index + 1 }),
          lang: photo.alt && language !== 'fr' ? 'fr' : '', portrait: Boolean(prior?.portrait) };
      });
      result.push({ ...event, french });
    }
    const rank = item => item.date || String(item.createdAt || '').slice(0, 10);
    return result.sort((a, b) => rank(b).localeCompare(rank(a)));
  }

  window.TIFA_PUBLICATIONS = Object.freeze({ merge });
})();
