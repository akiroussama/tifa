import { readFile, writeFile } from 'node:fs/promises';

const scenePattern = /<svg\b[^>]*class="scene-layer scene-oasis"[^>]*>[\s\S]*?<\/svg>/;

// Keep SVG paint servers in the page, avoiding WebKit's external-use URL resolution.
// The original illustration remains the only source of geometry and palm positions.
export function renderOasis(svg) {
  if (!svg.startsWith('<svg ') || !svg.includes('id="os-land"')) {
    throw new Error('Oasis source SVG is missing its root or land group.');
  }
  let palms = 0;
  const inline = svg.replace('<svg ', '<svg class="scene-layer scene-oasis" ')
    .replace(/<use href="#os-palm" transform="([^"]+)"\s*\/>/g, (_, transform) => {
      palms += 1;
      return `<g class="palm-tree" transform="${transform}"><g class="palm-sway"><use href="#os-palm"></use></g></g>`;
    });
  if (palms !== 10 || /\bhref="(?!#)/.test(inline)) {
    throw new Error('Oasis must contain ten palms and only local SVG references.');
  }
  return inline.trim();
}

export async function syncDiorama(root) {
  const source = await readFile(new URL('assets/images/diorama-oasis.svg', root), 'utf8');
  const pageUrl = new URL('index.html', root);
  const page = await readFile(pageUrl, 'utf8');
  if (!scenePattern.test(page)) throw new Error('Oasis slot not found in the home page.');
  const updated = page.replace(scenePattern, () => renderOasis(source));
  if (updated !== page) await writeFile(pageUrl, updated);
}
