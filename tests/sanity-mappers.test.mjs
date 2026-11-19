import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  renderRichText,
  safeSanityAssetUrls,
  toArticleSummary,
  toAssociationInfo,
  toEventSummary,
  toHomeNotices,
  toRelatedInitiatives,
} from '../src/content/providers/sanityMappers.ts';

const initiative = {
  _id: 'initiative-1',
  name: 'Iniziativa',
  slug: 'iniziativa',
  area: 'social',
  image: { url: 'https://cdn.sanity.io/image.jpg', width: 800, height: 600, crop: null },
  active: true,
};

test('gli avvisi mantengono l’ordine dello Studio e non superano tre elementi', () => {
  const notices = [
    { _key: 'second', title: ' Secondo ', text: ' Testo 2 ' },
    { _key: 'invalid', title: '  ', text: 'Da ignorare' },
    { _key: 'first', title: 'Primo', text: 'Testo 1' },
    { _key: 'third', title: 'Terzo', text: 'Testo 3' },
    { _key: 'fourth', title: 'Quarto', text: 'Testo 4' },
  ];

  assert.deepEqual(toHomeNotices(notices), [
    { id: 'second', title: 'Secondo', text: 'Testo 2' },
    { id: 'first', title: 'Primo', text: 'Testo 1' },
    { id: 'third', title: 'Terzo', text: 'Testo 3' },
  ]);
  assert.deepEqual(toHomeNotices(null), []);
  assert.deepEqual(toHomeNotices([]), []);
});

test('gli avvisi con scadenza restano visibili quel giorno e liberano posto il giorno dopo', () => {
  const notices = [
    { _key: 'expired', title: 'Scaduto', text: 'Passato', expiresOn: '2026-10-26' },
    { _key: 'today', title: 'Oggi', text: 'Ancora visibile', expiresOn: '2026-10-27' },
    { _key: 'invalid-date', title: 'Data errata', text: 'Scartato', expiresOn: '2026-02-30' },
    { _key: 'future', title: 'Domani', text: 'Futuro', expiresOn: '2026-10-28' },
    { _key: 'permanent', title: 'Senza scadenza', text: 'Sempre visibile', expiresOn: null },
  ];

  assert.deepEqual(toHomeNotices(notices, '2026-10-27'), [
    { id: 'today', title: 'Oggi', text: 'Ancora visibile', expiresOn: '2026-10-27' },
    { id: 'future', title: 'Domani', text: 'Futuro', expiresOn: '2026-10-28' },
    { id: 'permanent', title: 'Senza scadenza', text: 'Sempre visibile' },
  ]);
  assert.deepEqual(toHomeNotices(notices, '2026-10-29'), [
    { id: 'permanent', title: 'Senza scadenza', text: 'Sempre visibile' },
  ]);
});

test('gli avvisi espongono solo documenti Sanity e link HTTPS validi', () => {
  assert.deepEqual(toHomeNotices([
    { _key: 'safe', title: 'Avviso', text: '**Importante**', documentUrl: 'https://cdn.sanity.io/files/project/production/notice.pdf', linkUrl: 'https://example.org/approfondimento', linkLabel: ' Leggi il bando ' },
    { _key: 'unsafe', title: 'Avviso 2', text: 'Testo', documentUrl: 'https://evil.example/notice.pdf', linkUrl: 'javascript:alert(1)', linkLabel: 'Non mostrare' },
    { _key: 'without-label', title: 'Avviso 3', text: 'Testo', linkUrl: 'https://example.org/dettagli', linkLabel: '   ' },
  ], '2026-10-27'), [
    { id: 'safe', title: 'Avviso', text: '**Importante**', documentUrl: 'https://cdn.sanity.io/files/project/production/notice.pdf', linkUrl: 'https://example.org/approfondimento', linkLabel: 'Leggi il bando' },
    { id: 'unsafe', title: 'Avviso 2', text: 'Testo' },
    { id: 'without-label', title: 'Avviso 3', text: 'Testo', linkUrl: 'https://example.org/dettagli' },
  ]);
});

