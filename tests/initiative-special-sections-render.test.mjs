import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'astro';
import { JSDOM } from 'jsdom';
import { toInitiativeSpecialSections } from '../src/content/providers/initiativeSpecialSections.ts';

test('la pagina iniziativa mostra le sezioni in ordine senza cambiare pagine ordinarie e racconti collegati', async (t) => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  // Astro usa un output condiviso se dist è fuori da cwd: questa fixture resta isolata nel progetto.
  fs.mkdirSync(path.join(project, '.astro'), { recursive: true });
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(project, '.astro/assoe-special-render-')));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(path.join(project, 'src'), path.join(fixture, 'src'), { recursive: true, filter: (source) => source !== path.join(project, 'src/pages') });
  fs.cpSync(path.join(project, 'shared'), path.join(fixture, 'shared'), { recursive: true });
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(fixture, 'src/pages/iniziative'), { recursive: true });
  fs.copyFileSync(path.join(project, 'src/pages/iniziative/[slug].astro'), path.join(fixture, 'src/pages/iniziative/[slug].astro'));
  fs.mkdirSync(path.join(fixture, 'src/pages/iniziative/[slug]/pagina'), { recursive: true });
  fs.copyFileSync(path.join(project, 'src/pages/iniziative/[slug]/pagina/[page].astro'), path.join(fixture, 'src/pages/iniziative/[slug]/pagina/[page].astro'));
  // L'ottimizzazione remota è indipendente: qui controlliamo alt, variante e assenza di ritagli passati al componente condiviso.
  fs.writeFileSync(path.join(fixture, 'src/components/ContentImage.astro'), `---
const {src, alt, variant} = Astro.props;
---
<img src={src} alt={alt} data-variant={variant} />`);
  const body = [{ _type: 'block', style: 'normal', markDefs: [], children: [{ _type: 'span', text: 'Sostegno europeo', marks: [] }] }];
  const sections = toInitiativeSpecialSections([
    { _type: 'initiativeInstitutionalSection', title: 'Comunicazione', period: 'Anno 2026', body },
    { _type: 'initiativeLogosSection', title: 'Loghi', logos: [
      { imageUrl: 'https://cdn.sanity.io/images/test/production/logo.svg', alt: 'Cofinanziato dall’Unione europea', url: 'https://example.org/programma' },
      { imageUrl: 'https://cdn.sanity.io/images/test/production/altro.png', alt: 'Altro ente' },
    ] },
    { _type: 'initiativeDocumentsSection', title: 'Documenti', documents: [{ title: 'Informativa', description: 'Per i destinatari', url: 'https://cdn.sanity.io/files/test/production/privacy.pdf' }, { title: 'Secondo documento', url: 'https://cdn.sanity.io/files/test/production/altro.pdf' }] },
    { _type: 'initiativeFactsSection', title: 'Risultati', facts: [{ label: 'Percorsi', value: '12', unit: 'incontri' }, { label: 'Periodo', value: '2026' }] },
    { _type: 'initiativeTextSection', title: '<script>titolo</script>', body },
  ]);
  const base = { id: 'iniziativa', name: 'Iniziativa', area: 'volunteering', relatedArticles: [{ id: 'storia', slug: '2026-11-25-storia', title: 'Racconto collegato', publishedAt: '2026-11-25T12:00:00Z' }], relatedEvents: [] };
  const articles = Array.from({ length: 13 }, (_, i) => ({ id: `storia-${i}`, slug: `storia-${i}`, title: `Storia ${i}`, publishedAt: '2026-11-25T12:00:00Z' }));
  const events = Array.from({ length: 8 }, (_, i) => ({ id: `evento-${i}`, slug: `evento-${i}`, title: `Evento ${i}`, date: '2026-11-25T12:00:00Z', status: 'completed' }));
  const initiatives = [{ ...base, slug: 'ordinaria' }, { ...base, slug: 'speciale', specialSections: sections },
    { ...base, slug: 'tante-storie', descriptionHtml: '<p>Presentazione da mantenere <a href="../../chi-siamo/#contatti">Contatti</a></p>', specialSections: sections, relatedArticles: articles, relatedEvents: events },
    { ...base, slug: 'sei-storie', relatedArticles: articles.slice(0, 6) },
    { ...base, slug: 'nessuna-storia', relatedArticles: [] }];
  fs.writeFileSync(path.join(fixture, 'src/content/index.ts'), `
    const initiatives = ${JSON.stringify(initiatives)};
    export const contentRepository = {
      getAssociationInfo: async () => null,
      listInitiatives: async () => initiatives,
      getInitiativeBySlug: async (slug: string) => initiatives.find((item) => item.slug === slug),
    };`);
  await build({ root: fixture, cacheDir: path.join(fixture, '.cache'), configFile: false, base: '/Assoe/', logLevel: 'silent', vite: { resolve: { alias: { '@': path.join(fixture, 'src') } } } });
  const document = (slug) => new JSDOM(fs.readFileSync(path.join(fixture, 'dist/iniziative', slug, 'index.html'), 'utf8')).window.document;
  const ordinary = document('ordinaria');
  assert.equal(ordinary.querySelector('.initiative-special-section'), null);
  assert.match(ordinary.body.textContent, /Racconto collegato/);
  const special = document('speciale');
  const ordered = [...sections.filter(({ kind }) => kind === 'logos'), ...sections.filter(({ kind }) => kind !== 'logos')];
  assert.deepEqual([...special.querySelectorAll('.initiative-special-section h2')].map((node) => node.textContent), ordered.map(({ title }) => title));
  assert.equal(special.querySelector('.initiative-special-section script'), null);
  for (const section of special.querySelectorAll('.initiative-special-section')) assert.ok(special.getElementById(section.getAttribute('aria-labelledby')));
  assert.equal(special.querySelector('.initiative-special-section__period').textContent, 'Anno 2026');
  assert.equal(special.querySelector('.initiative-logos img').alt, 'Cofinanziato dall’Unione europea');
  assert.equal(special.querySelector('.initiative-logos img').dataset.variant, 'institutionalLogo');
  assert.equal(special.querySelectorAll('.initiative-logos a').length, 1);
  assert.match(special.querySelector('.initiative-documents a').textContent, /Informativa.*PDF/);
  assert.equal(special.querySelector('.initiative-facts dt').textContent, 'Percorsi');
  assert.equal(special.querySelector('.initiative-facts dd').textContent, '12 incontri');
  assert.match(special.body.textContent, /Racconto collegato/);
  assert.ok(!special.body.textContent.includes('Danilo'));
  const first = document('tante-storie');
  const second = document('tante-storie/pagina/2');
  const third = document('tante-storie/pagina/3');
  const titles = doc => [...doc.querySelectorAll('.article-list h3')].map(node => node.textContent);
  assert.deepEqual(titles(first), articles.slice(0, 6).map(({ title }) => title));
  assert.deepEqual(titles(second), articles.slice(6, 12).map(({ title }) => title));
  assert.deepEqual(titles(third), [articles[12].title]);
  assert.equal(new Set([...titles(first), ...titles(second), ...titles(third)]).size, 13);
  assert.equal(first.querySelectorAll('.content-card').length, 8);
  for (const page of [first, second, third]) {
    assert.equal(page.querySelectorAll('.content-card').length, 8);
    assert.ok(page.querySelector('#eventi-iniziativa'));
    assert.match(page.querySelector('.detail__lead').textContent, /Presentazione da mantenere/);
    assert.equal(page.querySelector('.detail__lead a').getAttribute('href'), '/Assoe/chi-siamo/#contatti');
    assert.deepEqual([...page.querySelectorAll('.initiative-special-section h2')].map(node => node.textContent), ordered.map(({ title }) => title));
    const before = (first, second) => Boolean(first.compareDocumentPosition(second) & 4);
    const stories = page.querySelector('[aria-labelledby="articoli-iniziativa"]');
    const eventsBlock = page.querySelector('[aria-labelledby="eventi-iniziativa"]');
    const logoBlock = page.querySelector('.initiative-logos').closest('section');
    const fullCommunication = page.querySelector('.initiative-special-section--institutional');
    const documents = page.querySelector('.initiative-documents').closest('section');
    assert.ok(before(page.querySelector('.initiative-support-summary'), stories));
    assert.equal(page.querySelectorAll('.initiative-support-summary').length, 1);
    assert.ok(page.querySelector('.initiative-logos-banner .initiative-support-summary'));
    assert.ok(before(logoBlock, stories));
    assert.ok(before(eventsBlock, fullCommunication));
    assert.ok(before(eventsBlock, documents));
    assert.equal(page.querySelectorAll('.initiative-special-section--institutional').length, 1);
    assert.equal(page.querySelectorAll('.initiative-documents').length, 1);
    assert.equal(page.querySelector('.initiative-support-summary a').getAttribute('href'), `#${sections[0].id}`);
  }
  assert.ok(first.querySelector('a[href="/Assoe/iniziative/tante-storie/pagina/2/#articoli-iniziativa"]'));
  assert.ok(second.querySelector('a[href="/Assoe/iniziative/tante-storie/#articoli-iniziativa"]'));
  assert.equal(third.querySelector('.desktop-nav [aria-current="page"]').textContent, 'Volontariato');
  assert.equal(third.querySelector('.pagination__number--current').textContent, '3');
  assert.equal(document('sei-storie').querySelector('.pagination'), null);
  assert.equal(document('nessuna-storia').querySelector('.article-list, .pagination'), null);
});
