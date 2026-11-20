import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isArticlePublicSlug, validArticleAliases } from '../shared/articleSlug.ts';
import { articleStaticPaths } from '../src/utils/articleRedirects.ts';
import { toArticleSummary } from '../src/content/providers/sanityMappers.ts';

test('gli indirizzi precedenti ammettono soltanto date reali e parti brevi sicure', () => {
  for (const value of ['befana-casa-famiglia', '2016-01-06-befana-casa-famiglia', '2024-02-29-festa']) assert.equal(isArticlePublicSlug(value), true);
  for (const value of [null, {}, '', '2025-02-29-festa', '2026-13-01-festa', '2026-11-19-', '2026-11-19-2020-01-01-festa', '2026-11-19-Festa', '2026-11-19-../festa', '2026-11-19-festa?x=1', '2026-11-19-' + 'a'.repeat(49)]) assert.equal(isArticlePublicSlug(value), false);
  assert.deepEqual(validArticleAliases(undefined), []);
  assert.deepEqual(validArticleAliases('2016-01-06-festa'), []);
  assert.deepEqual(validArticleAliases(['2016-01-06-festa', null, '../', '2016-01-06-festa']), ['2016-01-06-festa']);
});

test('una correzione di data conserva il vecchio indirizzo con un rimando diretto', () => {
  assert.deepEqual(articleStaticPaths([{ slug: '2016-01-06-befana', legacyArticleSlugs: ['2026-11-19-befana'] }]), [
    { params: { slug: '2016-01-06-befana' } },
    { params: { slug: '2026-11-19-befana' }, props: { articleSlug: '2016-01-06-befana' } },
  ]);
  assert.deepEqual(articleStaticPaths([]), []);
  assert.deepEqual(articleStaticPaths([{ slug: '2016-01-06-befana' }]), [{ params: { slug: '2016-01-06-befana' } }]);
});

test('il ripristino dell’indirizzo canonico prevale sull’alias e i conflitti non sono silenziosi', () => {
  const articles = [{ slug: '2016-01-06-festa', legacyArticleSlugs: ['2026-11-19-festa'] }, { slug: '2026-11-19-festa' }];
  assert.equal(articleStaticPaths(articles).length, 2);
  assert.throws(() => articleStaticPaths([{ slug: '2016-01-06-festa' }, { slug: '2016-01-06-festa' }]), /canonico duplicato/);
  assert.throws(() => articleStaticPaths([{ slug: '2016-01-06-festa', legacyArticleSlugs: ['2026-11-19-festa'] }, { slug: '2017-01-06-festa', legacyArticleSlugs: ['2026-11-19-festa'] }]), /più destinazioni/);
});

test('il provider trasporta gli alias validi senza perdere il rimando evento già esistente', () => {
  const base = { _id: 'article', title: 'Befana', slug: 'befana', summary: null, imageUrl: null, publishedAt: '2016-01-06T09:00:00Z', legacyEventSlug: 'vecchia-befana' };
  assert.deepEqual(toArticleSummary({ ...base, legacyArticleSlugs: ['2026-11-19-befana', 'javascript:alert(1)'] }).legacyArticleSlugs, ['2026-11-19-befana']);
  assert.equal(toArticleSummary(base).legacyEventSlug, 'vecchia-befana');
  assert.equal('legacyArticleSlugs' in toArticleSummary(base), false);
});


test('i ricordi privi di data non ereditano la data di importazione nell’indirizzo', () => {
  const base = { _id: 'a', title: 'Befana', slug: 'befana', publishedAt: '2026-11-19T12:00:00Z', summary: null, imageUrl: null };
  assert.equal(toArticleSummary({ ...base, historicalUndated: true }).slug, 'befana');
  assert.equal(toArticleSummary({ ...base, historicalUndated: true }).historicalUndated, true);
  for (const historicalUndated of [undefined, false, null, 'true', 1]) {
    const mapped = toArticleSummary({ ...base, historicalUndated });
    assert.equal(mapped.slug, '2026-11-19-befana');
    assert.equal('historicalUndated' in mapped, false);
  }
});
