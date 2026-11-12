import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prepareImage, PhotoError } from './photos.js';

const scrypt = promisify(scryptCallback);
const NAMESPACE = 'tifa-publications';
const STATE = NAMESPACE + '/private/state.enc';
const UPLOAD = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(tifa-publications\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg)$/;
const EXACT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COOKIE = '__Host-tifa_bureau';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const CATEGORIES = new Set(['culture', 'cooperation', 'diplomatie', 'association']);
const ID = /^[a-z0-9][a-z0-9_-]{0,100}$/;

export class PublicationError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new PublicationError(status, message, code); };
const reply = (value, status = 200, extra = {}) => Response.json(value, { status, headers: {
  'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin', Vary: 'Cookie', ...extra,
} });
const signature = (key, value) => createHmac('sha256', key).update(value).digest('base64url');
function equal(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }

function seal(state, secret) {
  const key = createHash('sha256').update('TIFA publication storage\0' + secret).digest();
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') });
}
function unseal(value, secret) {
  const raw = JSON.parse(value);
  if (raw.v !== 1) throw new Error('INVALID_STATE');
  const key = createHash('sha256').update('TIFA publication storage\0' + secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(raw.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(raw.tag, 'base64'));
  const state = JSON.parse(Buffer.concat([decipher.update(Buffer.from(raw.data, 'base64')), decipher.final()]).toString('utf8'));
  if (!state || !Number.isInteger(state.revision) || !state.records || typeof state.records !== 'object' || Array.isArray(state.records)) throw new Error('INVALID_STATE');
  return state;
}
function checkOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      (request.headers.get('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin') ||
      request.headers.get('x-tifa-admin') !== '1') fail(403, 'Rechargez la page du bureau avant de réessayer.', 'ORIGIN_DENIED');
}
async function jsonBody(request, max = 65536) {
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'Envoi invalide.');
  if (Number(request.headers.get('content-length') || 0) > max) fail(413, 'L’envoi est trop volumineux.');
  if (!request.body) fail(400, 'Le formulaire est vide.');
  const reader = request.body.getReader(), parts = []; let bytes = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength;
    if (bytes > max) { await reader.cancel(); fail(413, 'L’envoi est trop volumineux.'); } parts.push(value); }
  let data;
  try { data = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail(400, 'Le formulaire n’a pas pu être lu.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Formulaire invalide.');
  return data;
}
function clean(value, label, max, min = 0) {
  if (typeof value !== 'string') fail(400, label + ' invalide.');
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (text.length < min || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) fail(400, label + ' : de ' + min + ' à ' + max + ' caractères.');
  return text;
}
function dateLabel(value) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
}

// content.js is a JSON payload assigned to a global. Parse it as data, without executing JS.
export function publicationSeed(source) {
  const start = /window\.TIFA_CONTENT\s*=\s*/.exec(source);
  if (!start) throw new Error('INVALID_PUBLICATION_SEED');
  const { events } = JSON.parse(source.slice(start.index + start[0].length).trim().replace(/;$/, ''));
  return events.map(event => ({
    id: event.id, title: event.title, body: event.body, summary: event.summary,
    category: event.category, eventDate: EXACT_DATE.test(event.date) ? event.date : '',
    dateLabel: event.dateLabel, location: event.place || '',
    photos: event.images.map((id, i) => ({ id, url: '/assets/images/facebook-' + id + '.jpg', alt: event.imageAlts[i] })),
  }));
}

function summaryFrom(body) {
  const text = body.replace(/\s+/g, ' ');
  const characters = [...text];
  return characters.length > 180 ? characters.slice(0, 179).join('').trimEnd() + '…' : text;
}

