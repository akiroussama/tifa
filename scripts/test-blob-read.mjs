import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobNotFoundError } from '@vercel/blob';
import { readFreshBlob } from '../lib/blob-fresh-read.js';

const pathname = 'publications/private/state.enc';
const metadata = { url: 'https://example.public.blob.vercel-storage.com/state.enc', etag: '"abc"' };
const response = (etag, body = 'encrypted state') => ({ statusCode: 200, blob: { etag }, stream: new Response(body).body });

test('reads a compressed-equivalent weak ETag while preserving the strong write ETag', async () => {
  const result = await readFreshBlob(pathname, {
    head: async p => { assert.equal(p, pathname); return metadata; },
    get: async (url, options) => {
      assert.equal(new URL(url).searchParams.get('version'), metadata.etag);
      assert.equal(options.headers['accept-encoding'], 'identity');
      return response('W/"abc"');
    }, nonce: () => 'test',
  });
  assert.deepEqual(result, { value: 'encrypted state', etag: '"abc"' });
});

test('retries a different ETag and never accepts stale data', async () => {
  let calls = 0;
  await assert.rejects(readFreshBlob(pathname, { head: async () => metadata, get: async () => { calls++; return response('W/"stale"'); }, nonce: () => 'test' }), /PUBLICATION_STORAGE_NOT_FRESH/);
  assert.equal(calls, 3);
});

test('does not accept missing ETags and preserves a missing blob', async () => {
  await assert.rejects(readFreshBlob(pathname, { head: async () => ({ ...metadata, etag: '' }), get: async () => response(''), nonce: () => 'test' }), /PUBLICATION_STORAGE_NOT_FRESH/);
  const absent = await readFreshBlob(pathname, { head: async () => { throw new BlobNotFoundError(); }, get: async () => { throw new Error('unexpected read'); } });
  assert.equal(absent, null);
});
