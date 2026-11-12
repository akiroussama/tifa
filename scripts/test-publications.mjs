import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { createPublicationService, publicationSeed } from '../lib/publications.js';

const ORIGIN = 'https://tifa.vercel.app';
const STATE = 'tifa-publications/private/state.enc';
const COOKIE = '__Host-tifa_bureau';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-08T10:05:00Z');
const PASSWORD = 'Local tests only - no production password';
const SECRET = 'local-test-session-key-0123456789-abcdefghijklmnopqrstuvwxyz';
const STORAGE_SECRET = 'local-test-storage-key-9876543210-abcdefghijklmnopqrstuvwxyz';
const salt = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const ENV = { PUBLICATIONS_SESSION_SECRET: SECRET, PUBLICATIONS_STORAGE_SECRET: STORAGE_SECRET,
  PUBLICATIONS_ADMIN_PASSWORD_HASH: `scrypt:${salt.toString('hex')}:${hash.toString('hex')}` };
const seed = publicationSeed(readFileSync(new URL('../assets/js/content.js', import.meta.url), 'utf8')).map(item => ({ ...item, revision: 0, archived: false }));
const jpeg = await sharp({ create: { width: 80, height: 50, channels: 3, background: '#263a31' } })
  .withExif({ IFD0: { Artist: 'Private local camera metadata' } }).jpeg().toBuffer();
const image = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

