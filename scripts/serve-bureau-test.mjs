/**
 * Local QA only: node scripts/serve-bureau-test.mjs
 * Open http://localhost:4176/bureau-publications with password tifa-qa-local-only.
 * Storage and signing keys live in memory; restarting resets the test data.
 * This server does not read deployment credentials or contact Vercel Blob.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createPublicationService, publicationSeed } from '../lib/publications.js';

const PORT = 4176;
const HOST = '127.0.0.1';
const PASSWORD = 'tifa-qa-local-only';
const ROOT = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const BLOB_ORIGIN = 'https://qa.public.blob.vercel-storage.com';
const IMAGE_STORE_PREFIX = 'tifa-publications/images/';
const IMAGE_ROUTE_PREFIX = '/test-publications/images/';
const PHOTO_FILE = /^[a-z0-9-]{1,100}\.jpg$/;
const MAX_PUBLICATION_JSON = 65_536;
const HOSTS = new Set([`localhost:${PORT}`, `${HOST}:${PORT}`]);
const PAGE_NAMES = ['index', 'constitution', 'mentions-legales', 'bureau-publications'];
const PAGES = new Map([['/', 'index.html'], ...PAGE_NAMES.flatMap(page => [
  [`/${page}`, `${page}.html`], [`/${page}.html`, `${page}.html`],
])]);
const MIME = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf',
}));

const conflict = () => Object.assign(new Error('Local storage compare-and-swap conflict'), { code: 'CONFLICT' });
const copy = value => Buffer.isBuffer(value) ? Buffer.from(value) : value;

function memoryStorage() {
  const files = new Map();
  let sequence = 0;
  return {
    async get(pathname) {
      const file = files.get(pathname);
      return file ? { value: copy(file.value), etag: file.etag } : null;
    },
    async head(pathname) {
      const file = files.get(pathname);
      if (!file) return null;
      const { value, ...metadata } = file;
      return metadata;
    },
    async put(pathname, value, options = {}) {
      const existing = files.get(pathname);
      // No await between comparing the etag and writing the replacement.
      if (options.ifMatch !== undefined && existing?.etag !== options.ifMatch) throw conflict();
      if (options.allowOverwrite === false && existing) throw conflict();
      const etag = `"qa-${++sequence}"`;
      const url = `${BLOB_ORIGIN}/${pathname}`;
      const contentType = options.contentType ?? 'application/octet-stream';
      const size = Buffer.byteLength(value);
      files.set(pathname, { value: copy(value), url, pathname, contentType, size, etag });
      return { url, pathname, etag };
    },
    isConflict: error => error?.code === 'CONFLICT',
  };
}

const salt = randomBytes(16);
const passwordHash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const env = {
  PUBLICATIONS_SESSION_SECRET: randomBytes(48).toString('base64url'),
  PUBLICATIONS_STORAGE_SECRET: randomBytes(48).toString('base64url'),
  PUBLICATIONS_ADMIN_PASSWORD_HASH: `scrypt:${salt.toString('hex')}:${passwordHash.toString('hex')}`,
};
const seed = publicationSeed(await readFile(resolve(ROOT, 'assets/js/content.js'), 'utf8'));
const store = memoryStorage();
const service = createPublicationService(store, { env, seed });
const handlers = new Map([
  ['/api/bureau', service.bureau],
  ['/api/publications', service.publications],
  ['/api/publication-photos', service.photos],
]);

async function mapPhoto(photo, rewriteUrl) {
  if (!photo || typeof photo.url !== 'string') return;
  photo.url = await rewriteUrl(photo.url);
}

async function mapPublication(publication, rewriteUrl) {
  if (Array.isArray(publication?.photos)) {
    await Promise.all(publication.photos.map(photo => mapPhoto(photo, rewriteUrl)));
  }
}

async function publicLocalUrl(url) {
  const prefix = `${BLOB_ORIGIN}/${IMAGE_STORE_PREFIX}`;
  if (!url.startsWith(prefix)) return url;
  const name = url.slice(prefix.length);
  if (!PHOTO_FILE.test(name) || !await store.head(`${IMAGE_STORE_PREFIX}${name}`)) return url;
  return `${IMAGE_ROUTE_PREFIX}${name}`;
}

function requestBlobUrl(origin) {
  return async url => {
    const local = url.startsWith(`${origin}${IMAGE_ROUTE_PREFIX}`) ? url.slice(origin.length) : url;
    if (!local.startsWith(IMAGE_ROUTE_PREFIX)) return url;
    const name = local.slice(IMAGE_ROUTE_PREFIX.length);
    if (!PHOTO_FILE.test(name)) return url;
    const file = await store.head(`${IMAGE_STORE_PREFIX}${name}`);
    return file?.url ?? url;
  };
}

async function bufferSmallBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > MAX_PUBLICATION_JSON) { req.resume(); return null; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

function send(res, status, body, headers = {}, head = false) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(head ? undefined : body);
}

function plain(res, status, text) {
  send(res, status, text, { 'Content-Type': 'text/plain; charset=utf-8' });
}

async function handleApi(req, res, url, handler) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  // A local request always uses the same rate-limit bucket. Do not trust proxy headers.
  headers.delete('x-vercel-forwarded-for');
  headers.delete('x-forwarded-for');
  const method = req.method;
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    const rewrite = url.pathname === '/api/publications' && method === 'POST'
      && headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json'
      && Number(headers.get('content-length') || 0) <= MAX_PUBLICATION_JSON;
    if (rewrite) {
      let body = await bufferSmallBody(req);
      if (!body) {
        send(res, 413, JSON.stringify({ error: 'L’envoi est trop volumineux.' }), { 'Content-Type': 'application/json' });
        return;
      }
      let input;
      try { input = JSON.parse(body.toString('utf8')); } catch { /* Let the service report malformed JSON. */ }
      if (input?.action === 'save') {
        await mapPublication(input.publication, requestBlobUrl(url.origin));
        body = Buffer.from(JSON.stringify(input));
      }
      headers.set('content-length', String(body.length));
      init.body = body;
    } else {
      init.body = Readable.toWeb(req);
      init.duplex = 'half';
    }
  }

  const response = await handler(new Request(url, init));
  const outputHeaders = Object.fromEntries(response.headers.entries());
  const cookies = response.headers.getSetCookie();
  if (cookies.length) outputHeaders['set-cookie'] = cookies;
  delete outputHeaders['content-length'];
  let body;
  if (response.ok && url.pathname !== '/api/bureau' && response.headers.get('content-type')?.includes('application/json')) {
    const value = await response.json();
    await mapPhoto(value.photo, publicLocalUrl);
    await mapPublication(value.publication, publicLocalUrl);
    if (Array.isArray(value.publications)) await Promise.all(value.publications.map(item => mapPublication(item, publicLocalUrl)));
    body = JSON.stringify(value);
  } else {
    body = Buffer.from(await response.arrayBuffer());
  }
  send(res, response.status, body, outputHeaders, method === 'HEAD');
}

