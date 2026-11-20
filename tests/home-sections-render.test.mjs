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
    articles: [1, 2, 3, 4, 5, 6, 7].map((index) => ({
      id: `article-${index}`, slug: `2026-11-0${index}-articolo-${index}`, title: `Articolo ${index}`, publishedAt: `2026-11-0${index}T10:00:00Z`, featured: index <= 6,
    })),
    featuredEvent: { id: 'event', slug: 'evento', title: 'Prossimo evento', date: '2026-12-08T16:00:00Z', status: 'scheduled' },
  };
  for (const [name, props] of Object.entries({
    default: content,
    reordered: { ...content, homeSections: reversed },
    historical: { ...content, articles: [{ ...content.articles[0], slug: 'ricordo', historicalUndated: true }] },
    empty: { homeSections: reversed, notices: [], initiatives: [], articles: [] },
    noFeatured: { ...content, articles: content.articles.map(({ featured, ...article }) => article) },
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
  fs.writeFileSync(path.join(fixture, 'src/pages/archive.astro'), `---
import ArticleList from '../components/ArticleList.astro';
---
<ArticleList articles={${JSON.stringify(content.articles)}} />`);
  for (const [name, association] of Object.entries({
    membership: { name: 'Associazione', contacts: { email: 'info@assoe.it' }, socialLinks: [], documents: { membershipFormUrl: 'https://cdn.sanity.io/files/project/production/form.pdf' } },
    contact: { name: 'Associazione', contacts: { email: 'info@assoe.it' }, socialLinks: [], documents: {} },
  })) {
    fs.writeFileSync(path.join(fixture, 'src/pages', `${name}.astro`), `---
import JoinUsCta from '../components/JoinUsCta.astro';
const association = ${JSON.stringify(association)};
---
<html lang="it"><head><title>Adesione</title></head><body><JoinUsCta association={association} href="#contatti" /></body></html>`);
  }
  const association = { name: 'Associazione', aboutText: 'Il nostro impegno.', contacts: {}, socialLinks: [], documents: {} };
  fs.writeFileSync(path.join(fixture, 'src/content/index.ts'), `export const contentRepository = {
    getAssociationInfo: async () => (${JSON.stringify(association)}), listPeople: async () => [],
    listHomeSections: async () => ${JSON.stringify(defaults)}, listHomeNotices: async () => [],
    listInitiatives: async () => [], listArticles: async () => [], listEvents: async () => [],
  };`);
  fs.copyFileSync(path.join(project, 'src/pages/chi-siamo.astro'), path.join(fixture, 'src/pages/chi-siamo.astro'));
  fs.copyFileSync(path.join(project, 'src/pages/index.astro'), path.join(fixture, 'src/pages/index.astro'));
  fs.mkdirSync(path.join(fixture, 'src/pages/iniziative'), { recursive: true });
  fs.copyFileSync(path.join(project, 'src/pages/iniziative/index.astro'), path.join(fixture, 'src/pages/iniziative/index.astro'));
  await build({
    root: fixture,
    configFile: false,
    base: '/Assoe/',
    logLevel: 'silent',
    vite: { resolve: { alias: { '@': path.join(fixture, 'src') } } },
  });
  const document = (name) => new JSDOM(fs.readFileSync(path.join(fixture, 'dist', ...(name === 'index' ? ['index.html'] : [name, 'index.html'])), 'utf8')).window.document;
  const sectionIds = (doc) => [...doc.querySelectorAll('main > section')]
    .map((section) => section.getAttribute('aria-labelledby') ?? section.className);
  const expected = ['avvisi-home', 'eventi-home', 'iniziative-social', 'iniziative-volunteering', 'articoli-home', 'cinque-per-mille-home'];
  assert.deepEqual(sectionIds(document('default')), ['hero', ...expected]);
  const historical = document('historical');
  assert.equal(historical.querySelector('[aria-labelledby="articoli-home"] time'), null);
  assert.equal(historical.querySelector('[aria-labelledby="articoli-home"] .article-list__link').getAttribute('href'), '/Assoe/articoli/ricordo/');
  assert.ok(document('membership').querySelector('a[href="https://cdn.sanity.io/files/project/production/form.pdf"]'));
  assert.match(document('membership').body.textContent, /esaminata dal direttivo/);
  assert.equal(document('contact').querySelector('a[href*="form.pdf"]'), null);
  for (const [name, selector] of [['chi-siamo', '[aria-labelledby="storia-associazione"]'], ['index', '.hero__actions']]) {
    const area = document(name).querySelector(selector);
    assert.ok(area.querySelector('a[href="/Assoe/volontariato/"]'));
    assert.ok(area.querySelector('a[href="/Assoe/iniziative-sociali/"]'));
    assert.equal(area.querySelector('a[href="/Assoe/iniziative/"]'), null);
  }
  assert.equal(document('iniziative').querySelector('meta[http-equiv="refresh"]').content, '0;url=/Assoe/');
  const reordered = document('reordered');
  assert.deepEqual(sectionIds(reordered), ['hero', ...expected.toReversed()]);
  assert.deepEqual([...reordered.querySelectorAll('[aria-labelledby="iniziative-social"] h3')].map((node) => node.textContent), ['social 1', 'social 2']);
  assert.deepEqual([...reordered.querySelectorAll('[aria-labelledby="articoli-home"] h3')].map((node) => node.textContent), ['Articolo 6', 'Articolo 5', 'Articolo 4', 'Articolo 3', 'Articolo 2']);
  assert.equal(reordered.querySelectorAll('.article-list--featured .article-list__star[aria-hidden="true"]').length, 5);
  assert.deepEqual([...document('noFeatured').querySelectorAll('[aria-labelledby="articoli-home"] h3')].map(node => node.textContent), ['Articolo 7', 'Articolo 6', 'Articolo 5']);
  assert.equal(document('noFeatured').querySelector('.article-list__star'), null);
  assert.equal(document('noFeatured').querySelector('.home-articles__eyebrow').textContent, 'Ultimi articoli');
  assert.match(document('empty').querySelector('[aria-labelledby="articoli-home"] .notice').textContent, /Non ci sono ancora articoli/);
  const archive = document('archive');
  assert.equal(archive.querySelectorAll('.article-list__item').length, 7);
  assert.equal(archive.querySelector('.article-list--featured, .article-list__star'), null);
  assert.equal(reordered.querySelector('[aria-labelledby="eventi-home"] h3').textContent, 'Prossimo evento');
  assert.deepEqual(sectionIds(document('empty')), ['hero', 'cinque-per-mille-home', 'articoli-home', 'iniziative-volunteering', 'iniziative-social']);
});