function conflict() { const error = new Error('CAS conflict'); error.code = 'CONFLICT'; return error; }
function createStore() {
  const files = new Map();
  let sequence = 0;
  const store = {
    files, calls: [], beforePut: null,
    async get(pathname) {
      const file = files.get(pathname);
      return file ? { value: file.value, etag: file.etag } : null;
    },
    async head(pathname) {
      const file = files.get(pathname);
      return file ? { url: file.url, pathname, contentType: file.contentType } : null;
    },
    async put(pathname, value, options = {}) {
      store.calls.push({ pathname, options: { ...options } });
      if (store.beforePut) await store.beforePut(pathname, value, options);
      const before = files.get(pathname);
      if (options.ifMatch && (!before || before.etag !== options.ifMatch)) throw conflict();
      if (options.allowOverwrite === false && before) throw conflict();
      const file = { pathname, contentType: options.contentType, value: Buffer.isBuffer(value) ? Buffer.from(value) : value,
        etag: `"test-${++sequence}"`, url: `https://test.public.blob.vercel-storage.com/${pathname}` };
      files.set(pathname, file);
      return { url: file.url, pathname, etag: file.etag };
    },
    isConflict: error => error?.code === 'CONFLICT',
  };
  return store;
}
function fixture({ store = createStore(), env = ENV, at = NOW } = {}) {
  let timestamp = at, sequence = 0;
  const options = { env: { ...env }, now: () => timestamp,
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`, seed };
  return { store, options, service: createPublicationService(store, options), setTime: value => { timestamp = value; } };
}
function request(route, { method = 'GET', data, cookie, headers = {}, rawBody } = {}) {
  const baseHeaders = method === 'GET' ? {} : { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-TIFA-Admin': '1', 'Sec-Fetch-Site': 'same-origin' };
  if (cookie) baseHeaders.Cookie = cookie;
  const init = { method, headers: { ...baseHeaders, ...headers } };
  if (rawBody !== undefined) init.body = rawBody;
  else if (data !== undefined) init.body = JSON.stringify(data);
  return new Request(ORIGIN + route, init);
}
async function login(fx, password = PASSWORD, headers = {}) {
  const response = await fx.service.bureau(request('/api/bureau', { method: 'POST', data: { action: 'login', password }, headers }));
  return { response, cookie: response.headers.get('Set-Cookie')?.split(';')[0] };
}
async function authenticate(fx) {
  const { response, cookie } = await login(fx);
  assert.equal(response.status, 200, await response.clone().text());
  assert.ok(cookie);
  return cookie;
}
async function command(fx, cookie, data, headers = {}) {
  return fx.service.publications(request('/api/publications', { method: 'POST', data, cookie, headers }));
}
const publication = (extra = {}) => ({ title: 'Une nouvelle rencontre', body: 'Premier paragraphe de test.\n\nDeuxième paragraphe conservé.',
  location: 'Ras Jbel', eventDate: '2026-11-08', category: 'association', photos: [], ...extra });
const save = (fx, cookie, data = publication(), headers = {}) => command(fx, cookie, { action: 'save', publication: data }, headers);
async function publicFeed(fx) { return (await fx.service.publications(request('/api/publications'))).json(); }
async function adminFeed(fx, cookie) { return (await fx.service.publications(request('/api/publications?admin=1', { cookie }))).json(); }

test('public reads disclose no credentials; administration and upload require a session', async () => {
  const fx = fixture();
  const response = await fx.service.publications(request('/api/publications'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { publications: [], hiddenIds: [] });
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal((await fx.service.bureau(request('/api/bureau'))).status, 401);
  assert.equal((await fx.service.publications(request('/api/publications?admin=1'))).status, 401);
  assert.equal((await save(fx, undefined)).status, 401);
  assert.equal((await fx.service.photos(request('/api/publication-photos', { method: 'POST', data: { image } }))).status, 401);
  assert.equal(fx.store.files.size, 0);
});

test('real scrypt login creates the secure host-only cookie and logout clears it', async () => {
  const fx = fixture();
  const { response, cookie } = await login(fx);
  assert.equal(response.status, 200);
  const set = response.headers.get('Set-Cookie');
  for (const flag of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Max-Age=2592000']) assert.ok(set.includes(flag), flag);
  assert.equal(/Domain=/i.test(set), false);
  assert.equal((await fx.service.bureau(request('/api/bureau', { cookie }))).status, 200);
  assert.equal((await adminFeed(fx, cookie)).publications.length, 16);
  const logout = await fx.service.bureau(request('/api/bureau', { method: 'POST', data: { action: 'logout' }, cookie }));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
});

test('five wrong passwords are rate-limited durably across service instances and buckets reset', async () => {
  const fx = fixture();
  for (let n = 0; n < 5; n++) assert.equal((await login(fx, 'wrong')).response.status, 401);
  const second = { ...fx, service: createPublicationService(fx.store, fx.options) };
  const limited = (await login(second)).response;
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0 && Number(limited.headers.get('Retry-After')) <= 900);
  assert.equal((await login(second, PASSWORD, { 'x-vercel-forwarded-for': '192.0.2.50' })).response.status, 200);
  fx.setTime(NOW + 900000);
  assert.equal((await login(fx)).response.status, 200);
  for (const file of fx.store.files.values()) assert.equal(String(file.value).includes(PASSWORD), false);
});

test('expired, future, malformed and tampered signed sessions fail closed', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const token = cookie.slice(cookie.indexOf('=') + 1), [body, mac] = token.split('.');
  const tampered = `${COOKIE}=${body}.${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}`;
  for (const bad of [tampered, `${cookie}.extra`, `${COOKIE}=bad`, `${COOKIE}=${'x'.repeat(1025)}`]) {
    assert.equal((await fx.service.bureau(request('/api/bureau', { cookie: bad }))).status, 401);
  }
  const sign = value => {
    const encoded = Buffer.from(JSON.stringify(value)).toString('base64url');
    const signature = createHmac('sha256', SECRET).update('session\0' + encoded).digest('base64url');
    return `${COOKIE}=${encoded}.${signature}`;
  };
  for (const invalid of [
    { v: 1, iat: NOW + 61000, exp: NOW + 61000 + SESSION_MS },
    { v: 1, iat: NOW, exp: NOW + SESSION_MS + 1 },
    { v: 2, iat: NOW, exp: NOW + SESSION_MS },
  ]) assert.equal((await fx.service.bureau(request('/api/bureau', { cookie: sign(invalid) }))).status, 401);
  fx.setTime(NOW + SESSION_MS);
  assert.equal((await fx.service.bureau(request('/api/bureau', { cookie }))).status, 401);
});

test('missing or malformed environment does not permit administration or expose secrets', async () => {
  for (const env of [{}, { ...ENV, PUBLICATIONS_SESSION_SECRET: 'short' }, { ...ENV, PUBLICATIONS_ADMIN_PASSWORD_HASH: 'scrypt:bad' }]) {
    const fx = fixture({ env });
    const response = (await login(fx)).response;
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'NOT_CONFIGURED');
    assert.equal(fx.store.files.size, 0);
  }
  const fx = fixture({ env: {} });
  assert.equal((await fx.service.publications(request('/api/publications'))).status, 503);
});

test('write operations require exact origin, same-origin fetch and the application header', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: 'https://tifa.vercel.app.attacker.example' },
    { 'Sec-Fetch-Site': 'same-site' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-TIFA-Admin': '0' }]) {
    assert.equal((await save(fx, cookie, publication(), headers)).status, 403);
    assert.equal((await command(fx, cookie, { action: 'archive', id: seed[0].id, revision: 0 }, headers)).status, 403);
    assert.equal((await fx.service.photos(request('/api/publication-photos', { method: 'POST', data: { image }, cookie, headers }))).status, 403);
    assert.equal((await login(fx, PASSWORD, headers)).response.status, 403);
  }
  const noOrigin = request('/api/publications', { method: 'POST', cookie, data: { action: 'save', publication: publication() } });
  noOrigin.headers.delete('Origin');
  assert.equal((await fx.service.publications(noOrigin)).status, 403);
  const noHeader = request('/api/bureau', { method: 'POST', data: { action: 'logout' } });
  noHeader.headers.delete('X-TIFA-Admin');
  assert.equal((await fx.service.bureau(noHeader)).status, 403);
  assert.equal(fx.store.files.has(STATE), false);
});

test('unsupported methods, invalid JSON and actual byte limits are rejected', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  for (const [handler, route, allow] of [[fx.service.bureau, '/api/bureau', 'GET, POST'], [fx.service.publications, '/api/publications', 'GET, POST'], [fx.service.photos, '/api/publication-photos', 'POST']]) {
    const response = await handler(request(route, { method: 'DELETE', cookie }));
    assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), allow);
  }
  for (const rawBody of ['{bad', 'null', '[]', '"text"']) assert.equal((await fx.service.publications(request('/api/publications', { method: 'POST', cookie, rawBody }))).status, 400);
  assert.equal((await command(fx, cookie, { action: 'save', publication: publication() }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fx.service.bureau(request('/api/bureau', { method: 'POST', rawBody: JSON.stringify({ action: 'login', password: 'x'.repeat(2200) }) }))).status, 413);
  assert.equal((await fx.service.publications(request('/api/publications', { method: 'POST', cookie, rawBody: JSON.stringify({ pad: 'x'.repeat(65537) }) }))).status, 413);
  assert.equal((await command(fx, cookie, { action: 'save', publication: publication() }, { 'Content-Length': '65537' })).status, 413);
  assert.equal((await fx.service.photos(request('/api/publication-photos', { method: 'POST', cookie, rawBody: JSON.stringify({ pad: 'x'.repeat(4250001) }) }))).status, 413);
});

test('legacy details and complete photo lists are available unchanged to the administrator', async () => {
  const fx = fixture(), cookie = await authenticate(fx), data = await adminFeed(fx, cookie);
  assert.equal(data.publications.length, 16);
  assert.deepEqual(data.publications, seed);
  assert.equal(data.publications.reduce((sum, p) => sum + p.photos.length, 0), 9);
  assert.equal(data.publications.find(p => p.id === 'leadership-houda-zlima-2026').eventDate, '2026-09-09');
  assert.equal(data.publications.find(p => p.id === 'accord-chambre-commerce-2025').eventDate, '');
});

test('create and update preserve paragraphs, Arabic, revision checks and public response contract', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const raw = publication({ title: 'لقاء الصداقة', body: 'الفقرة الأولى حول لقاء الجمعية.\n\nالفقرة الثانية حول تبادل التجارب.' });
  const response = await save(fx, cookie, raw);
  assert.equal(response.status, 200);
  const first = (await response.json()).publication;
  assert.match(first.id, /^publication-/); assert.equal(first.revision, 1); assert.equal(first.body, raw.body);
  assert.equal(first.archived, false); assert.equal(first.sourceUrl, ''); assert.equal(first.createdAt, new Date(NOW).toISOString());
  const updated = await save(fx, cookie, { ...first, title: 'Titre actualisé' });
  assert.equal(updated.status, 200); const second = (await updated.json()).publication;
  assert.equal(second.revision, 2); assert.equal(second.createdAt, first.createdAt);
  const stale = await save(fx, cookie, { ...first, title: 'Ancien onglet' });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'CONFLICT');
  const feed = await publicFeed(fx);
  assert.deepEqual(feed.hiddenIds, []); assert.deepEqual(feed.publications, [second]);
});

test('legacy overrides, archives and restoration operate by stable id without deleting images', async () => {
  const fx = fixture(), cookie = await authenticate(fx), original = seed.find(p => p.photos.length === 5);
  const saved = await save(fx, cookie, { ...original, title: 'Un titre corrigé', sourceUrl: 'https://attacker.example' });
  assert.equal(saved.status, 200); const override = (await saved.json()).publication;
  assert.equal(override.id, original.id); assert.deepEqual(override.photos, original.photos);
  assert.equal(override.sourceUrl, original.sourceUrl || '');
  const archived = await command(fx, cookie, { action: 'archive', id: original.id, revision: 1 });
  assert.equal(archived.status, 200);
  assert.deepEqual(await publicFeed(fx), { publications: [], hiddenIds: [original.id] });
  assert.equal((await adminFeed(fx, cookie)).publications.find(p => p.id === original.id).archived, true);
  assert.equal((await command(fx, cookie, { action: 'restore', id: original.id, revision: 1 })).status, 409);
  const restored = await command(fx, cookie, { action: 'restore', id: original.id, revision: 2 });
  assert.equal(restored.status, 200); assert.equal((await restored.json()).publication.revision, 3);
  assert.deepEqual((await publicFeed(fx)).hiddenIds, []);
  assert.equal((await publicFeed(fx)).publications[0].photos.length, 5);
  assert.equal([...fx.store.files.keys()].filter(key => key.startsWith('tifa-publications/images/')).length, 0);
});

test('new publications can be archived and restored without changing their stable id', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const record = (await (await save(fx, cookie)).json()).publication;
  assert.equal((await command(fx, cookie, { action: 'archive', id: record.id, revision: 1 })).status, 200);
  assert.deepEqual(await publicFeed(fx), { publications: [], hiddenIds: [record.id] });
  assert.equal((await command(fx, cookie, { action: 'restore', id: record.id, revision: 2 })).status, 200);
  const restored = await publicFeed(fx);
  assert.deepEqual(restored.hiddenIds, []);
  assert.equal(restored.publications[0].id, record.id);
  assert.equal(restored.publications[0].revision, 3);
});

test('all 16 existing records remain editable without inventing dates or changing ids', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  for (const original of seed) {
    const response = await save(fx, cookie, original);
    assert.equal(response.status, 200, original.id + ': ' + await response.clone().text());
    const saved = (await response.json()).publication;
    assert.equal(saved.id, original.id); assert.equal(saved.eventDate, original.eventDate);
    assert.equal(saved.dateLabel, original.dateLabel);
    assert.equal(saved.summary, original.summary);
    assert.deepEqual(saved.photos, original.photos);
  }
  assert.equal((await publicFeed(fx)).publications.length, 16);
});

test('title/body/location/category/calendar and photo count validation matches the editor bounds', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const bad = [ { title: 'ab' }, { title: 'x'.repeat(181) }, { body: '123456789' }, { body: 'x'.repeat(20001) },
    { location: 'x'.repeat(161) }, { title: 'Hello\u0000world' }, { category: 'unknown' },
    { eventDate: '2026-02-30' }, { eventDate: '1949-12-31' }, { eventDate: '2101-01-01' }, { eventDate: '08/11/2026' },
    { photos: Array.from({ length: 13 }, (_, n) => ({ id: 'p' + n, url: `https://test.public.blob.vercel-storage.com/tifa-publications/images/p${n}.jpg`, alt: '' })) },
    { photos: [{ url: 'https://attacker.example/photo.jpg' }] }, { photos: [{ url: 'javascript:alert(1)' }] },
  ];
  for (const fields of bad) assert.equal((await save(fx, cookie, publication(fields))).status, 400, JSON.stringify(fields).slice(0, 80));
  assert.equal(fx.store.files.has(STATE), false);
  const valid = await save(fx, cookie, publication({ title: 'x'.repeat(180), body: 'x'.repeat(20000), location: 'x'.repeat(160), eventDate: '' }));
  assert.equal(valid.status, 200);
  const twelve = await Promise.all(Array.from({ length: 12 }, async (_, n) => {
    const id = '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
    const { url } = await fx.store.put('tifa-publications/images/' + id + '.jpg', jpeg, { contentType: 'image/jpeg' });
    return { id, url, alt: '' };
  }));
  const minimum = await save(fx, cookie, publication({ title: 'abc', body: '1234567890', photos: twelve }));
  assert.equal(minimum.status, 200);
  assert.equal((await minimum.json()).publication.photos.length, 12);
});

