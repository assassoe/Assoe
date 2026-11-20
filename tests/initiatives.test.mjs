import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, parse } from 'groq-js';
import { groupInitiatives, initiativeNavigationPath, initiativeSections } from '../src/utils/initiatives.ts';
import { createSanityRepository } from '../src/content/providers/sanity.ts';
import { articleByIdQuery, eventBySlugQuery } from '../src/content/providers/sanityQueries.ts';

const initiative = (id, area) => ({
  _id: id, _type: 'initiative', name: id, area, slug: { current: id }, active: true,
  image: null, description: null,
});
const records = [
  initiative('banco', 'volunteering'), initiative('natale', 'social'),
  initiative('convenzioni', 'volunteering'), initiative('premio', 'social'),
];
const client = (dataset) => ({
  async fetch(query, params = {}) {
    return (await evaluate(parse(query), { dataset, params })).get();
  },
});
const repository = (dataset, options = {}) => createSanityRepository(
  { projectId: 'test123', dataset: 'production' }, { client: client(dataset), ...options },
);

test('il menu mantiene attiva la voce del proprio ambito, anche con la base GitHub Pages', () => {
  for (const base of ['/', '/Assoe/']) {
    for (const { path } of initiativeSections) {
      const prefix = base === '/' ? '' : '/Assoe';
      assert.equal(initiativeNavigationPath(`${prefix}${path}`, base), `${prefix}${path}`);
      assert.equal(initiativeNavigationPath(`${prefix}${path}pagina/2/`, base), `${prefix}${path}`);
      const activePath = initiativeNavigationPath(`${prefix}${path}pagina/2/`, base);
      assert.equal(initiativeSections.filter((section) => activePath.startsWith(`${prefix}${section.path}`)).length, 1);
    }
  }
  assert.equal(initiativeNavigationPath('/volontariato/'), '/volontariato/');
  for (const pathname of ['/', '/iniziative/', '/iniziative/premio/', '/articoli/', '/volontariato-extra/', '/iniziative-sociali-extra/']) {
    assert.equal(initiativeNavigationPath(pathname, '/'), pathname);
  }
  assert.equal(initiativeNavigationPath('/volontariato/', '/Assoe/'), '/volontariato/');
});

test('i gruppi pubblici hanno due percorsi distinti e mantengono ordine e identità delle iniziative', () => {
  const summaries = records.map(({ _id, name, area, slug }) => ({ id: _id, name, area, slug: slug.current }));
  const snapshot = structuredClone(summaries);
  const groups = groupInitiatives(summaries);
  assert.deepEqual(groups.map(({ path }) => path), ['/iniziative-sociali/', '/volontariato/']);
  assert.deepEqual(groups.map(({ initiatives }) => initiatives.map(({ id }) => id)), [['natale', 'premio'], ['banco', 'convenzioni']]);
  assert.deepEqual(summaries, snapshot);
  assert.equal(groups[0].initiatives[0], summaries[1]);
  assert.deepEqual(initiativeSections.map(({ value }) => value), ['social', 'volunteering']);
});

test('entrambi gli ambiti rimangono navigabili anche quando non contengono iniziative', () => {
  for (const group of groupInitiatives([])) {
    assert.deepEqual(group.initiatives, []);
    assert.ok(group.title && group.description && group.emptyMessage && group.path);
  }
  const groups = groupInitiatives([{ id: 'solo', name: 'Solo', slug: 'solo', area: 'social' }]);
  assert.equal(groups[0].initiatives.length, 1);
  assert.equal(groups[1].initiatives.length, 0);
  assert.deepEqual(groupInitiatives([{ id: 'errato', area: 'unknown' }]).map(({ initiatives }) => initiatives), [[], []]);
});

test('le query reali portano l’ambito dal CMS a elenchi, dettagli e riferimenti correlati', async () => {
  const article = {
    _id: 'article', _type: 'article', title: 'Articolo', slug: { current: 'articolo' },
    publishedAt: '2026-10-20T12:00:00Z', initiatives: records.map(({ _id }) => ({ _type: 'reference', _ref: _id })),
  };
  const event = {
    _id: 'event', _type: 'event', title: 'Evento', slug: { current: 'evento' },
    date: '2026-10-20T12:00:00Z', status: 'scheduled', initiatives: article.initiatives,
  };
  const repo = repository([...records, article, event, initiative('inattiva', 'social')].map((record) => (
    record._id === 'inattiva' ? { ...record, active: false } : record
  )));
  const summaries = await repo.listInitiatives();
  assert.equal(summaries.length, 4);
  assert.deepEqual(summaries.map(({ id, area }) => [id, area]), [
    ['banco', 'volunteering'], ['convenzioni', 'volunteering'], ['natale', 'social'], ['premio', 'social'],
  ]);
  assert.equal((await repo.getInitiativeBySlug('premio')).area, 'social');
  assert.equal((await repo.getInitiativeBySlug('inattiva')), null);
  for (const detail of [await repo.getArticleBySlug('2026-10-20-articolo'), await repo.getEventBySlug('evento')]) {
    assert.deepEqual(detail.relatedInitiatives.map(({ area }) => area), records.map(({ area }) => area));
  }
  // Le proiezioni dei riferimenti conservano l'ambito anche senza passare dai mapper.
  for (const [query, params] of [[articleByIdQuery, { id: 'article' }], [eventBySlugQuery, { slug: 'evento' }]]) {
    const projected = await client([...records, article, event]).fetch(query, params);
    assert.deepEqual(projected.initiatives.map(({ area }) => area), records.map(({ area }) => area));
  }
});

