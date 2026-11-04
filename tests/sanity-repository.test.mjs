import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { createSanityRepository } from '../src/content/providers/sanity.ts';
import * as queries from '../src/content/providers/sanityQueries.ts';

const config = { projectId: 'test123', dataset: 'production' };
const initiative = { _id: 'initiative-1', name: 'Iniziativa', slug: 'iniziativa', area: 'social', image: null };
const article = {
  _id: 'article-1', title: 'Articolo', slug: 'articolo',
  publishedAt: '2026-10-20T12:00:00Z', summary: null, imageUrl: null,
};
const event = {
  _id: 'event-1', title: 'Evento', slug: 'evento', date: '2026-10-21T12:00:00Z',
  place: null, status: 'scheduled', imageUrl: null,
};
const person = { _id: 'person-1', firstName: 'Mario', lastName: 'Rossi', role: 'president', photoUrl: null };
const related = [{ ...initiative, active: true }, { ...initiative, _id: 'inactive', active: false }, null];
const gallery = ['https://cdn.sanity.io/foto.jpg', 'https://evil.example/foto.jpg', null];
const body = [{ _type: 'block', children: [{ _type: 'span', text: 'Testo', marks: [] }], markDefs: [], style: 'normal' }];
const articleDetail = {
  ...article, body, galleryImageUrls: gallery,
  facebookPostUrl: 'https://www.facebook.com/assoe/posts/123', initiatives: related, event,
};
const eventDetail = { ...event, description: body, galleryImageUrls: gallery, facebookPostUrl: null, initiatives: related };

function setup(responses, options = {}) {
  const fetch = mock.fn(async (query, params) => {
    assert.ok(Object.hasOwn(responses, query), 'query non prevista');
    const result = responses[query];
    return typeof result === 'function' ? result(params) : result;
  });
  return { fetch, repository: createSanityRepository(config, { client: { fetch }, ...options }) };
}

test('il repository si costruisce anche con il client Sanity predefinito', () => {
  const repository = createSanityRepository(config);
  assert.equal(typeof repository.listArticles, 'function');
});

test('le sezioni della homepage seguono l’ordine pubblicato e completano i dati mancanti', async () => {
  const { repository } = setup({
    [queries.homeSectionOrderQuery]: [{ section: 'articles' }, { section: 'notices' }, { section: 'articles' }, null],
  });
  assert.deepEqual(await repository.listHomeSections(), ['articles', 'notices', 'event', 'social', 'volunteering', 'support']);
  const missing = setup({ [queries.homeSectionOrderQuery]: null });
  assert.deepEqual(await missing.repository.listHomeSections(), ['notices', 'event', 'social', 'volunteering', 'articles', 'support']);
});

test('la build condivide l’ordine delle sezioni mentre lo sviluppo legge ogni aggiornamento', async () => {
  let current = [{ section: 'support' }];
  const responses = { [queries.homeSectionOrderQuery]: () => current };
  const { repository, fetch } = setup(responses);
  const first = repository.listHomeSections();
  assert.equal(repository.listHomeSections(), first);
  assert.equal((await first)[0], 'support');
  assert.equal(fetch.mock.callCount(), 1);
  const dev = setup(responses, { development: true });
  assert.equal((await dev.repository.listHomeSections())[0], 'support');
  current = [{ section: 'articles' }];
  assert.equal((await dev.repository.listHomeSections())[0], 'articles');
  assert.equal(dev.fetch.mock.callCount(), 2);
});

test('un errore nella lettura dell’ordine non viene nascosto e consente un nuovo tentativo', async () => {
  let fail = true;
  const error = new Error('Sanity non disponibile');
  const { repository } = setup({ [queries.homeSectionOrderQuery]: () => {
    if (fail) throw error;
    return [{ section: 'event' }];
  } });
  await assert.rejects(repository.listHomeSections(), (received) => received === error);
  fail = false;
  assert.equal((await repository.listHomeSections())[0], 'event');
});

