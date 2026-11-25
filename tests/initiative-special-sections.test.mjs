import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, evaluate } from 'groq-js';
import { SPECIAL_SECTION_TYPES, requiredSpecialSectionText } from '../shared/initiativeSpecialSections.ts';
import { createSpecialSectionsState, specialSectionsEditorKey } from '../studio/structure/initiativeSpecialSectionsState.ts';
import { toInitiativeSpecialSections } from '../src/content/providers/initiativeSpecialSections.ts';
import { createSanityRepository } from '../src/content/providers/sanity.ts';
import { initiativeBySlugQuery } from '../src/content/providers/sanityQueries.ts';

const body = (text) => [{ _type: 'block', style: 'normal', markDefs: [], children: [{ _type: 'span', text, marks: [] }] }];
const logoUrl = 'https://cdn.sanity.io/images/test/production/logo.svg';
const documentUrl = 'https://cdn.sanity.io/files/test/production/informativa.pdf';

const specialSections = [
  { _type: 'initiativeInstitutionalSection', title: ' Comunicazione ', period: ' Anno 2026 ', body: body('Testo istituzionale') },
  { _type: 'initiativeLogosSection', title: 'Loghi', logos: [{ imageUrl: logoUrl, alt: 'Logo ufficiale', url: 'https://example.org/programma' }, { imageUrl: logoUrl, alt: 'Altro logo' }] },
  { _type: 'initiativeDocumentsSection', title: 'Documenti', documents: [{ title: 'Informativa', description: ' Per i destinatari ', url: documentUrl }] },
  { _type: 'initiativeTextSection', title: 'Approfondimento', body: body('Testo divulgativo') },
  { _type: 'initiativeFactsSection', title: 'Risultati', facts: [{ label: 'Percorsi', value: '12', unit: ' incontri ' }] },
];

test('le sezioni sono facoltative e nessun indicatore è imposto alle iniziative', () => {
  assert.equal(SPECIAL_SECTION_TYPES.length, 5);
  for (const value of [undefined, null, {}, false, 42, '', []]) assert.deepEqual(toInitiativeSpecialSections(value), []);
  for (const value of [null, undefined, '', ' ', 12, {}]) assert.equal(typeof requiredSpecialSectionText(value), 'string');
  assert.equal(requiredSpecialSectionText(' Titolo '), true);
});

test('mantiene ordine, tipi, periodo e contenuti senza modificare i dati originali', () => {
  const original = structuredClone(specialSections);
  const sections = toInitiativeSpecialSections(specialSections);
  assert.deepEqual(sections.map(({ kind }) => kind), ['institutional', 'logos', 'documents', 'text', 'facts']);
  assert.equal(sections[0].title, 'Comunicazione');
  assert.equal(sections[0].period, 'Anno 2026');
  assert.equal(sections[0].bodyHtml, '<p>Testo istituzionale</p>');
  assert.deepEqual(sections[2].documents, [{ title: 'Informativa', url: documentUrl, description: 'Per i destinatari' }]);
  assert.deepEqual(sections[4].facts, [{ label: 'Percorsi', value: '12', unit: 'incontri' }]);
  assert.equal(new Set(sections.map(({ id }) => id)).size, sections.length);
  assert.deepEqual(specialSections, original);
  assert.deepEqual(toInitiativeSpecialSections([...specialSections].reverse()).map(({ title }) => title), sections.map(({ title }) => title).reverse());
});

test('scarta tipi sconosciuti, sezioni vuote ed elementi corrotti senza perdere quelli validi', () => {
  const invalid = [null, [], 42, 'testo', {}, { title: 'Sconosciuto', _type: 'other' },
    { ...specialSections[0], title: ' ' }, { ...specialSections[0], body: null },
    { ...specialSections[0], body: body('') }, { ...specialSections[0], body: [{ _type: '' }] },
    ...[[{ _type: 'block', children: 1 }], [{ _type: 'block', children: [null] }],
      [{ _type: 'block', children: [{ _type: 'span', text: 17 }] }],
      [{ _type: 'block', children: [{ _type: 'span', text: 'test', marks: [42] }] }],
      [{ ...body('test')[0], markDefs: [null] }]].map((body) => ({ ...specialSections[0], body })),
    { ...specialSections[1], logos: {} }, { ...specialSections[1], logos: [null, [], {}, { imageUrl: logoUrl, alt: ' ' }] },
    { ...specialSections[2], documents: null }, { ...specialSections[2], documents: [{ title: '', url: documentUrl }] },
    { ...specialSections[4], facts: '12' }, { ...specialSections[4], facts: [null, {}, { label: 'Dato', value: 0 }] }];
  assert.deepEqual(toInitiativeSpecialSections(invalid), []);
  const result = toInitiativeSpecialSections([...invalid, ...specialSections]);
  assert.equal(result.length, 5);
  assert.equal(result[0].id, `iniziativa-sezione-${invalid.length + 1}`);
});