test('unknown actions, absent records, invalid ids and duplicate images cannot write state', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  for (const data of [{ action: 'delete', id: seed[0].id }, { action: 'save' }, { action: 'archive', id: 'not-found', revision: 0 },
    { action: 'archive', id: '__proto__', revision: 0 }, { action: 'restore', id: '../other', revision: 0 },
    { action: 'archive', id: 'constructor' }]) {
    const response = await command(fx, cookie, data);
    assert.ok([400, 404].includes(response.status), await response.clone().text());
  }
  const id = '10000000-0000-4000-8000-000000000001';
  const { url } = await fx.store.put('tifa-publications/images/' + id + '.jpg', jpeg, { contentType: 'image/jpeg' });
  const photo = { id, url, alt: '' };
  assert.equal((await save(fx, cookie, publication({ photos: [photo, photo] }))).status, 400);
  assert.equal(fx.store.files.has(STATE), false);
});

test('stored state is authenticated ciphertext with fresh nonces, not plaintext content or credentials', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const response = await save(fx, cookie, publication({ title: 'Distinctive sensitive title 9472' }));
  const first = (await response.json()).publication, stored = fx.store.files.get(STATE).value;
  for (const sensitive of [first.title, first.body, PASSWORD, SECRET, STORAGE_SECRET, ENV.PUBLICATIONS_ADMIN_PASSWORD_HASH]) assert.equal(stored.includes(sensitive), false);
  const envelope = JSON.parse(stored);
  assert.equal(envelope.v, 1); assert.equal(Buffer.from(envelope.iv, 'base64').length, 12); assert.equal(Buffer.from(envelope.tag, 'base64').length, 16);
  await save(fx, cookie, first);
  assert.notEqual(JSON.parse(fx.store.files.get(STATE).value).iv, envelope.iv);
  const calls = fx.store.calls.filter(call => call.pathname === STATE);
  assert.equal(calls[0].options.allowOverwrite, false); assert.ok(calls[1].options.ifMatch);
});

