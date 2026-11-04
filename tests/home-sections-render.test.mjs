import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'astro';
import { JSDOM } from 'jsdom';
import { resolveHomeSectionOrder } from '../shared/homeSections.ts';

test('la homepage genera le sezioni nell’ordine editoriale conservando contenuti e visibilità', async (t) => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-home-render-')));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(path.join(project, 'src'), path.join(fixture, 'src'), {
    recursive: true,
    filter: (source) => source !== path.join(project, 'src/pages'),
  });
  fs.cpSync(path.join(project, 'shared'), path.join(fixture, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'src/pages'), { recursive: true });
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  const defaults = resolveHomeSectionOrder(undefined);
  const reversed = defaults.toReversed();
  const content = {
    homeSections: defaults,
    notices: [{ id: 'notice', title: 'Avviso visibile', text: 'Testo dell’avviso' }],
    initiatives: ['social', 'volunteering'].flatMap((area) => [1, 2, 3].map((index) => ({
      id: `${area}-${index}`, slug: `${area}-${index}`, name: `${area} ${index}`, area,
    }))),
    articles: [1, 2, 3, 4].map((index) => ({
      id: `article-${index}`, slug: `2026-11-04-articolo-${index}`, title: `Articolo ${index}`, publishedAt: '2026-11-04T10:00:00Z',
    })),
    featuredEvent: { id: 'event', slug: 'evento', title: 'Prossimo evento', date: '2026-12-08T16:00:00Z', status: 'scheduled' },
  };
  for (const [name, props] of Object.entries({
    default: content,
    reordered: { ...content, homeSections: reversed },
    empty: { homeSections: reversed, notices: [], initiatives: [], articles: [] },
  })) {
    fs.writeFileSync(path.join(fixture, 'src/pages', `${name}.astro`), `---
import HomeSections from '../components/HomeSections.astro';
const props = ${JSON.stringify(props)};
---
<html lang="it"><head><title>Homepage</title></head><body><main>
  <section class="hero"><h1>Presentazione</h1></section>
  <HomeSections {...props} />
</main></body></html>`);
  }
  await build({
    root: fixture,
    configFile: false,
    base: '/Assoe/',
    logLevel: 'silent',
    vite: { resolve: { alias: { '@': path.join(fixture, 'src') } } },
  });
  const document = (name) => new JSDOM(fs.readFileSync(path.join(fixture, 'dist', name, 'index.html'), 'utf8')).window.document;
  const sectionIds = (doc) => [...doc.querySelectorAll('main > section')]
    .map((section) => section.getAttribute('aria-labelledby') ?? section.className);
  const expected = ['avvisi-home', 'eventi-home', 'iniziative-social', 'iniziative-volunteering', 'articoli-home', 'cinque-per-mille-home'];
  assert.deepEqual(sectionIds(document('default')), ['hero', ...expected]);
  const reordered = document('reordered');
  assert.deepEqual(sectionIds(reordered), ['hero', ...expected.toReversed()]);
  assert.deepEqual([...reordered.querySelectorAll('[aria-labelledby="iniziative-social"] h3')].map((node) => node.textContent), ['social 1', 'social 2']);
  assert.deepEqual([...reordered.querySelectorAll('[aria-labelledby="articoli-home"] h3')].map((node) => node.textContent), ['Articolo 1', 'Articolo 2', 'Articolo 3']);
  assert.equal(reordered.querySelector('[aria-labelledby="eventi-home"] h3').textContent, 'Prossimo evento');
  assert.deepEqual(sectionIds(document('empty')), ['hero', 'cinque-per-mille-home', 'articoli-home', 'iniziative-volunteering', 'iniziative-social']);
});
