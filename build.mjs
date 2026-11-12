import { cp, copyFile, mkdir } from 'node:fs/promises';
import { syncDiorama } from './lib/build-diorama.mjs';

const root = new URL('./', import.meta.url);
const output = new URL('public/', root);
await syncDiorama(root);
await mkdir(output, { recursive: true });
await cp(new URL('assets/', root), new URL('assets/', output), { recursive: true });
for (const page of ['index.html', 'constitution.html', 'mentions-legales.html', 'bureau-publications.html']) {
  await copyFile(new URL(page, root), new URL(page, output));
}
console.log('TIFA: 4 pages and public assets prepared. API, configuration and local QA stay outside public/.');