test('filtra URL pericolosi, documenti non PDF e immagini prive di descrizione', () => {
  for (const url of ['javascript:alert(1)', 'http://example.org', 'https://user:password@example.org', 'https://evil.example/logo.svg', 123, null]) {
    assert.deepEqual(toInitiativeSpecialSections([{ ...specialSections[1], logos: [{ imageUrl: url, alt: 'Logo' }] }]), []);
    assert.deepEqual(toInitiativeSpecialSections([{ ...specialSections[2], documents: [{ title: 'File', url }] }]), []);
  }
  assert.deepEqual(toInitiativeSpecialSections([{ ...specialSections[2], documents: [{ title: 'File', url: logoUrl }] }]), []);
  const [logos] = toInitiativeSpecialSections([{ ...specialSections[1], logos: [{ imageUrl: logoUrl, alt: 'Logo', url: 'javascript:alert(1)' }] }]);
  assert.equal(logos.logos[0].url, undefined);
  const [facts] = toInitiativeSpecialSections([{ ...specialSections[4], facts: [{ label: ' Valore ', value: '0', unit: 42 }] }]);
  assert.deepEqual(facts.facts, [{ label: 'Valore', value: '0', unit: undefined }]);
  const [section] = toInitiativeSpecialSections([{ ...specialSections[0], body: body('<script>alert(1)</script>') }]);
  assert.ok(!section.bodyHtml.includes('<script>'));
  const linkedBody = body('Collegamento');
  linkedBody[0].children[0].marks = ['unsafe'];
  linkedBody[0].markDefs = [{ _type: 'link', _key: 'unsafe', href: 'javascript:alert(1)' }];
  const linkedHtml = toInitiativeSpecialSections([{ ...specialSections[0], body: linkedBody }])[0].bodyHtml;
  assert.doesNotMatch(linkedHtml, /href|javascript:/);
  assert.match(linkedHtml, /Collegamento/);
  const plainBody = body('Senza decorazioni');
  delete plainBody[0].markDefs;
  delete plainBody[0].children[0].marks;
  assert.equal(toInitiativeSpecialSections([{ ...specialSections[0], body: plainBody }])[0].bodyHtml, '<p>Senza decorazioni</p>');
});

test('la query proietta soltanto i contenuti pubblici previsti e il provider li restituisce', async () => {
  const dataset = [
    { _id: 'image-1', _type: 'sanity.imageAsset', url: logoUrl },
    { _id: 'file-1', _type: 'sanity.fileAsset', url: documentUrl },
    { _id: 'initiative-1', _type: 'initiative', name: 'Iniziativa', slug: { current: 'iniziativa' }, area: 'volunteering', active: true,
      specialSections: [
        specialSections[0],
        { ...specialSections[1], logos: [{ alt: 'Logo ufficiale', image: { asset: { _ref: 'image-1' } } }] },
        { ...specialSections[2], documents: [{ title: 'PDF', file: { asset: { _ref: 'file-1' } }, privateNotes: 'NON PUBBLICARE' }] },
      ], privateNotes: 'NON PUBBLICARE' },
  ];
  const queryResult = await (await evaluate(parse(initiativeBySlugQuery), { dataset, params: { slug: 'iniziativa' } })).get();
  assert.equal(queryResult.specialSections[1].logos[0].imageUrl, logoUrl);
  assert.equal(queryResult.specialSections[2].documents[0].url, documentUrl);
  assert.ok(!JSON.stringify(queryResult).includes('NON PUBBLICARE'));
  const repository = createSanityRepository({ projectId: 'test123', dataset: 'production' }, {
    client: { fetch: async (query) => query === initiativeBySlugQuery ? queryResult : [] },
  });
  assert.equal((await repository.getInitiativeBySlug('iniziativa')).specialSections.length, 3);
  queryResult.specialSections = 'corrotto';
  assert.deepEqual((await repository.getInitiativeBySlug('iniziativa')).specialSections, []);
  delete queryResult.specialSections;
  assert.deepEqual((await repository.getInitiativeBySlug('iniziativa')).specialSections, []);
});

test('aprire e chiudere la configurazione è locale, isolato per documento e non modifica contenuti', () => {
  const store = createSpecialSectionsState();
  const key = specialSectionsEditorKey('project', 'production', 'drafts.iniziativa');
  assert.equal(key, specialSectionsEditorKey('project', 'production', 'iniziativa'));
  const other = specialSectionsEditorKey('project', 'test', 'iniziativa');
  assert.notEqual(key, other);
  let notifications = 0;
  const unsubscribe = store.subscribe(key, () => notifications++);
  const unsubscribeSecond = store.subscribe(key, () => notifications++);
  assert.equal(store.isOpen(key), false);
  store.setOpen(key, false);
  assert.equal(notifications, 0);
  store.setOpen(key, true);
  assert.equal(notifications, 2);
  assert.equal(store.isOpen(other), false);
  store.setOpen(key, true);
  assert.equal(notifications, 2);
  unsubscribeSecond();
  assert.equal(store.isOpen(key), true);
  store.setOpen(key, false);
  assert.equal(notifications, 3);
  store.setOpen(key, true);
  unsubscribe();
  assert.equal(store.isOpen(key), false);
  store.setOpen(other, true);
  store.setOpen(other, false);
});
