import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, parse } from 'groq-js';
import { selectFeaturedArticles, selectHomeArticles } from '../src/utils/featuredArticles.ts';
import { MAX_FEATURED_ARTICLES } from '../shared/featuredArticles.ts';
import { featuredArticleIdsQuery, validateFeaturedArticle } from '../studio/schemaTypes/featuredArticles.ts';
import { toArticleSummary } from '../src/content/providers/sanityMappers.ts';
import { articlesQuery } from '../src/content/providers/sanityQueries.ts';

const article = (id, extra = {}) => ({ id, title: id, slug: id, publishedAt: '2025-01-01T10:00:00Z', ...extra });

test('seleziona solo i preferiti senza modificare l’elenco originale o riempire posti liberi', () => {
  const input = Object.freeze([
    article('recente', { publishedAt: '2026-11-20T10:00:00Z' }),
    article('preferito', { featured: true }),
    article('non-piu-preferito', { featured: false }),
    ...[null, 'true', 1, {}].map(featured => article(String(featured), { featured })),
  ].map(Object.freeze));
  assert.deepEqual(selectFeaturedArticles(input).map(a => a.id), ['preferito']);
  assert.equal(input.length, 7);
  assert.deepEqual(selectFeaturedArticles([]), []);
  assert.deepEqual(selectFeaturedArticles([article('normale')]), []);
});

test('limita a cinque, ordina per data e rende deterministici parità e ricordi senza data', () => {
  assert.equal(MAX_FEATURED_ARTICLES, 5);
  const dated = Array.from({ length: 8 }, (_, index) => article(`a-${index}`, { featured: true, publishedAt: `2025-01-0${index+1}T10:00:00Z` }));
  const selected = selectFeaturedArticles(dated);
  assert.deepEqual(selected.map(a => a.id), ['a-7', 'a-6', 'a-5', 'a-4', 'a-3']);
  assert.deepEqual(selectFeaturedArticles(dated.toReversed()), selected);
  const historical = [article('z', { featured: true, historicalUndated: true }), article('b', { featured: true }), article('a', { featured: true }), article('y', { featured: true, historicalUndated: true })];
  assert.deepEqual(selectFeaturedArticles(historical).map(a => a.id), ['a', 'b', 'y', 'z']);
});

test('query e mapping trasportano la scelta editoriale, interpretando solo true come preferito', async () => {
  const base = { _id: 'id', _type: 'article', title: 'Storia', slug: { current: 'storia' }, publishedAt: '2025-01-01T10:00:00Z' };
  for (const featured of [true, false, null, undefined, 'true', 1]) {
    const results = await (await evaluate(parse(articlesQuery), { dataset: [{ ...base, featured }] })).get();
    assert.equal(results[0].featured, featured ?? null);
    const mapped = toArticleSummary(results[0]);
    assert.equal(mapped.featured, featured === true ? true : undefined);
    assert.equal(selectFeaturedArticles([mapped]).length, featured === true ? 1 : 0);
  }
});

function context(dataset, documentId = 'drafts.current') {
  return {
    document: { _id: documentId },
    getClient: ({ apiVersion }) => {
      assert.equal(apiVersion, '2026-03-01');
      return { fetch: async (query, params, options) => {
        assert.equal(query, featuredArticleIdsQuery);
        assert.deepEqual(params.excludedIds, ['current', 'drafts.current']);
        assert.equal(options.perspective, 'raw');
        return (await evaluate(parse(query), { dataset, params })).get();
      } };
    },
  };
}

