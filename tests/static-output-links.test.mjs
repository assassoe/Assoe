import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-static-output.mjs', import.meta.url));
const markup = (content) => `<!doctype html><html><head><title>Pagina</title><meta name="description" content="Descrizione"><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="https://example.org/"><meta property="og:title" content="Pagina"><meta property="og:description" content="Descrizione"><meta property="og:url" content="https://example.org/"></head><body><header class="site-header"><span class="brand__wordmark">Asso è…</span></header><nav class="desktop-nav" aria-label="Navigazione principale"></nav><nav aria-label="Navigazione mobile"></nav><main><h1>Pagina</h1>${content}</main><footer class="site-footer"></footer></body></html>`;

function check(t, href, base) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-static-links-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['dist/iniziative/banco-alimentare', 'dist/chi-siamo']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'dist/iniziative/banco-alimentare/index.html'), markup(`<p id="descrizione"><a href="${href}">Contattaci</a></p>`));
  fs.writeFileSync(path.join(root, 'dist/chi-siamo/index.html'), markup('<section id="contatti">Email e telefono</section>'));
  fs.writeFileSync(path.join(root, 'dist/index.html'), markup('<section id="home">Homepage</section>'));
  return spawnSync(process.execPath, [checker], {
    cwd: root, encoding: 'utf8', env: { ...process.env, SITE_BASE: base, PUBLIC_SITE_PREVIEW: 'true' },
  });
}

for (const base of ['/', '/Assoe/']) {
  test(`il controllo HTML risolve il richiamo relativo ai contatti con base ${base}`, (t) => {
    const result = check(t, '../../chi-siamo/?origine=banco#contatti', base);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Output statico valido: 3 pagine HTML/);
  });
}

test('un link relativo alla stessa pagina mantiene query e ancora', (t) => {
  const result = check(t, './?origine=banco#descrizione', '/Assoe/');
  assert.equal(result.status, 0, result.stderr);
});

test('un link relativo con destinazione mancante continua a bloccare la build', (t) => {
  const result = check(t, '../../assente/', '/Assoe/');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /destinazione interna mancante/);
});

test('un link relativo con ancora inesistente continua a bloccare la build', (t) => {
  const result = check(t, '../../chi-siamo/#assente', '/Assoe/');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ancora inesistente/);
});

test('un link relativo non può risalire fuori dalla base del sito', (t) => {
  const result = check(t, '../../../chi-siamo/#contatti', '/Assoe/');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /destinazione interna mancante/);
});

test('i percorsi assoluti senza prefisso Pages restano non validi', (t) => {
  const result = check(t, '/chi-siamo/#contatti', '/Assoe/');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /link interno senza base GitHub Pages/);
});

test('i percorsi assoluti con prefisso Pages continuano a essere verificati', (t) => {
  const result = check(t, '/Assoe/chi-siamo/#contatti', '/Assoe/');
  assert.equal(result.status, 0, result.stderr);
});

test('il percorso relativo alla homepage risolve il suo file HTML', (t) => {
  const result = check(t, '../../#home', '/Assoe/');
  assert.equal(result.status, 0, result.stderr);
});

test('l’ancora della homepage viene verificata anche risalendo con un percorso relativo', (t) => {
  const result = check(t, '../../#assente', '/Assoe/');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ancora inesistente/);
});

test('una cartella senza slash finale non sostituisce il controllo dell’ancora nel suo index', (t) => {
  const result = check(t, '../../chi-siamo#assente', '/Assoe/');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ancora inesistente/);
});
