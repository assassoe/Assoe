import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'astro';
import { JSDOM } from 'jsdom';

const event = (slug, date, status = 'scheduled') => ({ id: slug, slug, title: slug, date, status });
const past = [
  ...Array.from({ length: 7 }, (_, index) => event(`passato-${index}`, `2025-01-0${index + 1}T10:00:00Z`)),
  event('passato-vecchio', '2024-01-01T10:00:00Z'),
];
const future = [
  event('annullato', '2099-01-01T10:00:00Z', 'cancelled'),
  event('gia-concluso', '2099-01-02T10:00:00Z', 'completed'),
  event('successivo', '2099-02-01T10:00:00Z'),
  event('prossimo', '2099-01-03T10:00:00Z'),
];

test('la pagina eventi unifica prossimo appuntamento e passati, nascondendo i prossimi quando assenti', async (t) => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  // Astro usa una directory condivisa per il prerender se l'output è fuori dalla cwd.
  const fixtures = path.join(project, '.astro');
  fs.mkdirSync(fixtures, { recursive: true });
  for (const [name, events] of Object.entries({ completo: [...past, ...future], passati: past, futuri: future, vuoto: [] })) {
    await t.test(name, async (t) => {
      const fixture = fs.realpathSync(fs.mkdtempSync(path.join(fixtures, 'events-render-')));
      t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
      fs.cpSync(path.join(project, 'src'), path.join(fixture, 'src'), {
        recursive: true,
        filter: (source) => source !== path.join(project, 'src/pages'),
      });
      fs.cpSync(path.join(project, 'shared'), path.join(fixture, 'shared'), { recursive: true });
      fs.symlinkSync(path.join(project, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
      for (const route of ['index.astro', 'pagina/[page].astro', 'archivio/[...archive].astro']) {
        const target = path.join(fixture, 'src/pages/eventi', route);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(project, 'src/pages/eventi', route), target);
      }
      fs.writeFileSync(path.join(fixture, 'src/content/index.ts'), `export const contentRepository = {
        listEvents: async () => ${JSON.stringify(events)},
        getAssociationInfo: async () => null,
      };`);
      await build({ root: fixture, configFile: false, base: '/Assoe/', logLevel: 'silent', cacheDir: path.join(fixture, '.astro'),
        vite: { cacheDir: path.join(fixture, '.vite'), resolve: { alias: { '@': path.join(fixture, 'src') } } },
      });
      const document = (route = 'eventi') => new JSDOM(fs.readFileSync(path.join(fixture, 'dist', route, 'index.html'), 'utf8')).window.document;
      const main = document();
      const hasFuture = events.includes(future[3]);
      const hasPast = events.includes(past[0]);
      assert.equal(main.querySelectorAll('h1').length, 1);
      assert.equal(Boolean(main.querySelector('#prossimo-evento')), hasFuture);
      assert.equal(main.querySelector('.event-feature h3')?.textContent, hasFuture ? 'prossimo' : undefined);
      assert.ok(main.querySelector('#eventi-passati'));
      assert.ok(!main.querySelector('main').textContent.includes('Archivio eventi'));
      assert.equal(Boolean(main.querySelector('.notice')), !hasPast);
      assert.equal(Boolean(main.querySelector('.dropdown-nav')), hasPast);
      if (hasFuture && hasPast) {
        assert.ok(main.querySelector('#prossimo-evento').compareDocumentPosition(main.querySelector('#eventi-passati')) & 4);
      }
      if (hasPast) {
        const titles = (doc) => [...doc.querySelectorAll('[aria-labelledby="eventi-passati"] .content-card h3')].map(node => node.textContent);
        assert.deepEqual(titles(main), ['passato-6', 'passato-5', 'passato-4', 'passato-3', 'passato-2', 'passato-1']);
        const second = document('eventi/pagina/2');
        assert.deepEqual(titles(second), ['passato-0', 'passato-vecchio']);
        assert.equal(second.querySelector('#prossimo-evento'), null);
        assert.ok(main.querySelector('a[href="/Assoe/eventi/pagina/2/"]'));
        const annual = document('eventi/archivio/2025/pagina/2');
        assert.deepEqual(titles(annual), ['passato-0']);
        assert.equal(annual.querySelector('.dropdown-nav [aria-current="page"]').textContent, '2025');
        assert.equal(annual.querySelector('#prossimo-evento'), null);
        assert.deepEqual(titles(document('eventi/archivio')), titles(main));
      }
    });
  }
});