test('un’etichetta facoltativa non valida non nasconde l’avviso', () => {
  const linkUrl = 'https://example.org/dettagli';
  assert.deepEqual(toHomeNotices([
    { _key: 'too-long', title: 'Lungo', text: 'Testo', linkUrl, linkLabel: 'a'.repeat(81) },
    { _key: 'wrong-type', title: 'Tipo errato', text: 'Testo', linkUrl, linkLabel: 42 },
    { _key: 'without-url', title: 'Senza link', text: 'Testo', linkLabel: 'Leggi' },
  ], '2026-10-27'), [
    { id: 'too-long', title: 'Lungo', text: 'Testo', linkUrl },
    { id: 'wrong-type', title: 'Tipo errato', text: 'Testo', linkUrl },
    { id: 'without-url', title: 'Senza link', text: 'Testo' },
  ]);
});

test('mappa articoli ed eventi mantenendo solo URL immagine sicuri', () => {
  assert.deepEqual(toArticleSummary({
    _id: 'article-1',
    title: 'Articolo',
    slug: 'articolo',
    summary: null,
    publishedAt: '2026-10-20T12:00:00Z',
    imageUrl: 'https://evil.example/image.jpg',
  }), {
    id: 'article-1',
    title: 'Articolo',
    slug: '2026-10-20-articolo',
    summary: undefined,
    publishedAt: '2026-10-20T12:00:00Z',
    imageUrl: undefined,
  });

  assert.deepEqual(toEventSummary({
    _id: 'event-1',
    title: 'Evento',
    slug: 'evento',
    date: '2026-10-20T12:00:00Z',
    place: null,
    status: 'scheduled',
    imageUrl: 'https://cdn.sanity.io/event.jpg',
  }), {
    id: 'event-1',
    title: 'Evento',
    slug: 'evento',
    date: '2026-10-20T12:00:00Z',
    place: undefined,
    status: 'scheduled',
    imageUrl: 'https://cdn.sanity.io/event.jpg',
  });
});

test('scarta iniziative correlate inattive, nulle o corrotte', () => {
  assert.deepEqual(toRelatedInitiatives([
    initiative,
    { ...initiative, _id: 'inactive', active: false },
    { ...initiative, _id: 'invalid', active: true, slug: 'Slug non valido' },
    { ...initiative, _id: 'missing-area', area: undefined },
    null,
  ]), [{
    id: 'initiative-1',
    name: 'Iniziativa',
    slug: 'iniziativa',
    area: 'social',
    imageUrl: 'https://cdn.sanity.io/image.jpg',
  }]);
  assert.deepEqual(toRelatedInitiatives(null), []);
});

test('il titolo e il testo breve della home mantengono i contenuti Sanity senza testi sostitutivi', () => {
  const association = toAssociationInfo({
    associationName: '  Nome da Sanity ODV  ',
    shortDescription: '  Volontariato nella comunità.  ',
  });
  assert.equal(association.name, 'Nome da Sanity ODV');
  assert.equal(association.shortDescription, 'Volontariato nella comunità.');

  assert.equal(toAssociationInfo({ associationName: 'Nome da Sanity ODV' }).shortDescription, undefined);
  for (const shortDescription of [null, '', '   ']) {
    assert.equal(toAssociationInfo({ associationName: 'Nome da Sanity ODV', shortDescription }).shortDescription, undefined);
  }
});

