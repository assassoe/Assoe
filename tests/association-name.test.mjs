import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, parse } from 'groq-js';
import { associationNamePart, validateAssociationNamePart } from '../shared/associationName.ts';
import { getPageAssociation } from '../src/utils/association.ts';
import { toAssociationInfo } from '../src/content/providers/sanityMappers.ts';
import { isSanityAssociation } from '../src/content/providers/sanityValidation.ts';
import { associationQuery } from '../src/content/providers/sanityQueries.ts';

test('le due parti del nome conservano accenti e maiuscole e rifiutano valori vuoti', () => {
  for (const value of [undefined, null, '', ' \n\t ', 42, {}, []]) {
    assert.equal(associationNamePart(value), undefined);
    assert.equal(typeof validateAssociationNamePart(value), 'string');
  }
  assert.equal(associationNamePart('  Asso è...  '), 'Asso è...');
  assert.equal(associationNamePart(' La Strada Ci Insegna ODV '), 'La Strada Ci Insegna ODV');
  assert.equal(validateAssociationNamePart('Asso è...'), true);
});

test('il nome completo segue entrambi i campi del CMS senza riutilizzare il vecchio nome', () => {
  const fields = { associationName: 'Nome precedente', associationShortName: ' Asso è... ', associationSubtitle: ' La Strada Ci Insegna ODV ' };
  const info = toAssociationInfo(fields);
  assert.equal(info.shortName, 'Asso è...');
  assert.equal(info.subtitle, 'La Strada Ci Insegna ODV');
  assert.equal(info.name, 'Asso è... La Strada Ci Insegna ODV');
  assert.equal(toAssociationInfo({ ...fields, associationShortName: 'Nuovo nome' }).name, 'Nuovo nome La Strada Ci Insegna ODV');
  assert.equal(toAssociationInfo({ ...fields, associationSubtitle: 'Nuova seconda parte' }).name, 'Asso è... Nuova seconda parte');
  for (const associationSubtitle of [undefined, null, '', '  ']) {
    const partial = toAssociationInfo({ ...fields, associationSubtitle });
    assert.equal(partial.name, 'Asso è...');
    assert.equal(partial.subtitle, undefined);
  }
});

test('i documenti precedenti mantengono il proprio nome completo durante la transizione', () => {
  for (const associationShortName of [undefined, null, '', '   ']) {
    const legacy = toAssociationInfo({ associationName: ' Nome precedente ODV ', associationShortName, associationSubtitle: 'Parte non ancora configurata' });
    assert.equal(legacy.name, 'Nome precedente ODV');
    assert.equal(legacy.shortName, 'Nome precedente ODV');
    assert.equal(legacy.subtitle, undefined);
  }
  assert.equal(toAssociationInfo({}).name, '');
});

test('la query e il contratto accettano i due campi nuovi anche senza il campo storico', async () => {
  const fields = { associationShortName: 'Nome dal CMS', associationSubtitle: 'Seconda parte ODV' };
  const record = await (await evaluate(parse(associationQuery), { dataset: [{ _id: 'settings', _type: 'siteSettings', ...fields }] })).get();
  assert.equal(isSanityAssociation(record), true);
  assert.equal(toAssociationInfo(record).name, 'Nome dal CMS Seconda parte ODV');
  const legacy = await (await evaluate(parse(associationQuery), { dataset: [{ _id: 'settings', _type: 'siteSettings', associationName: 'Nome intero precedente' }] })).get();
  assert.equal(isSanityAssociation(legacy), true);
  assert.equal(toAssociationInfo(legacy).name, 'Nome intero precedente');
  assert.equal(isSanityAssociation({ associationName: ' ', associationShortName: ' ' }), false);
  for (const field of ['associationName', 'associationShortName', 'associationSubtitle']) {
    for (const value of [42, {}, []]) assert.equal(isSanityAssociation({ ...fields, [field]: value }), false);
  }
  assert.equal(isSanityAssociation({ associationShortName: 'Nome' }), true);
});

test('la stessa pagina condivide una lettura del nome e una nuova richiesta riceve gli aggiornamenti', async () => {
  let calls = 0;
  let result = toAssociationInfo({ associationShortName: 'Nome', associationSubtitle: 'Prima versione' });
  const repository = { getAssociationInfo: async () => { calls++; return result; } };
  const page = {};
  const first = getPageAssociation(page, repository);
  assert.equal(getPageAssociation(page, repository), first);
  assert.equal((await first).name, 'Nome Prima versione');
  assert.equal(calls, 1);
  result = toAssociationInfo({ associationShortName: 'Nome', associationSubtitle: 'Seconda versione' });
  assert.equal((await getPageAssociation({}, repository)).name, 'Nome Seconda versione');
  result = null;
  const emptyPage = {};
  assert.equal(await getPageAssociation(emptyPage, repository), null);
  assert.equal(await getPageAssociation(emptyPage, repository), null);
  assert.equal(calls, 3);
});