test('altered ciphertext or a different storage key is rejected without overwriting the original', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  await save(fx, cookie);
  const file = fx.store.files.get(STATE), original = file.value, envelope = JSON.parse(original);
  const data = Buffer.from(envelope.data, 'base64'); data[0] ^= 1; envelope.data = data.toString('base64'); file.value = JSON.stringify(envelope);
  assert.equal((await fx.service.publications(request('/api/publications'))).status, 503);
  assert.equal((await save(fx, cookie)).status, 503);
  assert.equal(file.value, JSON.stringify(envelope));
  file.value = original;
  const other = fixture({ store: fx.store, env: { ...ENV, PUBLICATIONS_STORAGE_SECRET: STORAGE_SECRET + '-different' } });
  assert.equal((await other.service.publications(request('/api/publications'))).status, 503);
  assert.equal(fx.store.files.get(STATE).value, original);
});

test('session-key rotation revokes existing cookies while keeping the stored publications readable', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  assert.equal((await save(fx, cookie)).status, 200);
  const rotated = fixture({ store: fx.store, env: { ...ENV, PUBLICATIONS_SESSION_SECRET: SECRET + '-rotated' } });
  assert.equal((await rotated.service.bureau(request('/api/bureau', { cookie }))).status, 401);
  assert.equal((await publicFeed(rotated)).publications.length, 1);
  const newCookie = await authenticate(rotated);
  assert.equal((await adminFeed(rotated, newCookie)).publications.length, 17);
});