test('lo Studio conta bozza e pubblicato una sola volta, esclude il documento corrente e le release', async () => {
  const record = (_id, featured = true) => ({ _id, _type: 'article', featured });
  const dataset = [record('current'), record('drafts.current'), record('versions.release.future'), record('normale', false), { _id: 'evento', _type: 'event', featured: true }];
  assert.equal(await validateFeaturedArticle(true, context(dataset)), true);
  for (let index=0; index<4; index++) dataset.push(record(`a-${index}`), record(`drafts.a-${index}`));
  assert.equal(await validateFeaturedArticle(true, context(dataset, 'current')), true);
  dataset.push(record('drafts.quinto'));
  assert.match(await validateFeaturedArticle(true, context(dataset)), /massimo 5/);
  // Pubblicare un altro articolo senza la spunta libera il posto.
  dataset[dataset.length-1].featured = false;
  assert.equal(await validateFeaturedArticle(true, context(dataset)), true);
});

test('disattivazione e campo assente non richiedono rete; gli errori di verifica impediscono di pubblicare', async () => {
  const getClient = () => { assert.fail('nessuna richiesta prevista'); };
  for (const value of [false, null, undefined]) assert.equal(await validateFeaturedArticle(value, { document: { _id: 'id' }, getClient }), true);
  assert.equal(await validateFeaturedArticle(true, { getClient }), true);
  assert.equal(await validateFeaturedArticle(true, { document: {}, getClient }), true);
  for (const result of [null, {}, 0, [42]]) {
    assert.match(await validateFeaturedArticle(true, { document: { _id: 'id' }, getClient: () => ({ fetch: async () => result }) }), /Non è stato possibile/);
  }
  assert.match(await validateFeaturedArticle(true, { document: { _id: 'id' }, getClient: () => ({ fetch: async () => { throw new Error('offline'); } }) }), /Non è stato possibile/);
});


test('senza preferiti la home mostra gli ultimi quattro senza modificare l’elenco ricevuto', () => {
  const input = Object.freeze([article('vecchio', { publishedAt: '2020-01-01T10:00:00Z' }), article('secondo', { publishedAt: '2024-01-01T10:00:00Z' }), article('ultimo', { publishedAt: '2026-01-01T10:00:00Z' }), article('terzo', { publishedAt: '2023-01-01T10:00:00Z' })].map(Object.freeze));
  assert.deepEqual(selectHomeArticles(input).map(a => a.id), ['ultimo', 'secondo', 'terzo', 'vecchio']);
  assert.equal(input[0].id, 'vecchio');
  assert.deepEqual(selectHomeArticles([]), []);
  assert.deepEqual(selectHomeArticles(input.slice(0, 2)).map(a => a.id), ['secondo', 'vecchio']);
  assert.deepEqual(selectHomeArticles([...input, article('scelto', { featured: true })]).map(a => a.id), ['scelto', 'ultimo', 'secondo', 'terzo']);
});

test('il ripiego sui recenti conserva i ricordi senza data in fondo e risolve le parità', () => {
  const input = [article('storico', { historicalUndated: true, publishedAt: '2026-11-20T10:00:00Z' }), article('b'), article('a'), article('vecchio', { publishedAt: '2010-01-01T10:00:00Z' })];
  assert.deepEqual(selectHomeArticles(input).map(a => a.id), ['a', 'b', 'vecchio', 'storico']);
  assert.deepEqual(selectHomeArticles(input.slice(0, 2)).map(a => a.id), ['b', 'storico']);
});

test('quattro posti complessivi danno priorità ai preferiti senza ripeterli fra i recenti', () => {
  const input = [article('recente-2', { publishedAt: '2026-02-01T10:00:00Z' }), article('scelto-1', { featured: true }), article('recente-1', { publishedAt: '2026-01-01T10:00:00Z' }), article('scelto-2', { featured: true }), article('normale')];
  assert.deepEqual(selectHomeArticles(input).map(({ id }) => id), ['scelto-1', 'scelto-2', 'recente-2', 'recente-1']);
  assert.equal(new Set(selectHomeArticles(input).map(({ id }) => id)).size, 4);
  const many = Array.from({ length: 7 }, (_, i) => article(`preferito-${i}`, { featured: true }));
  assert.equal(selectHomeArticles(many).length, 4);
  assert.equal(selectFeaturedArticles(many).length, 5);
  assert.equal(selectHomeArticles([article('unico', { featured: true })]).length, 1);
});
