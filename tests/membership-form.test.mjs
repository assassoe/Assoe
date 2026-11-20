import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, parse } from 'groq-js';
import { toAssociationInfo } from '../src/content/providers/sanityMappers.ts';
import { isSanityAssociation } from '../src/content/providers/sanityValidation.ts';
import { associationQuery } from '../src/content/providers/sanityQueries.ts';

test('il modulo di iscrizione ammette soltanto URL di asset Sanity', () => {
  const base = { associationName: 'Associazione' };
  const url = 'https://cdn.sanity.io/files/project/production/form.pdf';
  assert.equal(toAssociationInfo({ ...base, membershipFormUrl: url }).documents.membershipFormUrl, url);
  for (const membershipFormUrl of [undefined, null, '', 'javascript:alert(1)', 'https://example.org/form.pdf']) {
    assert.equal(toAssociationInfo({ ...base, membershipFormUrl }).documents.membershipFormUrl, undefined);
  }
  assert.equal(isSanityAssociation({ ...base, membershipFormUrl: 42 }), false);
  assert.equal(isSanityAssociation({ ...base, membershipFormUrl: url }), true);
});

test('la query recupera il modulo dal riferimento al file senza richiedere il campo ai documenti esistenti', async () => {
  const url = 'https://cdn.sanity.io/files/project/production/form.pdf';
  for (const withForm of [true, false]) {
    const dataset = [{ _id: 'settings', _type: 'siteSettings', associationName: 'Associazione', ...(withForm ? { membershipForm: { asset: { _ref: 'pdf' } } } : {}) }, { _id: 'pdf', _type: 'sanity.fileAsset', url }];
    const record = await (await evaluate(parse(associationQuery), { dataset })).get();
    assert.equal(toAssociationInfo(record).documents.membershipFormUrl, withForm ? url : undefined);
  }
});
