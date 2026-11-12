import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, parse } from 'groq-js';
import { createEventsStructure, eventInitiativeTemplate } from '../studio/structure/events.ts';

function structureBuilder() {
  function builder(kind, initial = {}) {
    const spec = { kind, ...initial };
    const node = { spec };
    for (const method of ['id', 'title', 'schemaType', 'child', 'items', 'apiVersion', 'filter', 'params', 'defaultOrdering', 'initialValueTemplates', 'canHandleIntent']) {
      node[method] = (value) => { spec[method] = value; return node; };
    }
    return node;
  }
  return {
    listItem: () => builder('listItem'), list: () => builder('list'),
    documentTypeListItem: (schemaType) => builder('documentTypeListItem', { schemaType }),
    documentTypeList: (schemaType) => builder('documentTypeList', { schemaType }),
    initialValueTemplateItem: (templateId, parameters) => ({ templateId, parameters }),
  };
}

function panes() {
  const root = createEventsStructure(structureBuilder()).spec;
  const [all, byInitiative] = root.child.spec.items;
  return { root, all: all.spec, initiatives: byInitiative.spec.child.spec };
}

async function eventIds(initiativeId, dataset) {
  const list = panes().initiatives.child(initiativeId).spec;
  const result = await evaluate(parse(`*[${list.filter}] | order(date desc)._id`), { dataset, params: list.params });
  return result.get();
}

const reference = (_ref) => ({ _type: 'reference', _ref });
const event = (_id, initiatives, date = '2026-11-12T10:00:00Z', extra = {}) => ({
  _id, _type: 'event', date, initiatives: initiatives.map(reference), ...extra,
});

test('Eventi offre tutti gli eventi e una navigazione ricercabile per singola iniziativa', () => {
  const { root, all, initiatives } = panes();
  assert.equal(root.title, 'Eventi');
  assert.equal(all.schemaType, 'event');
  assert.equal(all.title, 'Tutti gli eventi');
  assert.equal(all.kind, 'documentTypeListItem');
  assert.equal(initiatives.kind, 'documentTypeList');
  assert.equal(initiatives.schemaType, 'initiative');
  assert.deepEqual(initiatives.defaultOrdering, [{ field: 'name', direction: 'asc' }]);
  // Questa lista naviga verso eventi: non deve intercettare l’apertura dell’editor delle iniziative.
  assert.equal(initiatives.canHandleIntent('edit', { type: 'initiative' }), false);
  assert.equal(initiatives.canHandleIntent('create', { type: 'initiative' }), false);
  assert.deepEqual(initiatives.initialValueTemplates, []);
});

test('il filtro considera solo i riferimenti alle iniziative, anche con più collegamenti', async () => {
  const dataset = [
    { _id: 'natale', _type: 'initiative', active: false },
    event('vecchio', ['natale'], '2020-12-25T10:00:00Z', { status: 'completed' }),
    event('nuovo', ['natale', 'premio'], '2027-12-25T10:00:00Z', { status: 'cancelled' }),
    event('altro', ['premio']), event('senza', []),
    { _id: 'assente', _type: 'event' },
    { _id: 'nullo', _type: 'event', initiatives: null },
    { _id: 'titolo', _type: 'event', title: 'natale', event: reference('natale') },
    { _id: 'articolo', _type: 'article', initiatives: [reference('natale')] },
  ];
  const snapshot = structuredClone(dataset);
  assert.deepEqual(await eventIds('natale', dataset), ['nuovo', 'vecchio']);
  assert.deepEqual(await eventIds('premio', dataset), ['nuovo', 'altro']);
  assert.deepEqual(await eventIds('inesistente', dataset), []);
  assert.deepEqual(await eventIds('natale', []), []);
  assert.deepEqual(dataset, snapshot);
});

test('creare un evento da un’iniziativa precompila un riferimento con chiave stabile', async () => {
  const { initiatives } = panes();
  assert.equal(eventInitiativeTemplate.schemaType, 'event');
  assert.deepEqual(eventInitiativeTemplate.parameters.map(({ name }) => name), ['initiativeId']);
  for (const id of ['natale', 'premio', 'drafts.natale']) {
    const list = initiatives.child(id).spec;
    assert.equal(list.kind, 'documentTypeList');
    assert.equal(list.schemaType, 'event');
    assert.deepEqual(list.defaultOrdering, [{ field: 'date', direction: 'desc' }]);
    assert.equal(list.initialValueTemplates.length, 1);
    const template = list.initialValueTemplates[0];
    assert.equal(template.templateId, eventInitiativeTemplate.id);
    assert.equal(template.parameters.initiativeId, id.replace(/^drafts\./, ''));
    const value = eventInitiativeTemplate.value(template.parameters);
    assert.deepEqual(value, {
      initiatives: [{ _key: 'initiative', _type: 'reference', _ref: list.params.initiativeId }],
    });
    const created = { _id: 'nuovo', _type: 'event', ...value };
    assert.deepEqual(await eventIds(id, [created]), ['nuovo']);
  }
  assert.equal(eventInitiativeTemplate.value({ initiativeId: 'drafts.natale' }).initiatives[0]._ref, 'natale');
});

test('modificare i collegamenti aggiorna le categorie senza duplicare l’evento', async () => {
  const original = event('stesso-evento', ['natale']);
  const moved = { ...original, initiatives: [reference('premio')] };
  assert.deepEqual(await eventIds('natale', [original]), ['stesso-evento']);
  assert.deepEqual(await eventIds('natale', [moved]), []);
  assert.deepEqual(await eventIds('premio', [moved]), ['stesso-evento']);
});