test('uno spostamento in Sanity cambia gruppo e riferimenti senza cambiare URL né contenuti collegati', async () => {
  const dataset = [initiative('premio', 'social'), {
    _id: 'storia', _type: 'article', title: 'Storia del premio', slug: { current: 'storia' },
    publishedAt: '2026-10-20T12:00:00Z', initiatives: [{ _type: 'reference', _ref: 'premio' }],
  }, {
    _id: 'evento', _type: 'event', title: 'Il premio', slug: { current: 'premio' },
    date: '2026-10-20T12:00:00Z', status: 'scheduled', initiatives: [{ _type: 'reference', _ref: 'premio' }],
  }];
  const repo = repository(dataset, { development: true });
  const before = await repo.getInitiativeBySlug('premio');
  assert.deepEqual(before.relatedArticles.map(({ id }) => id), ['storia']);
  assert.deepEqual(before.relatedEvents.map(({ id }) => id), ['evento']);
  dataset[0].area = 'volunteering';
  const groups = groupInitiatives(await repo.listInitiatives());
  assert.deepEqual(groups.map(({ initiatives }) => initiatives.map(({ slug }) => slug)), [[], ['premio']]);
  const after = await repo.getInitiativeBySlug('premio');
  assert.deepEqual(after, { ...before, area: 'volunteering' });
  for (const detail of [await repo.getArticleBySlug('2026-10-20-storia'), await repo.getEventBySlug('premio')]) {
    assert.deepEqual(detail.relatedInitiatives.map(({ id, area }) => ({ id, area })), [{ id: 'premio', area: 'volunteering' }]);
  }
});

test('documenti con ambito assente o invalido non vengono assegnati automaticamente a un gruppo', async () => {
  for (const area of [undefined, null, '', 'unknown', 42]) {
    const repo = repository([initiative('errata', area)]);
    assert.deepEqual(await repo.listInitiatives(), []);
    assert.equal(await repo.getInitiativeBySlug('errata'), null);
  }
});

test('riordinare un ambito mantiene invariato l’ordine dell’altro, anche dopo uno spostamento', async () => {
  const dataset = records.map((record, index) => ({ ...record, orderRank: `0|${index + 1}00000:` }));
  const repo = repository(dataset, { development: true });
  const before = groupInitiatives(await repo.listInitiatives());
  dataset.find(({ _id }) => _id === 'premio').orderRank = '0|150000:';
  const reordered = groupInitiatives(await repo.listInitiatives());
  assert.deepEqual(reordered[0].initiatives.map(({ id }) => id), ['premio', 'natale']);
  assert.deepEqual(reordered[1], before[1]);

  const moved = dataset.find(({ _id }) => _id === 'premio');
  moved.area = 'volunteering';
  const afterMove = groupInitiatives(await repo.listInitiatives());
  assert.deepEqual(afterMove[0].initiatives.map(({ id }) => id), ['natale']);
  moved.orderRank = '0|500000:';
  const afterReorder = groupInitiatives(await repo.listInitiatives());
  assert.deepEqual(afterReorder[0], afterMove[0]);
  assert.deepEqual(afterReorder[1].initiatives.map(({ id }) => id), ['banco', 'convenzioni', 'premio']);
  assert.equal((await repo.getInitiativeBySlug('premio')).slug, 'premio');
});

test('la query dell’evento trova soltanto gli articoli che raccontano quell’appuntamento', async () => {
  const dataset = [
    { _id: 'evento', _type: 'event', title: 'Evento', slug: { current: 'evento' }, date: '2026-10-20T12:00:00Z', status: 'completed' },
    { _id: 'altro', _type: 'event', title: 'Altro', slug: { current: 'altro' }, date: '2026-10-19T12:00:00Z', status: 'completed' },
    ...[
      ['primo', 'evento', '2026-10-20T15:00:00Z'],
      ['secondo', 'evento', '2026-10-21T15:00:00Z'],
      ['estraneo', 'altro', '2026-10-22T15:00:00Z'],
      ['senza-evento', null, '2026-10-23T15:00:00Z'],
    ].map(([id, eventId, date]) => ({
      _id: id, _type: 'article', title: id, slug: { current: id }, publishedAt: date,
      ...(eventId ? { event: { _type: 'reference', _ref: eventId } } : {}),
    })),
    { _id: 'incompleto', _type: 'article', event: { _type: 'reference', _ref: 'evento' } },
  ];
  const repo = repository(dataset);
  const detail = await repo.getEventBySlug('evento');
  assert.deepEqual(detail.relatedArticles.map(({ id, slug }) => [id, slug]), [
    ['secondo', '2026-10-21-secondo'], ['primo', '2026-10-20-primo'],
  ]);
  assert.equal((await repo.getArticleBySlug('2026-10-20-primo')).relatedEvent.id, 'evento');
  assert.deepEqual((await repository(dataset.slice(0, 2)).getEventBySlug('evento')).relatedArticles, []);
});
