import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { publicationSeed } from '../lib/publications.js';

const window = {};
for (const file of ['content.js', 'i18n/en.js', 'publications.js']) {
  vm.runInNewContext(readFileSync(new URL(`../assets/js/${file}`, import.meta.url), 'utf8'), { window });
}
const source = window.TIFA_CONTENT.events;
const seed = publicationSeed(readFileSync(new URL('../assets/js/content.js', import.meta.url), 'utf8'));
const en = window.TIFA_MESSAGES.en;
const options = { language: 'en', translate: event => ({ ...event, ...en.events[event.id] }),
  t: (key, args = {}) => (en.text[key] || key).replace(/\{(\w+)\}/g, (_, name) => args[name]) };
const { merge } = window.TIFA_PUBLICATIONS;

test('missing service retains all translations, sources and original media', () => {
  const events = merge(source, null, options);
  assert.equal(events.length, 16);
  assert.equal(events.reduce((sum, event) => sum + event.photos.length, 0), 9);
  assert.equal(events[0].title, en.events[events[0].id].title);
  assert.equal(events[0].source, source[0].source);
});

test('editing a French field retains the other translations and source evidence', () => {
  const id = 'assemblee-generale-2026';
  const baseline = source.find(event => event.id === id);
  const revision = { ...seed.find(record => record.id === id), title: 'Nouveau titre de la fiche' };
  const updated = merge(source, { publications: [revision], hiddenIds: [] }, options).find(e => e.id === id);
  assert.equal(updated.title, revision.title);
  assert.equal(updated.body, en.events[id].body);
  assert.equal(updated.dateLabel, en.events[id].dateLabel);
  assert.deepEqual(Array.from(updated.french), ['title']);
  assert.equal(updated.source, baseline.source);
  assert.equal(updated.original, baseline.original);
  assert.equal(updated.additionalSources, baseline.additionalSources);
});

test('translated photo captions follow the ID after rearranging the photos', () => {
  const id = 'leadership-houda-zlima-2026';
  const before = seed.find(record => record.id === id);
  const revision = { ...before, photos: [...before.photos].reverse() };
  const updated = merge(source, { publications: [revision], hiddenIds: [] }, options).find(e => e.id === id);
  assert.equal(updated.photos[0].id, before.photos.at(-1).id);
  assert.equal(updated.photos[0].alt, en.events[id].imageAlts.at(-1));
  assert.equal(updated.dateLabel, en.events[id].dateLabel);
});

test('hiding a source event removes its photos from the live gallery', () => {
  const id = 'ayurveda-tourisme-2026';
  const events = merge(source, { publications: [], hiddenIds: [id] }, options);
  assert.equal(events.length, 15);
  assert.equal(events.some(event => event.id === id), false);
  assert.equal(events.reduce((sum, event) => sum + event.photos.length, 0), 5);
});

test('new records can be undated and accept only approved media URLs', () => {
  const record = { id: 'publication-qa', title: 'Nouvelle activité', summary: 'Résumé', body: 'Texte',
    category: 'culture', createdAt: '2026-11-13T10:00:00.000Z', eventDate: '', dateLabel: '', photos: [] };
  const feed = { publications: [record], hiddenIds: [] };
  const created = merge(source, feed, options)[0];
  assert.equal(created.id, record.id);
  assert.equal(created.dateLabel, '');
  assert.equal(created.source, undefined);
  assert.equal(created.french.has('body'), true);
  record.photos = [{ id: 'foo', alt: 'Photo', url: 'https://unrelated.example/photo.jpg' }];
  assert.equal(merge(source, feed, options).length, 16);
});