test('CAS retry preserves an unrelated simultaneous change, including initial state creation', async () => {
  for (const existing of [false, true]) {
    const fx = fixture(), cookie = await authenticate(fx);
    if (existing) assert.equal((await save(fx, cookie, seed[2])).status, 200);
    fx.store.beforePut = async pathname => {
      if (pathname !== STATE) return;
      fx.store.beforePut = null;
      const concurrent = await save(fx, cookie, { ...seed[1], title: 'Concurrent unrelated title' });
      assert.equal(concurrent.status, 200);
    };
    const response = await save(fx, cookie, { ...seed[0], title: 'Outer change retained' });
    assert.equal(response.status, 200);
    const records = (await adminFeed(fx, cookie)).publications;
    assert.equal(records.find(p => p.id === seed[0].id).title, 'Outer change retained');
    assert.equal(records.find(p => p.id === seed[1].id).title, 'Concurrent unrelated title');
  }
});

test('CAS retry returns conflict when another writer changed the same record', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  await save(fx, cookie, seed[2]);
  fx.store.beforePut = async pathname => {
    if (pathname !== STATE) return;
    fx.store.beforePut = null;
    assert.equal((await save(fx, cookie, { ...seed[0], title: 'Concurrent winning title' })).status, 200);
  };
  const response = await save(fx, cookie, { ...seed[0], title: 'Outdated overwritten title' });
  assert.equal(response.status, 409);
  assert.equal((await adminFeed(fx, cookie)).publications.find(p => p.id === seed[0].id).title, 'Concurrent winning title');
});