test('gli elenchi scartano record corrotti e restituiscono slug pubblici e foto sicure', async () => {
  const { repository } = setup({
    [queries.initiativesQuery]: [initiative, null, { ...initiative, slug: 'Non valido' }],
    [queries.articlesQuery]: [article, {}, null],
    [queries.eventsQuery]: [event, { ...event, status: 'unknown' }],
    [queries.peopleQuery]: [person, { ...person, _id: 'p2', photoUrl: 'https://cdn.sanity.io/foto.jpg' },
      { ...person, _id: 'p3', photoUrl: 'https://evil.example/foto.jpg' }, { ...person, role: 'unknown' }],
  });
  assert.deepEqual((await repository.listInitiatives()).map((item) => item.slug), ['iniziativa']);
  assert.deepEqual((await repository.listArticles()).map((item) => item.slug), ['2026-10-20-articolo']);
  assert.deepEqual((await repository.listEvents()).map((item) => item.slug), ['evento']);
  assert.deepEqual(await repository.listPeople(), [
    { id: 'person-1', firstName: 'Mario', lastName: 'Rossi', role: 'president', photoUrl: undefined },
    { id: 'p2', firstName: 'Mario', lastName: 'Rossi', role: 'president', photoUrl: 'https://cdn.sanity.io/foto.jpg' },
    { id: 'p3', firstName: 'Mario', lastName: 'Rossi', role: 'president', photoUrl: undefined },
  ]);
});

test('risposte assenti o non costituite da elenchi restituiscono elenchi vuoti', async () => {
  for (const value of [null, {}, 'non valido', []]) {
    const { repository } = setup({
      [queries.initiativesQuery]: value, [queries.articlesQuery]: value,
      [queries.eventsQuery]: value, [queries.peopleQuery]: value, [queries.homeNoticesQuery]: value,
    });
    for (const method of ['listInitiatives', 'listArticles', 'listEvents', 'listPeople', 'listHomeNotices']) {
      assert.deepEqual(await repository[method](), []);
    }
  }
});

test('blocca slug duplicati negli elenchi dei contenuti', async () => {
  for (const [method, query, record] of [
    ['listInitiatives', queries.initiativesQuery, initiative],
    ['listArticles', queries.articlesQuery, article],
    ['listEvents', queries.eventsQuery, event],
  ]) {
    const { repository } = setup({ [query]: [record, { ...record, _id: 'duplicate' }] });
    await assert.rejects(repository[method](), /duplicat/i);
  }
});

test('legge avvisi e informazioni associative applicando validazione e mapping', async () => {
  const { repository } = setup({
    [queries.homeNoticesQuery]: [{ _key: 'notice-1', title: ' Avviso ', text: ' Testo ' }, null],
    [queries.associationQuery]: { associationName: ' Associazione ', shortDescription: ' Descrizione ' },
  });
  assert.deepEqual(await repository.listHomeNotices(), [{ id: 'notice-1', title: 'Avviso', text: 'Testo' }]);
  const association = await repository.getAssociationInfo();
  assert.equal(association.name, 'Associazione');
  assert.equal(association.shortDescription, 'Descrizione');
  for (const value of [null, {}, { associationName: ' ' }]) {
    assert.equal(await setup({ [queries.associationQuery]: value }).repository.getAssociationInfo(), null);
  }
});

test('il dettaglio iniziativa interroga i contenuti correlati con l’ID e scarta quelli invalidi', async () => {
  const { repository, fetch } = setup({
    [queries.initiativeBySlugQuery]: { ...initiative, description: body },
    [queries.articlesByInitiativeQuery]: [article, null],
    [queries.eventsByInitiativeQuery]: [event, {}],
  });
  const result = await repository.getInitiativeBySlug('iniziativa');
  assert.equal(result.id, 'initiative-1');
  assert.equal(result.descriptionHtml, '<p>Testo</p>');
  assert.deepEqual(result.relatedArticles.map((item) => item.slug), ['2026-10-20-articolo']);
  assert.deepEqual(result.relatedEvents.map((item) => item.slug), ['evento']);
  assert.deepEqual(fetch.mock.calls.map((call) => call.arguments[1]), [
    { slug: 'iniziativa' }, { initiativeId: 'initiative-1' }, { initiativeId: 'initiative-1' },
  ]);
});

test('il dettaglio iniziativa gestisce correlazioni assenti e documenti non validi', async () => {
  const { repository } = setup({
    [queries.initiativeBySlugQuery]: { ...initiative, description: null },
    [queries.articlesByInitiativeQuery]: null, [queries.eventsByInitiativeQuery]: {},
  });
  const result = await repository.getInitiativeBySlug('iniziativa');
  assert.deepEqual(result.relatedArticles, []);
  assert.deepEqual(result.relatedEvents, []);
  const missing = setup({ [queries.initiativeBySlugQuery]: null });
  assert.equal(await missing.repository.getInitiativeBySlug('mancante'), null);
  assert.equal(missing.fetch.mock.callCount(), 1);
});

