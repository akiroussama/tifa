import { put, get, head, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { readFileSync } from 'node:fs';
import { createPublicationService, publicationSeed } from './publications.js';
import { readFreshBlob } from './blob-fresh-read.js';

const seed = publicationSeed(readFileSync(new URL('../assets/js/content.js', import.meta.url), 'utf8'));
const store = {
  put,
  async head(pathname) {
    try { return await head(pathname); }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
  },
  async get(pathname) {
    return readFreshBlob(pathname, { head, get });
  },
  isConflict(error) {
    return error instanceof BlobPreconditionFailedError || error?.name === 'BlobAlreadyExistsError' ||
      /already exists|precondition|etag.*match/i.test(error?.message || '');
  },
};
export const publications = createPublicationService(store, { seed });
export const publicationStorage = store;