test('normalizza galleria, rich text e impostazioni associative incomplete', () => {
  assert.deepEqual(safeSanityAssetUrls([
    'https://cdn.sanity.io/one.jpg',
    'https://evil.example/two.jpg',
    null,
  ]), ['https://cdn.sanity.io/one.jpg']);
  assert.deepEqual(safeSanityAssetUrls(null), []);
  assert.equal(renderRichText(null), undefined);
  assert.equal(renderRichText([]), undefined);
  assert.equal(renderRichText([{ _type: 'block', children: [] }]), '<p></p>');

  assert.deepEqual(toAssociationInfo({
    associationName: 'Asso è…',
    logoUrl: 'https://evil.example/logo.png',
    bankDetails: { iban: 'IT60 X054 2811 1010 0000 0123 456', accountHolder: ' Mario Rossi ', bankName: ' Banca ' },
    contacts: { email: 'bad email', phone: '+39 333 1234567', address: null, postalCode: null, city: null, province: null },
    socialLinks: [{ platform: 'Facebook', url: 'javascript:alert(1)' }, null],
  }), {
    name: 'Asso è…',
    shortDescription: undefined,
    logoUrl: undefined,
    aboutText: undefined,
    aboutImageUrl: undefined,
    taxCode: undefined,
    bankDetails: {
      iban: 'IT60X0542811101000000123456',
      accountHolder: 'Mario Rossi',
      bankName: 'Banca',
    },
    registryInfo: undefined,
    copyright: undefined,
    contacts: {
      email: undefined,
      phone: '+39 333 1234567',
      address: undefined,
      postalCode: undefined,
      city: undefined,
      province: undefined,
    },
    socialLinks: [],
    documents: {
      statuteUrl: undefined,
      regulationUrl: undefined,
      privacyPolicyUrl: undefined,
      cookiePolicyUrl: undefined,
    },
  });

  assert.deepEqual(toAssociationInfo({
    associationName: 'Asso è…',
    logoUrl: 'https://cdn.sanity.io/logo.png',
    aboutText: ' Descrizione ',
    aboutImageUrl: 'https://cdn.sanity.io/about.png',
    taxCode: '123',
    bankDetails: null,
    registryInfo: 'Registro',
    copyright: '© Asso è…',
    contacts: { email: 'info@example.org', phone: '+39 333 1234567', address: 'Via Roma', postalCode: '80100', city: 'Napoli', province: 'NA' },
    socialLinks: [{ platform: 'Facebook', url: 'https://facebook.com/assoe' }],
    statuteUrl: 'https://cdn.sanity.io/statute.pdf',
    regulationUrl: 'https://cdn.sanity.io/regulation.pdf',
    privacyPolicyUrl: 'https://cdn.sanity.io/privacy.pdf',
    cookiePolicyUrl: 'https://cdn.sanity.io/cookie.pdf',
  }), {
    name: 'Asso è…',
    shortDescription: undefined,
    logoUrl: 'https://cdn.sanity.io/logo.png',
    aboutText: 'Descrizione',
    aboutImageUrl: 'https://cdn.sanity.io/about.png',
    taxCode: '123',
    bankDetails: undefined,
    registryInfo: 'Registro',
    copyright: '© Asso è…',
    contacts: { email: 'info@example.org', phone: '+39 333 1234567', address: 'Via Roma', postalCode: '80100', city: 'Napoli', province: 'NA' },
    socialLinks: [{ name: 'Facebook', url: 'https://facebook.com/assoe' }],
    documents: {
      statuteUrl: 'https://cdn.sanity.io/statute.pdf',
      regulationUrl: 'https://cdn.sanity.io/regulation.pdf',
      privacyPolicyUrl: 'https://cdn.sanity.io/privacy.pdf',
      cookiePolicyUrl: 'https://cdn.sanity.io/cookie.pdf',
    },
  });
});

test('i vecchi indirizzi evento si mantengono solo per slug sicuri e non riservati', () => {
  const article = { _id: 'art', title: 'Storia', slug: 'storia', publishedAt: '2026-10-20T12:00:00Z', summary: null, imageUrl: null };
  assert.equal(toArticleSummary({ ...article, legacyEventSlug: 'raccolta-coperte-2021' }).legacyEventSlug, 'raccolta-coperte-2021');
  for (const legacyEventSlug of [undefined, null, 42, '', 'archivio', '../contatti', 'https://evil.example', 'con spazio']) {
    assert.equal(toArticleSummary({ ...article, legacyEventSlug }).legacyEventSlug, undefined);
  }
});