function insideRoot(pathname) {
  const fromRoot = relative(ROOT, pathname);
  return fromRoot && !isAbsolute(fromRoot) && !/^\.\.(?:[/\\]|$)/.test(fromRoot);
}

async function route(req, res) {
  if (!HOSTS.has(req.headers.host?.toLowerCase())) return plain(res, 421, 'Hôte local invalide.');
  if (!req.url?.startsWith('/') || req.url.startsWith('//')) return plain(res, 400, 'URL invalide.');
  const origin = `http://${req.headers.host}`;
  const url = new URL(req.url, origin);
  if (url.origin !== origin.toLowerCase()) return plain(res, 400, 'URL invalide.');
  const handler = handlers.get(url.pathname);
  if (handler) return handleApi(req, res, url, handler);
  if (!['GET', 'HEAD'].includes(req.method)) {
    return send(res, 405, 'Méthode non autorisée.', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return plain(res, 400, 'URL invalide.'); }
  if (pathname.startsWith(IMAGE_ROUTE_PREFIX)) {
    const name = pathname.slice(IMAGE_ROUTE_PREFIX.length);
    const file = PHOTO_FILE.test(name) && await store.get(`${IMAGE_STORE_PREFIX}${name}`);
    if (!file || !Buffer.isBuffer(file.value)) return plain(res, 404, 'Image absente.');
    return send(res, 200, file.value, { 'Content-Type': 'image/jpeg', 'Content-Length': file.value.length }, req.method === 'HEAD');
  }

  const page = PAGES.get(pathname);
  const asset = /^\/assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_][a-z0-9_.-]*$/i.test(pathname) ? pathname.slice(1) : '';
  if (!page && !asset) return plain(res, 404, 'Page absente.');
  const mime = MIME.get(extname(page || asset).toLowerCase());
  if (!mime) return plain(res, 404, 'Page absente.');
  try {
    const file = await realpath(resolve(ROOT, page || asset));
    if (!insideRoot(file)) return plain(res, 404, 'Page absente.');
    // Prevent symbolic links in assets from serving unrelated workspace files.
    if (asset && !relative(ROOT, file).split(/[\\/]/)[0].match(/^assets$/i)) return plain(res, 404, 'Page absente.');
    const body = await readFile(file);
    return send(res, 200, body, { 'Content-Type': mime, 'Content-Length': body.length }, req.method === 'HEAD');
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return plain(res, 404, 'Page absente.');
    throw error;
  }
}

const server = createServer((req, res) => {
  route(req, res).catch(error => {
    console.error('TIFA QA:', error?.code || error?.name || 'Error');
    if (!res.headersSent) plain(res, 500, 'Erreur du serveur de test local.');
    else res.destroy();
  });
});
server.listen(PORT, HOST, () => {
  console.log(`Bureau TIFA (local, données volatiles) : http://localhost:${PORT}/bureau-publications`);
  console.log(`Mot de passe de test : ${PASSWORD}`);
  console.log(`${seed.length} publications chargées. Ctrl+C pour arrêter.`);
});
