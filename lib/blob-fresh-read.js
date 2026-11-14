import { randomUUID } from 'node:crypto';
import { BlobNotFoundError } from '@vercel/blob';

// The CDN may weaken an ETag when compressing a response. Compare the entity
// tags while retaining the authoritative head ETag for conditional writes.
const entityTag = value => typeof value === 'string' ? value.replace(/^W\//, '') : '';

export async function readFreshBlob(pathname, { head, get, nonce = randomUUID }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let metadata;
    try { metadata = await head(pathname); }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
    const url = new URL(metadata.url);
    url.searchParams.set('version', metadata.etag);
    url.searchParams.set('fresh', nonce());
    const value = await get(url.href, { access: 'public', headers: { 'accept-encoding': 'identity' } });
    const expected = entityTag(metadata.etag), received = entityTag(value?.blob?.etag);
    if (value?.statusCode === 200 && expected && received === expected) {
      return { value: await new Response(value.stream).text(), etag: metadata.etag };
    }
  }
  throw new Error('PUBLICATION_STORAGE_NOT_FRESH');
}
