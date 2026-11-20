import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, parse } from 'groq-js';
import { articlesQuery, articlesByInitiativeQuery, eventBySlugQuery } from '../src/content/providers/sanityQueries.ts';

test('le notizie datate precedono i ricordi senza data in tutti gli elenchi', async () => {
  const records = [
    { _id: 'undated', publishedAt: '2026-11-19T12:00:00Z', historicalUndated: true },
    { _id: 'old', publishedAt: '2011-01-06T10:00:00Z' },
    { _id: 'new', publishedAt: '2026-01-06T10:00:00Z', historicalUndated: false },
  ].map(d => ({ ...d, _type: 'article', title: d._id, slug: { current: d._id }, initiatives: [{ _ref: 'initiative' }], event: { _ref: 'event' } }));
  const dataset = [...records, { _id: 'event', _type: 'event', title: 'Evento', slug: { current: 'evento' }, date: '2011-01-06T10:00:00Z', status: 'completed' }];
  for (const query of [articlesQuery, articlesByInitiativeQuery]) {
    const result = await (await evaluate(parse(query), { dataset, params: { initiativeId: 'initiative' } })).get();
    assert.deepEqual(result.map(d => d._id), ['new', 'old', 'undated']);
    assert.equal(result[2].historicalUndated, true);
  }
  const event = await (await evaluate(parse(eventBySlugQuery), { dataset, params: { slug: 'evento' } })).get();
  assert.deepEqual(event.articles.map(d => d._id), ['new', 'old', 'undated']);
});