test('il dettaglio articolo usa lo slug pubblico per trovare l’ID e filtra i collegamenti', async () => {
  const { repository, fetch } = setup({ [queries.articlesQuery]: [article], [queries.articleByIdQuery]: articleDetail });
  const result = await repository.getArticleBySlug('2026-10-20-articolo');
  assert.equal(result.id, 'article-1');
  assert.equal(result.bodyHtml, '<p>Testo</p>');
  assert.equal(result.discussionUrl, articleDetail.facebookPostUrl);
  assert.deepEqual(result.galleryImageUrls, ['https://cdn.sanity.io/foto.jpg']);
  assert.deepEqual(result.relatedInitiatives.map((item) => item.id), ['initiative-1']);
  assert.equal(result.relatedEvent.id, 'event-1');
  assert.deepEqual(fetch.mock.calls[1].arguments, [queries.articleByIdQuery, { id: 'article-1' }]);
});

test('un articolo senza evento correlato resta leggibile', async () => {
  const { repository } = setup({
    [queries.articlesQuery]: [article], [queries.articleByIdQuery]: { ...articleDetail, event: null },
  });
  assert.equal((await repository.getArticleBySlug('2026-10-20-articolo')).relatedEvent, undefined);
});

test('rifiuta articoli mancanti, dettagli corrotti e slug cambiati tra elenco e dettaglio', async () => {
  const missing = setup({ [queries.articlesQuery]: [article] });
  assert.equal(await missing.repository.getArticleBySlug('mancante'), null);
  assert.equal(missing.fetch.mock.callCount(), 1);
  for (const value of [null, { ...articleDetail, body: 42 },
    { ...articleDetail, slug: 'cambiato' }, { ...articleDetail, publishedAt: '2026-10-21T12:00:00Z' }]) {
    const { repository } = setup({ [queries.articlesQuery]: [article], [queries.articleByIdQuery]: value });
    assert.equal(await repository.getArticleBySlug('2026-10-20-articolo'), null);
  }
});

test('il dettaglio evento espone contenuti sicuri e non accetta documenti invalidi', async () => {
  const { repository, fetch } = setup({ [queries.eventBySlugQuery]: eventDetail });
  const result = await repository.getEventBySlug('evento');
  assert.equal(result.descriptionHtml, '<p>Testo</p>');
  assert.equal(result.discussionUrl, undefined);
  assert.deepEqual(result.galleryImageUrls, ['https://cdn.sanity.io/foto.jpg']);
  assert.deepEqual(result.relatedInitiatives.map((item) => item.id), ['initiative-1']);
  assert.deepEqual(fetch.mock.calls[0].arguments, [queries.eventBySlugQuery, { slug: 'evento' }]);
  assert.equal(await setup({ [queries.eventBySlugQuery]: null }).repository.getEventBySlug('mancante'), null);
});

test('durante la build le letture concorrenti condividono il risultato', async () => {
  const { repository, fetch } = setup({ [queries.articlesQuery]: [article] });
  const first = repository.listArticles();
  assert.equal(repository.listArticles(), first);
  await first;
  assert.equal(repository.listArticles(), first);
  assert.equal(fetch.mock.callCount(), 1);
});

test('in sviluppo ogni lettura riceve le modifiche del CMS', async () => {
  let current = [article];
  const { repository, fetch } = setup({ [queries.articlesQuery]: () => current }, { development: true });
  assert.equal((await repository.listArticles())[0].title, 'Articolo');
  current = [{ ...article, title: 'Aggiornato' }];
  assert.equal((await repository.listArticles())[0].title, 'Aggiornato');
  assert.equal(fetch.mock.callCount(), 2);
});

test('un errore Sanity viene propagato e non impedisce il tentativo successivo', async () => {
  let fail = true;
  const error = new Error('Rete assente');
  const { repository, fetch } = setup({ [queries.eventsQuery]: () => {
    if (fail) throw error;
    return [event];
  } });
  await assert.rejects(repository.listEvents(), (received) => received === error);
  fail = false;
  assert.equal((await repository.listEvents())[0].id, 'event-1');
  assert.equal(fetch.mock.callCount(), 2);
});