test('repeated CAS contention terminates after three attempts without overwriting', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  let attempts = 0;
  fx.store.beforePut = pathname => { if (pathname === STATE) { attempts++; throw conflict(); } };
  const response = await save(fx, cookie);
  assert.equal(response.status, 409); assert.equal(attempts, 3); assert.equal(fx.store.files.has(STATE), false);
});

test('a storage failure is reported as unconfirmed and never discloses internal error details', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  fx.store.beforePut = pathname => { if (pathname === STATE) throw new Error('Internal sensitive storage diagnostic'); };
  const response = await save(fx, cookie);
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.equal(text.includes('Internal sensitive'), false);
  assert.match(text, /SERVICE_UNAVAILABLE/);
  assert.equal(fx.store.files.has(STATE), false);
});

test('image upload verifies and re-encodes real bytes, strips EXIF and returns a usable photo', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const response = await fx.service.photos(request('/api/publication-photos', { method: 'POST', cookie, data: { image } }));
  assert.equal(response.status, 201); const photo = (await response.json()).photo;
  assert.equal(photo.width, 80); assert.equal(photo.height, 50);
  assert.match(photo.url, /^https:\/\/test\.public\.blob\.vercel-storage\.com\/tifa-publications\/images\/.*\.jpg$/);
  const file = fx.store.files.get('tifa-publications/images/' + photo.id + '.jpg');
  const metadata = await sharp(file.value).metadata();
  assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.exif, undefined);
  const saved = await save(fx, cookie, publication({ photos: [{ ...photo, alt: 'Légende française' }] }));
  assert.equal(saved.status, 200); assert.equal((await saved.json()).publication.photos[0].url, photo.url);
});

