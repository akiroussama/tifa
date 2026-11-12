import { put, get, head, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createPublicationService, publicationSeed } from './publications.js';

const seed = publicationSeed(readFileSync(new URL('../assets/js/content.js', import.meta.url), 'utf8'));
const store = {
  put,
  async head(pathname) {
    try { return await head(pathname); }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
  },
  async get(pathname) {
    // Public get() in SDK 2.8 does not implement useCache:false. Read the
    // authoritative ETag first, then a distinct version URL, and reject stale data.
    for (let attempt = 0; attempt < 3; attempt++) {
      let metadata;
      try { metadata = await head(pathname); }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
      const url = new URL(metadata.url);
      url.searchParams.set('version', metadata.etag);
      url.searchParams.set('fresh', randomUUID());
      const value = await get(url.href, { access: 'public' });
      if (value?.statusCode === 200 && value.blob.etag === metadata.etag) {
        return { value: await new Response(value.stream).text(), etag: value.blob.etag };
      }
    }
    throw new Error('PUBLICATION_STORAGE_NOT_FRESH');
  },
  isConflict(error) {
    return error instanceof BlobPreconditionFailedError || error?.name === 'BlobAlreadyExistsError' ||
      /already exists|precondition|etag.*match/i.test(error?.message || '');
  },
};
export const publications = createPublicationService(store, { seed });
export const publicationStorage = store;
