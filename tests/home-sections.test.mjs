import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, evaluate } from 'groq-js';
import {
  HOME_SECTIONS,
  homeSectionOrderError,
  isHomeSectionId,
  resolveHomeSectionOrder,
} from '../shared/homeSections.ts';
import { homeSectionOrderQuery } from '../src/content/providers/sanityQueries.ts';

const defaults = ['notices', 'event', 'social', 'volunteering', 'articles', 'support'];
const items = (ids) => ids.map((section) => ({ _type: 'homeSection', _key: section, section }));

test('sono riordinabili solo le sei sezioni sotto la presentazione iniziale', () => {
  assert.deepEqual(HOME_SECTIONS.map(({ value }) => value), defaults);
  for (const id of defaults) assert.equal(isHomeSectionId(id), true);
  for (const id of ['hero', 'unknown', 'constructor', '', null, undefined, 1, {}]) {
    assert.equal(isHomeSectionId(id), false);
  }
});

test('documenti assenti, campi vuoti o corrotti mantengono l’ordine attuale', () => {
  for (const value of [undefined, null, [], {}, false, 42, 'articles', defaults]) {
    assert.deepEqual(resolveHomeSectionOrder(value), defaults);
  }
});

test('mantiene qualsiasi ordine editoriale completo senza modificare il dato originale', () => {
  const orders = [defaults.toReversed(), ...defaults.map((_, index) => [...defaults.slice(index), ...defaults.slice(0, index)])];
  for (const order of orders) {
    const value = Object.freeze(items(order).map(Object.freeze));
    assert.deepEqual(resolveHomeSectionOrder(value), order);
    assert.deepEqual(value, items(order));
    assert.equal(homeSectionOrderError(value), undefined);
  }
});

test('scarta elementi sconosciuti e duplicati e aggiunge in fondo le sezioni mancanti', () => {
  const value = [null, 1, false, 'social', {}, { section: 'hero' }, { section: 42 },
    ...items(['support', 'social', 'support', 'articles'])];
  assert.deepEqual(resolveHomeSectionOrder(value), ['support', 'social', 'articles', 'notices', 'event', 'volunteering']);
  assert.equal(resolveHomeSectionOrder(value).length, defaults.length);
});

test('lo Studio ammette il campo assente ma rifiuta sezioni mancanti, duplicate o invalide', () => {
  assert.equal(homeSectionOrderError(undefined), undefined);
  assert.equal(homeSectionOrderError(null), undefined);
  for (const value of [[], {}, 42, 'notices', items(defaults.slice(1)), items([...defaults, 'event']),
    items(['event', ...defaults.slice(1)]), items(['unknown', ...defaults.slice(1)]),
    [null, ...items(defaults.slice(1))], defaults]) {
    assert.match(homeSectionOrderError(value), /sei sezioni/);
  }
});

test('la query legge l’ordine senza modificare o confondere gli avvisi esistenti', async () => {
  const order = defaults.toReversed();
  const query = parse(homeSectionOrderQuery);
  const dataset = [{ _type: 'homeSettings', _id: 'home', sectionOrder: items(order), notices: [{ title: 'Avviso' }] }];
  const response = await (await evaluate(query, { dataset })).get();
  assert.deepEqual(resolveHomeSectionOrder(response), order);
  const missing = await (await evaluate(query, { dataset: [] })).get();
  assert.deepEqual(resolveHomeSectionOrder(missing), defaults);
  assert.deepEqual(dataset[0].notices, [{ title: 'Avviso' }]);
});