test('invalid, disguised and oversized images fail before any image object is stored', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  for (const invalid of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/jpeg;base64,PHNjcmlwdD4=', image.replace('image/jpeg', 'image/png')]) {
    const response = await fx.service.photos(request('/api/publication-photos', { method: 'POST', cookie, data: { image: invalid } }));
    assert.equal(response.status, 400);
  }
  const oversized = `data:image/jpeg;base64,${Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64')}`;
  assert.equal((await fx.service.photos(request('/api/publication-photos', { method: 'POST', cookie, data: { image: oversized } }))).status, 413);
  assert.equal([...fx.store.files.keys()].some(key => key.startsWith('tifa-publications/images/')), false);
});

test('unchanged dates retain their precision and date changes generate a fresh label', async () => {
  const fx = fixture(), cookie = await authenticate(fx);
  const partial = seed.find(record => record.id === 'accord-chambre-commerce-2025');
  const range = seed.find(record => record.id === 'leadership-houda-zlima-2026');
  const unchanged = (await (await save(fx, cookie, { ...range, title: 'Titre corrigé' })).json()).publication;
  assert.equal(unchanged.dateLabel, '9–15 septembre 2026');
  assert.equal(unchanged.summary, range.summary);
  const cleared = (await (await save(fx, cookie, { ...unchanged, eventDate: '' })).json()).publication;
  assert.equal(cleared.eventDate, '');
  assert.equal(cleared.dateLabel, '');
  const month = (await (await save(fx, cookie, partial)).json()).publication;
  assert.equal(month.eventDate, '');
  assert.equal(month.dateLabel, 'Novembre 2025');
  const changed = (await (await save(fx, cookie, { ...month, eventDate: '2025-11-14' })).json()).publication;
  assert.equal(changed.eventDate, '2025-11-14');
  assert.equal(changed.dateLabel, '14 novembre 2025');
});

test('a changed body generates a bounded summary without splitting a Unicode character', async () => {
  const fx = fixture(), cookie = await authenticate(fx), original = seed[0];
  const body = 'a'.repeat(178) + '🌸' + ' suite du texte.';
  const changed = (await (await save(fx, cookie, { ...original, body })).json()).publication;
  assert.equal(changed.summary, 'a'.repeat(178) + '🌸…');
  const short = (await (await save(fx, cookie, { ...changed, body: 'Un texte.\n\nDeux paragraphes.' })).json()).publication;
  assert.equal(short.summary, 'Un texte. Deux paragraphes.');
});

test('photos require a matching TIFA upload and keep their stable IDs when edited', async () => {
  const fx = fixture(), cookie = await authenticate(fx), original = seed[0];
  assert(original.photos.every(photo => photo.url === '/assets/images/facebook-' + photo.id + '.jpg'));
  const response = await fx.service.photos(request('/api/publication-photos', { method: 'POST', cookie, data: { image } }));
  assert.equal(response.status, 201);
  const { photo } = await response.json();
  for (const url of [
    photo.url.replace('test.public', 'other.public'),
    photo.url.replace('tifa-publications', 'publications'),
    photo.url.replace(photo.id, '10000000-0000-4000-8000-000000000111'),
  ]) {
    assert.equal((await save(fx, cookie, publication({ photos: [{ ...photo, url }] }))).status, 400);
  }
  const saved = (await (await save(fx, cookie, { ...original,
    photos: [{ ...original.photos[0], id: 'invalid-edit-id', alt: 'Légende éditée' }, { ...photo, id: 'invalid-upload-id' }],
  })).json()).publication;
  assert.deepEqual(saved.photos.map(item => item.id), [original.photos[0].id, photo.id]);
  assert.equal(saved.photos[0].alt, 'Légende éditée');
});
