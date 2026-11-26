import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dev } from 'astro';
import { liveInitiativeArchives } from '../scripts/live-initiative-archives.mjs';

test('solo gli archivi e i dettagli delle iniziative diventano dinamici durante astro dev', () => {
  for (const command of ['dev', 'build', 'preview', 'sync']) {
    const integration = liveInitiativeArchives();
    integration.hooks['astro:config:setup']({ command });
    for (const component of ['src/pages/[initiativeArea]/index.astro', 'src/pages/[initiativeArea]/pagina/[page].astro', 'src/pages/iniziative/[slug].astro', 'src/pages/iniziative/[slug]/pagina/[page].astro', 'src/pages/articoli/[slug].astro']) {
      const route = { component };
      integration.hooks['astro:route:setup']({ route });
      assert.equal(route.prerender, command === 'dev' && !component.includes('articoli') ? false : undefined);
    }
  }
});

test('lo stesso server recepisce rimozioni, nuovi percorsi e spostamenti senza modifiche ai file del sito', async (t) => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-live-archives-')));
  const root = path.join(temporary, 'site'), data = path.join(temporary, 'cms.json');
  let server;
  t.after(async () => {
    if (server) await server.stop();
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  fs.mkdirSync(root);
  fs.cpSync(path.join(project, 'src'), path.join(root, 'src'), { recursive: true, filter: source => source !== path.join(project, 'src/pages') });
  fs.cpSync(path.join(project, 'shared'), path.join(root, 'shared'), { recursive: true });
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  for (const file of ['[initiativeArea]/index.astro', '[initiativeArea]/pagina/[page].astro', 'iniziative/[slug].astro', 'iniziative/[slug]/pagina/[page].astro']) {
    const destination = path.join(root, 'src/pages', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(project, 'src/pages', file), destination);
  }
  fs.writeFileSync(path.join(root, 'src/content/index.ts'), `import fs from 'node:fs/promises';
const current = async () => JSON.parse(await fs.readFile(${JSON.stringify(data)}, 'utf8'));
export const contentRepository = {
  listInitiatives: current,
  getAssociationInfo: async () => null,
  getInitiativeBySlug: async (slug: string) => {
    const record = (await current()).find((i: {slug: string}) => i.slug === slug);
    return record ? {...record, relatedArticles: record.relatedArticles ?? [], relatedEvents: []} : null;
  },
};`);
  const record = (id, area = 'volunteering') => ({ id, slug: id, name: id, area });
  let records = [...Array.from({ length: 7 }, (_, i) => record('original-' + i)), record('social-only', 'social')];
  const save = () => fs.writeFileSync(data, JSON.stringify(records));
  save();
  server = await dev({ root, configFile: false, base: '/Assoe/', logLevel: 'silent', server: { host: '127.0.0.1', port: 0 }, integrations: [liveInitiativeArchives()], vite: { resolve: { alias: { '@': path.join(root, 'src') } } } });
  const read = async (pathname) => {
    const response = await fetch(`http://127.0.0.1:${server.address.port}/Assoe${pathname}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    return { status: response.status, location: response.headers.get('location'), html: await response.text() };
  };
  assert.match((await read('/volontariato/')).html, /original-0/);
  assert.equal((await read('/volontariato/pagina/2/')).status, 200);
  assert.equal((await read('/iniziative/original-0/')).status, 200);
  records = records.filter(record => record.id !== 'original-0');
  save();
  assert.doesNotMatch((await read('/volontariato/')).html, /original-0/);
  assert.equal((await read('/volontariato/pagina/2/')).location, '/Assoe/volontariato/');
  assert.equal((await read('/iniziative/original-0/')).location, '/Assoe/');
  records.push(...Array.from({ length: 8 }, (_, i) => record('new-' + i)));
  save();
  const page = await read('/volontariato/pagina/3/');
  assert.equal(page.status, 200);
  assert.match(page.html, /new-7/);
  assert.equal((await read('/iniziative/new-7/')).status, 200);
  records.find(record => record.id === 'original-1').area = 'social';
  save();
  assert.doesNotMatch((await read('/volontariato/')).html, /original-1/);
  assert.match((await read('/iniziative-sociali/')).html, /original-1/);
  assert.equal((await read('/ambito-inesistente/')).location, '/Assoe/');
  const initiative = records.find(record => record.id === 'original-1');
  initiative.relatedArticles = Array.from({ length: 7 }, (_, i) => ({ id: `storia-${i}`, slug: `storia-${i}`, title: `Storia ${i}`, publishedAt: '2026-01-01T10:00:00Z' }));
  save();
  assert.match((await read('/iniziative/original-1/pagina/2/')).html, /Storia 6/);
  assert.equal((await read('/iniziative/original-1/pagina/1/')).location, '/Assoe/iniziative/original-1/#articoli-iniziativa');
  assert.equal((await read('/iniziative/original-1/pagina/non-valida/')).location, '/Assoe/iniziative/original-1/#articoli-iniziativa');
  assert.equal((await read('/iniziative/inesistente/pagina/2/')).location, '/Assoe/');
  initiative.relatedArticles = [];
  save();
  assert.equal((await read('/iniziative/original-1/pagina/2/')).location, '/Assoe/iniziative/original-1/#articoli-iniziativa');
});
