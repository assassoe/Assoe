import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'astro';
import { JSDOM } from 'jsdom';
import { resolveHomeSectionOrder } from '../shared/homeSections.ts';
import { toAssociationInfo } from '../src/content/providers/sanityMappers.ts';

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
    mixed: { ...content, articles: content.articles.map((article, index) => ({ ...article, featured: index < 2 })) },
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
  const association = toAssociationInfo({
    associationName: 'Vecchio nome', associationShortName: 'Nome dal CMS', associationSubtitle: 'Seconda parte ODV',
    aboutText: 'Il nostro impegno.', taxCode: '01234567890', registryInfo: 'RUNTS n. 12345',
    contacts: { email: 'contatti-cms@example.org', address: 'Via del CMS 42', postalCode: '00100', city: 'Roma', province: 'RM' },
  });
  fs.writeFileSync(path.join(fixture, 'src/content/index.ts'), `export const contentRepository = {
    getAssociationInfo: async () => (${JSON.stringify(association)}), listPeople: async () => [],
    listHomeSections: async () => ${JSON.stringify(defaults)}, listHomeNotices: async () => [],
    listInitiatives: async () => [], listArticles: async () => [], listEvents: async () => [],
  };`);
  fs.copyFileSync(path.join(project, 'src/pages/chi-siamo.astro'), path.join(fixture, 'src/pages/chi-siamo.astro'));
  fs.copyFileSync(path.join(project, 'src/pages/index.astro'), path.join(fixture, 'src/pages/index.astro'));
  fs.cpSync(path.join(project, 'src/pages/privacy'), path.join(fixture, 'src/pages/privacy'), { recursive: true });
  fs.cpSync(path.join(project, 'src/pages/.well-known'), path.join(fixture, 'src/pages/.well-known'), { recursive: true });
  fs.copyFileSync(path.join(project, 'src/pages/humans.txt.ts'), path.join(fixture, 'src/pages/humans.txt.ts'));
  fs.copyFileSync(path.join(project, 'src/pages/404.astro'), path.join(fixture, 'src/pages/404.astro'));
  for (const name of ['associati', 'sostienici']) {
    fs.mkdirSync(path.join(fixture, 'src/pages', name), { recursive: true });
    fs.copyFileSync(path.join(project, 'src/pages', name, 'index.astro'), path.join(fixture, 'src/pages', name, 'index.astro'));
  }
  const identities = {
    'brand-first': toAssociationInfo({ associationShortName: 'Prima parte nuova', associationSubtitle: 'Seconda parte ODV' }),
    'brand-second': toAssociationInfo({ associationShortName: 'Nome dal CMS', associationSubtitle: 'Seconda parte nuova ODV' }),
    'brand-legacy': toAssociationInfo({ associationName: 'Nome precedente intero' }),
    'brand-missing': null,
    'brand-escaped': toAssociationInfo({ associationShortName: '<script>nome</script>', associationSubtitle: 'Nome & ODV' }),
  };
  for (const [name, identity] of Object.entries(identities)) {
    fs.writeFileSync(path.join(fixture, 'src/pages', `${name}.astro`), `---
import BaseLayout from '../layouts/BaseLayout.astro';
import BrandEyebrow from '../components/BrandEyebrow.astro';
import HomeSupport from '../components/HomeSupport.astro';
import EventFeature from '../components/EventFeature.astro';
Astro.locals.associationInfo = Promise.resolve(${JSON.stringify(identity)});
---
<BaseLayout title="Pagina prova"><main id="contenuto"><BrandEyebrow /><HomeSupport /><EventFeature event={${JSON.stringify(content.featuredEvent)}} /></main></BaseLayout>`);
  }
  fs.mkdirSync(path.join(fixture, 'src/pages/iniziative'), { recursive: true });
  fs.copyFileSync(path.join(project, 'src/pages/iniziative/index.astro'), path.join(fixture, 'src/pages/iniziative/index.astro'));
  await build({
    root: fixture,
    configFile: false,
    site: 'https://example.org',
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
  const fullName = 'Nome dal CMS Seconda parte ODV';
  const home = document('index');
  assert.equal(home.querySelector('.brand__main').textContent, association.shortName);
  assert.equal(home.querySelector('.brand__sub').textContent, association.subtitle);
  assert.equal(home.querySelector('.brand').getAttribute('aria-label'), `${fullName}, pagina iniziale`);
  assert.equal(home.querySelector('h1').textContent, fullName);
  assert.equal(home.title, fullName);
  assert.equal(home.querySelector('meta[name="description"]').content, `Volontariato, iniziative sociali, eventi e racconti di ${fullName}.`);
  assert.equal(home.querySelector('link[rel="canonical"]').href, 'https://example.org/Assoe/');
  assert.equal(home.querySelector('meta[property="og:url"]').content, 'https://example.org/Assoe/');
  assert.equal(home.querySelector('meta[property="og:title"]').content, fullName);
  assert.equal(home.querySelector('meta[property="og:description"]').content, home.querySelector('meta[name="description"]').content);
  assert.equal(home.querySelector('footer a[href="/Assoe/privacy/"]').textContent, 'Privacy');
  assert.equal(home.querySelector('footer .site-footer__bottom-links--contact-only'), null);
  const privacy = document('privacy');
  assert.match(privacy.body.textContent, /Il titolare è Nome dal CMS Seconda parte ODV/);
  assert.match(privacy.body.textContent, /Via del CMS 42, 00100 Roma RM/);
  assert.match(privacy.body.textContent, /01234567890/);
  assert.match(privacy.body.textContent, /RUNTS n\. 12345/);
  assert.equal(privacy.querySelectorAll('a[href="mailto:contatti-cms@example.org"]').length, 2);
  assert.match(privacy.querySelector('meta[name="description"]').content, /Nome dal CMS Seconda parte ODV/);
  assert.doesNotMatch(privacy.body.textContent, /93038190638|info@assoe\.it|Via Ponti Rossi/);
  assert.equal(privacy.querySelector('time').getAttribute('datetime'), '2026-11-26');
  const security = fs.readFileSync(path.join(fixture, 'dist/.well-known/security.txt'), 'utf8');
  assert.match(security, /^Contact: mailto:contatti-cms@example.org\nExpires: /);
  assert.ok(new Date(security.match(/^Expires: (.+)$/m)[1]).getTime() > Date.now());
  const humans = fs.readFileSync(path.join(fixture, 'dist/humans.txt'), 'utf8');
  assert.match(humans, /Contenuti: Nome dal CMS Seconda parte ODV\nContatto associazione: contatti-cms@example.org/);
  assert.equal(privacy.querySelector('iframe, form, script[src^="https:"]'), null);
  const missing = new JSDOM(fs.readFileSync(path.join(fixture, 'dist/404.html'), 'utf8')).window.document;
  assert.equal(missing.querySelector('meta[http-equiv="refresh"]').content, '0;url=/Assoe/');
  assert.equal(missing.querySelector('a').getAttribute('href'), '/Assoe/');
  assert.doesNotMatch(missing.body.textContent, /404|not found/i);
  assert.equal(home.querySelector('.site-footer__identity > strong').textContent, fullName);
  assert.match(home.querySelector('.five-per-mille').textContent, /Nome dal CMS Seconda parte ODV/);
  assert.equal(document('chi-siamo').title, `Chi siamo | ${fullName}`);
  assert.equal(document('chi-siamo').querySelector('.brand-eyebrow').textContent, association.shortName);
  assert.equal(document('associati').querySelector('h1').textContent, `Le persone di ${fullName}`);
  assert.equal(document('sostienici').querySelector('.support-method__name').textContent, fullName);
  assert.match(document('sostienici').querySelector('meta[name="description"]').content, /Nome dal CMS Seconda parte ODV/);
  for (const [name, identity] of Object.entries(identities)) {
    const page = document(name);
    const complete = identity?.name ?? 'Asso è… La Strada ci Insegna ODV';
    const short = identity?.shortName ?? 'Asso è…';
    assert.equal(page.title, `Pagina prova | ${complete}`);
    assert.equal(page.querySelector('.brand__main').textContent, short);
    assert.equal(page.querySelector('.brand__sub')?.textContent, identity ? identity.subtitle : 'La Strada ci Insegna ODV');
    assert.equal(page.querySelector('.brand-eyebrow').textContent, short);
    assert.equal(page.querySelector('.event-feature__placeholder').textContent, short);
    assert.equal(page.querySelector('.site-footer__identity > strong').textContent, complete);
    assert.ok(page.querySelector('.five-per-mille').textContent.includes(complete));
    assert.equal(page.querySelector('header script'), null);
  }
  const reordered = document('reordered');
  assert.deepEqual(sectionIds(reordered), ['hero', ...expected.toReversed()]);
  assert.deepEqual([...reordered.querySelectorAll('[aria-labelledby="iniziative-social"] h3')].map((node) => node.textContent), ['social 1', 'social 2']);
  assert.deepEqual([...reordered.querySelectorAll('[aria-labelledby="articoli-home"] h3')].map((node) => node.textContent), ['Articolo 6', 'Articolo 5', 'Articolo 4', 'Articolo 3']);
  assert.equal(reordered.querySelectorAll('.article-list__star[aria-hidden="true"]').length, 4);
  assert.deepEqual([...document('noFeatured').querySelectorAll('[aria-labelledby="articoli-home"] h3')].map(node => node.textContent), ['Articolo 7', 'Articolo 6', 'Articolo 5', 'Articolo 4']);
  const mixed = document('mixed').querySelector('[aria-labelledby="articoli-home"]');
  assert.deepEqual([...mixed.querySelectorAll('h3')].map(node => node.textContent), ['Articolo 2', 'Articolo 1', 'Articolo 7', 'Articolo 6']);
  assert.equal(mixed.querySelectorAll('.article-list__star').length, 2);
  assert.equal(mixed.querySelectorAll('.article-list__item:not(.article-list__item--featured)').length, 2);
  assert.equal(document('noFeatured').querySelector('.article-list__star'), null);
  assert.equal(document('noFeatured').querySelector('.home-articles__eyebrow').textContent, 'Ultimi articoli');
  assert.match(document('empty').querySelector('[aria-labelledby="articoli-home"] .notice').textContent, /Non ci sono ancora articoli/);
  const archive = document('archive');
  assert.equal(archive.querySelectorAll('.article-list__item').length, 7);
  assert.equal(archive.querySelector('.article-list--featured, .article-list__star'), null);
  assert.equal(reordered.querySelector('[aria-labelledby="eventi-home"] h3').textContent, 'Prossimo evento');
  assert.deepEqual(sectionIds(document('empty')), ['hero', 'cinque-per-mille-home', 'articoli-home', 'iniziative-volunteering', 'iniziative-social']);
});