export function createPublicationService(storage, { env = process.env, now = Date.now, uuid = randomUUID, seed = [] } = {}) {
  const originals = new Map(seed.map(item => [item.id, { ...item, revision: 0, archived: false }]));
  function secret() {
    const value = env.PUBLICATIONS_SESSION_SECRET;
    if (typeof value !== 'string' || value.length < 32) fail(503, 'L’espace du bureau est momentanément indisponible.', 'NOT_CONFIGURED');
    return value;
  }
  function storageSecret() {
    const value = env.PUBLICATIONS_STORAGE_SECRET;
    if (typeof value !== 'string' || value.length < 32) fail(503, 'Le stockage du bureau est momentanément indisponible.', 'NOT_CONFIGURED');
    return value;
  }
  function credentialVersion() {
    if (typeof env.PUBLICATIONS_ADMIN_PASSWORD_HASH !== 'string' || !/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(env.PUBLICATIONS_ADMIN_PASSWORD_HASH)) fail(503, 'La connexion du bureau n’est pas configurée.', 'NOT_CONFIGURED');
    return signature(secret(), 'credential version\0' + env.PUBLICATIONS_ADMIN_PASSWORD_HASH);
  }
  function requireAdmin(request) {
    const key = secret();
    const token = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!token || token.length > 1024) fail(401, 'Connectez-vous pour continuer.', 'AUTHENTICATION_REQUIRED');
    const [body, mac, extra] = token.split('.');
    if (!body || !mac || extra || !equal(signature(key, 'session\0' + body), mac)) fail(401, 'Connectez-vous pour continuer.', 'AUTHENTICATION_REQUIRED');
    let value; try { value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { fail(401, 'Connectez-vous pour continuer.', 'AUTHENTICATION_REQUIRED'); }
    if (value.v !== 1 || value.cred !== credentialVersion() || !Number.isSafeInteger(value.exp) || !Number.isSafeInteger(value.iat) || value.exp <= now() || value.iat > now() + 60000 || value.exp - value.iat !== SESSION_MS) fail(401, 'Votre connexion a expiré. Reconnectez-vous.', 'AUTHENTICATION_REQUIRED');
  }
  async function loadState() {
    const key = storageSecret(), stored = await storage.get(STATE);
    if (!stored) return { state: { revision: 0, records: {} }, etag: null };
    return { state: unseal(stored.value, key), etag: stored.etag };
  }
  function merged(state) { return new Map([...originals, ...Object.entries(state.records)]); }
  async function validatePublication(raw, previous) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(400, 'Publication invalide.');
    const title = clean(raw.title, 'Le titre', 180, 3), body = clean(raw.body, 'Le texte', 20000, 10);
    const location = clean(raw.location ?? '', 'Le lieu', 160), eventDate = clean(raw.eventDate ?? '', 'La date', 10);
    if (eventDate && (!EXACT_DATE.test(eventDate) || !Number.isFinite(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0, 10) !== eventDate || eventDate < '1950-01-01' || eventDate > '2100-12-31')) fail(400, 'Choisissez une date valide.');
    if (!CATEGORIES.has(raw.category)) fail(400, 'Choisissez un thème.');
    if (!Array.isArray(raw.photos) || raw.photos.length > 12) fail(400, 'Choisissez au maximum 12 photos.');
    const previousPhotos = new Map((previous?.photos || []).map(photo => [photo.url, photo]));
    const seen = new Set();
    const photos = await Promise.all(raw.photos.map(async photo => {
      if (!photo || typeof photo !== 'object' || typeof photo.url !== 'string') fail(400, 'Une photo est invalide.');
      if (seen.has(photo.url)) fail(400, 'Une photo apparaît deux fois.');
      seen.add(photo.url);
      const existing = previousPhotos.get(photo.url);
      let id = existing?.id;
      if (!existing) {
        const upload = UPLOAD.exec(photo.url);
        if (!upload) fail(400, 'Cette photo ne provient pas de TIFA.');
        const [, pathname, uploadedId] = upload;
        const stored = await storage.head(pathname);
        if (!stored || stored.url !== photo.url || stored.pathname !== pathname || stored.contentType !== 'image/jpeg') {
          fail(400, 'Cette photo ne provient pas de TIFA.');
        }
        id = uploadedId;
      }
      const width = photo.width ?? existing?.width;
      const height = photo.height ?? existing?.height;
      return { id, url: photo.url, alt: clean(photo.alt ?? existing?.alt ?? '', 'La légende', 500),
        ...(Number.isInteger(width) && width > 0 && width <= 10000 ? { width } : {}),
        ...(Number.isInteger(height) && height > 0 && height <= 10000 ? { height } : {}) };
    }));
    return { title, body, summary: body === previous?.body ? previous.summary : summaryFrom(body), location, eventDate,
      dateLabel: eventDate === previous?.eventDate ? previous.dateLabel : eventDate ? dateLabel(eventDate) : '',
      category: raw.category, photos, sourceUrl: previous?.sourceUrl || '' };
  }
  async function change(command) {
    const action = command.action;
    if (!['save', 'archive', 'restore'].includes(action)) fail(400, 'Action inconnue.');
    const raw = action === 'save' ? command.publication : command;
    if (!raw || typeof raw !== 'object') fail(400, 'Publication manquante.');
    const isNew = action === 'save' && !raw.id;
    const id = isNew ? 'publication-' + uuid() : raw.id;
    if (typeof id !== 'string' || !ID.test(id)) fail(400, 'Publication invalide.');
    for (let attempt = 0; attempt < 3; attempt++) {
      const { state, etag } = await loadState(), before = Object.hasOwn(state.records, id) ? state.records[id] : originals.get(id);
      if (!isNew && !before) fail(404, 'Cette publication n’existe plus.');
      if (!isNew && (!Number.isSafeInteger(raw.revision) || raw.revision < 0)) fail(400, 'La version de cette publication est invalide.');
      if ((isNew && before) || (!isNew && raw.revision !== before.revision)) fail(409, 'Cette publication a changé. Actualisez la liste avant de la modifier.', 'CONFLICT');
      if (isNew && Object.keys(state.records).length >= 5000) fail(400, 'La limite de publications est atteinte.');
      const updatedAt = new Date(now()).toISOString();
      const record = action === 'save' ? { ...await validatePublication(raw, before), id, archived: before?.archived || false,
        createdAt: before?.createdAt || updatedAt, updatedAt, revision: (before?.revision || 0) + 1 }
        : { ...before, archived: action === 'archive', updatedAt, revision: before.revision + 1 };
      const next = { revision: state.revision + 1, records: { ...state.records, [id]: record } };
      try {
        await storage.put(STATE, seal(next, storageSecret()), { access: 'public', contentType: 'application/octet-stream', addRandomSuffix: false,
          ...(etag ? { ifMatch: etag } : { allowOverwrite: false }), cacheControlMaxAge: 60 });
        return record;
      } catch (error) {
        if (storage.isConflict(error)) continue;
        throw error;
      }
    }
    fail(409, 'Une autre modification est en cours. Actualisez puis réessayez.', 'CONFLICT');
  }
  async function reserveLogin(request) {
    const time = now(), bucket = Math.floor(time / 900000), retry = Math.ceil(((bucket + 1) * 900000 - time) / 1000);
    const ip = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const hash = signature(secret(), 'login rate\0' + bucket + '\0' + ip).slice(0, 32);
    for (let n = 0; n < 5; n++) {
      try { await storage.put(NAMESPACE + '/login-rate/' + bucket + '/' + hash + '/' + n, '1', {
        access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: 'text/plain', cacheControlMaxAge: 60 }); return; }
      catch (error) { if (!storage.isConflict(error)) throw error; }
    }
    const error = new PublicationError(429, 'Trop d’essais. Réessayez dans quelques minutes.', 'TOO_MANY_ATTEMPTS'); error.retry = retry; throw error;
  }
  async function bureau(request) {
    if (request.method === 'GET') { requireAdmin(request); return reply({ authenticated: true }); }
    if (request.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405, { Allow: 'GET, POST' });
    checkOrigin(request); const data = await jsonBody(request, 2048);
    if (data.action === 'logout') return reply({ authenticated: false }, 200, { 'Set-Cookie': COOKIE + '=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0' });
    if (data.action !== 'login') fail(400, 'Action inconnue.');
    const key = secret(), encoded = env.PUBLICATIONS_ADMIN_PASSWORD_HASH;
    if (typeof encoded !== 'string' || !/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(encoded)) fail(503, 'La connexion du bureau n’est pas configurée.', 'NOT_CONFIGURED');
    if (typeof data.password !== 'string' || data.password.length > 256 || data.password.length < 1) fail(400, 'Indiquez votre mot de passe.');
    await reserveLogin(request);
    const [, salt, expected] = encoded.split(':');
    const actual = await scrypt(data.password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    if (!equal(actual, Buffer.from(expected, 'hex'))) fail(401, 'Le mot de passe n’est pas correct. Réessayez.', 'INVALID_PASSWORD');
    const issued = now(), body = Buffer.from(JSON.stringify({ v: 1, cred: credentialVersion(), iat: issued, exp: issued + SESSION_MS, nonce: uuid() })).toString('base64url');
    return reply({ authenticated: true }, 200, { 'Set-Cookie': COOKIE + '=' + body + '.' + signature(key, 'session\0' + body) + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + SESSION_MS / 1000 });
  }
  async function publications(request) {
    if (request.method === 'GET') {
      const adminView = new URL(request.url).searchParams.get('admin') === '1';
      if (adminView) requireAdmin(request);
      const { state } = await loadState();
      if (adminView) return reply({ publications: [...merged(state).values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) });
      const records = Object.values(state.records);
      return reply({ publications: records.filter(p => !p.archived), hiddenIds: records.filter(p => p.archived).map(p => p.id) });
    }
    if (request.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405, { Allow: 'GET, POST' });
    requireAdmin(request); checkOrigin(request);
    return reply({ publication: await change(await jsonBody(request)) });
  }
  async function photos(request) {
    requireAdmin(request);
    if (request.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405, { Allow: 'POST' });
    checkOrigin(request); const data = await jsonBody(request, 4_250_000);
    const image = await prepareImage(data.image), id = uuid();
    const uploaded = await storage.put(NAMESPACE + '/images/' + id + '.jpg', image.buffer, {
      access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 31_536_000,
    });
    return reply({ photo: { id, url: uploaded.url, width: image.width, height: image.height, alt: '' } }, 201);
  }
  function safe(handler) { return async request => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof PublicationError) return reply({ error: error.message, code: error.code }, error.status, error.retry ? { 'Retry-After': String(error.retry) } : {});
      if (error instanceof PhotoError) return reply({ error: error.message, code: error.code }, error.status);
      console.error('TIFA publications: operation failed', error?.name || 'Error');
      return reply({ error: 'L’opération n’a pas pu être confirmée. Votre texte reste dans le formulaire. Réessayez.', code: 'SERVICE_UNAVAILABLE' }, 503);
    }
  }; }
  return { bureau: safe(bureau), publications: safe(publications), photos: safe(photos) };
}
