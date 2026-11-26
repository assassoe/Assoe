import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeRichTextHtml } from '../src/utils/sanitizeHtml.ts';

test('i collegamenti relativi dei contenuti ripetuti si risolvono dalla pagina originale', () => {
  const base = '/Assoe/iniziative/banco-alimentare/';
  assert.equal(sanitizeRichTextHtml('<p><a href="../../chi-siamo/#contatti">Contatti</a></p>', base), '<p><a href="/Assoe/chi-siamo/#contatti">Contatti</a></p>');
  assert.equal(sanitizeRichTextHtml('<a href="documenti/?anno=2026&amp;tipo=pdf">Documento</a>', base), '<a href="/Assoe/iniziative/banco-alimentare/documenti/?anno=2026&amp;tipo=pdf">Documento</a>');
  for (const href of ['https://example.org/doc', 'mailto:info@example.org', '#sezione', '/chi-siamo/']) {
    assert.equal(sanitizeRichTextHtml(`<a href="${href}">Link</a>`, base), `<a href="${href}">Link</a>`);
  }
  assert.equal(sanitizeRichTextHtml('<a>Testo</a>', base), '<a>Testo</a>');
});

test('la risoluzione dei collegamenti non aggira i protocolli ammessi', () => {
  for (const href of ['javascript:alert(1)', '//evil.example', ' //evil.example']) {
    assert.equal(sanitizeRichTextHtml(`<a href="${href}" onclick="alert(1)">Link</a>`, '/Assoe/iniziative/banco/'), '<a>Link</a>');
  }
});

test('mantiene il contenuto formattato consentito', () => {
  assert.equal(
    sanitizeRichTextHtml('<p>Un <strong>testo</strong> <a href="https://example.org">utile</a>.</p>'),
    '<p>Un <strong>testo</strong> <a href="https://example.org">utile</a>.</p>',
  );
});

test('la restrizione degli avvisi non cambia i titoli del rich text degli articoli', () => {
  assert.equal(sanitizeRichTextHtml('<h2>Un titolo</h2>'), '<h2>Un titolo</h2>');
});

test('rimuove script, attributi e protocolli non sicuri', () => {
  const html = sanitizeRichTextHtml(
    '<p onclick="alert(1)">Test</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>',
  );

  assert.equal(html, '<p>Test</p><a>link</a>');
});

test('permette link relativi e mailto senza consentire protocol-relative URL', () => {
  assert.equal(
    sanitizeRichTextHtml('<a href="/contatti/">Contatti</a><a href="mailto:test@example.org">Email</a><a href="//evil.example">No</a>'),
    '<a href="/contatti/">Contatti</a><a href="mailto:test@example.org">Email</a><a>No</a>',
  );
});
