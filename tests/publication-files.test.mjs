import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { publicationFiles } from '../scripts/publication-files.mjs';

async function fixture(t, site, base, pages) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'assoe-publication-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dir = pathToFileURL(`${root}/`);
  for (const [name, html] of Object.entries(pages)) {
    const file = new URL(name, dir);
    await fs.mkdir(new URL('./', file), { recursive: true });
    await fs.writeFile(file, html);
  }
  const integration = publicationFiles();
  integration.hooks['astro:config:done']({ config: { site, base } });
  return { dir, build: () => integration.hooks['astro:build:done']({ dir }) };
}

for (const base of ['/', '/Assoe/']) {
  test(`gli indici includono i canonical pubblici ed escludono alias e noindex con base ${base}`, async (t) => {
    const home = `https://example.org${base}`;
    const { dir, build } = await fixture(t, 'https://example.org', base, {
      'index.html': `<link rel="canonical" href="${home}">`,
      'articoli/uno/index.html': `<link rel="canonical" href="${home}articoli/uno/">`,
      'alias/index.html': `<meta http-equiv="refresh" content="0;url=${base}"><link rel="canonical" href="${home}">`,
      '404.html': '<meta name="robots" content="noindex">',
      'privata/index.html': '<meta name="robots" content="noindex,nofollow">',
      'duplicata/index.html': `<link rel="canonical" href="${home}">`,
      'assets/font.woff2': 'non è una pagina',
    });
    await build();
    const sitemap = new JSDOM(await fs.readFile(new URL('sitemap.xml', dir), 'utf8'), { contentType: 'application/xml' }).window.document;
    assert.equal(sitemap.documentElement.namespaceURI, 'http://www.sitemaps.org/schemas/sitemap/0.9');
    assert.deepEqual([...sitemap.querySelectorAll('loc')].map(el => el.textContent), [home, `${home}articoli/uno/`]);
    assert.equal(await fs.readFile(new URL('robots.txt', dir), 'utf8'), `User-agent: *\nAllow: /\n\nSitemap: ${home}sitemap.xml\n`);
  });
}

test('l’anteprima non pubblicizza URL non indicizzabili e consente la lettura del noindex', async (t) => {
  const { dir, build } = await fixture(t, 'https://example.org', '/Assoe/', {
    'index.html': '<meta name="robots" content="noindex,nofollow"><link rel="canonical" href="https://example.org/Assoe/">',
  });
  await build();
  assert.doesNotMatch(await fs.readFile(new URL('sitemap.xml', dir), 'utf8'), /<loc>/);
  assert.equal(await fs.readFile(new URL('robots.txt', dir), 'utf8'), 'User-agent: *\nAllow: /\n');
});

test('gli indici gestiscono un sito vuoto e gli attributi escapati come XML', async (t) => {
  const empty = await fixture(t, 'https://example.org', '/', {});
  await empty.build();
  assert.doesNotMatch(await fs.readFile(new URL('sitemap.xml', empty.dir), 'utf8'), /<loc>/);
  const escaped = await fixture(t, 'https://example.org', '/', {
    'index.html': '<link rel="canonical" href="https://example.org/?a=1&amp;b=2">',
  });
  await escaped.build();
  const document = new JSDOM(await fs.readFile(new URL('sitemap.xml', escaped.dir), 'utf8'), { contentType: 'application/xml' }).window.document;
  assert.equal(document.querySelector('loc').textContent, 'https://example.org/?a=1&b=2');
});

test('la generazione fallisce con dominio assente o una pagina pubblica senza canonical', async (t) => {
  const missingSite = await fixture(t, undefined, '/', {});
  await assert.rejects(missingSite.build, /Configurare site/);
  const missingCanonical = await fixture(t, 'https://example.org', '/', { 'index.html': '<title>Pagina</title>' });
  await assert.rejects(missingCanonical.build, /Canonical mancante/);
});
