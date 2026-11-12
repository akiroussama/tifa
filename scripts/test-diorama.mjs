import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderOasis } from '../lib/build-diorama.mjs';

test('oasis fills and palm instances resolve entirely within the HTML document', async () => {
  const source = await readFile(new URL('../assets/images/diorama-oasis.svg', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const svg = renderOasis(source);
  assert.ok(html.includes(svg), 'Run npm run build after changing the original illustration.');
  assert.doesNotMatch(html, /href="assets\/images\/diorama-oasis\.svg#/);
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Illustration IDs must be unique.');
  for (const [, ref] of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g)) {
    assert.ok(ids.includes(ref), `Unresolved local paint server or shape: ${ref}`);
  }
  assert.equal((svg.match(/class="palm-sway"/g) ?? []).length, 10);
  const geometry = s => [...s.matchAll(/\b(?:d|transform|fill|stroke|stop-color)="[^"]*"/g)].map(m => m[0]);
  assert.deepEqual(geometry(svg), geometry(source), 'Inlining must preserve all artwork geometry and colours.');
});
