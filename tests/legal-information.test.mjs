import assert from 'node:assert/strict';
import { test } from 'node:test';
import { legalInformation, renderSecurityText, renderHumansText } from '../src/utils/legalInformation.ts';

const association = {
  name: ' Associazione prova ODV ', shortName: 'Prova', taxCode: ' 01234567890 ',
  contacts: { email: ' segreteria+privacy@example.org ', address: ' Via Nuova 7 ', postalCode: ' 80100 ', city: ' Napoli ', province: ' NA ' },
  registryInfo: ' RUNTS n. 12345 ', socialLinks: [], documents: {},
};

test('la privacy usa e normalizza tutti i dati correnti dell’associazione', () => {
  assert.deepEqual(legalInformation(association), {
    name: 'Associazione prova ODV', taxCode: '01234567890', address: 'Via Nuova 7, 80100 Napoli NA',
    registryInfo: 'RUNTS n. 12345', email: 'segreteria+privacy@example.org', emailHref: 'mailto:segreteria%2Bprivacy@example.org',
  });
  const updated = legalInformation({ ...association, name: 'Nuovo nome', taxCode: '98765432109',
    contacts: { ...association.contacts, address: 'Via Cambiata 2', postalCode: '00100', city: 'Roma', province: 'RM', email: 'nuova@example.org' }, registryInfo: 'RUNTS aggiornato' });
  assert.equal(updated.name, 'Nuovo nome');
  assert.equal(updated.taxCode, '98765432109');
  assert.equal(updated.address, 'Via Cambiata 2, 00100 Roma RM');
  assert.equal(updated.emailHref, 'mailto:nuova@example.org');
  assert.equal(updated.registryInfo, 'RUNTS aggiornato');
});

test('provincia e dati del registro rimangono facoltativi, senza valori di riserva', () => {
  const result = legalInformation({ ...association, registryInfo: undefined, contacts: { ...association.contacts, province: undefined } });
  assert.equal(result.address, 'Via Nuova 7, 80100 Napoli');
  assert.equal(result.registryInfo, '');
});

test('dati legali mancanti o vuoti impediscono di generare una privacy incompleta', () => {
  for (const key of ['name', 'taxCode', 'address', 'postalCode', 'city']) {
    for (const missing of [undefined, '', '   ']) {
      const value = ['name', 'taxCode'].includes(key)
        ? { ...association, [key]: missing }
        : { ...association, contacts: { ...association.contacts, [key]: missing } };
      assert.throws(() => legalInformation(value), /Informativa privacy: pubblicare/);
    }
  }
});

test('i file legali richiedono un’associazione e un’email valida, senza recuperare vecchi recapiti', () => {
  for (const render of [legalInformation, renderSecurityText, renderHumansText]) {
    assert.throws(() => render(null), /indirizzo email valido/);
    for (const email of [undefined, '', ' ', 'senza-dominio@', 'a@@example.org', 'a\nContact:b@example.org']) {
      assert.throws(() => render({ ...association, contacts: { ...association.contacts, email } }), /indirizzo email valido/);
    }
  }
});

test('security.txt rinnova contatto e scadenza a ogni generazione, anche attraverso mesi e anni bisestili', () => {
  for (const timestamp of ['2026-11-26T10:20:30.000Z', '2028-02-29T23:59:59.000Z', '2026-12-31T00:00:00.000Z']) {
    const now = new Date(timestamp);
    const text = renderSecurityText(association, now);
    assert.match(text, /^Contact: mailto:segreteria%2Bprivacy@example.org\n/);
    const expiry = text.match(/^Expires: (.+)$/m)[1];
    assert.equal(new Date(expiry).getTime() - now.getTime(), 180 * 24 * 60 * 60 * 1000);
    assert.match(text, /\nPreferred-Languages: it, en\n$/);
    assert.equal(now.toISOString(), timestamp);
  }
  const first = renderSecurityText(association, new Date('2026-11-26T00:00:00Z'));
  const next = renderSecurityText({ ...association, contacts: { ...association.contacts, email: 'cambiata@example.org' } }, new Date('2026-11-27T00:00:00Z'));
  assert.match(next, /^Contact: mailto:cambiata@example.org\n/);
  assert.notEqual(first.match(/Expires:.+/)[0], next.match(/Expires:.+/)[0]);
  assert.doesNotMatch(next, /segreteria/);
});

test('la scadenza predefinita segue la data di generazione e rifiuta date non valide', () => {
  const before = Date.now();
  const expiry = new Date(renderSecurityText(association).match(/^Expires: (.+)$/m)[1]).getTime();
  assert.ok(expiry >= before + 180 * 24 * 60 * 60 * 1000);
  assert.ok(expiry <= Date.now() + 180 * 24 * 60 * 60 * 1000);
  assert.throws(() => renderSecurityText(association, new Date('invalid')), /Data di generazione/);
});

test('humans.txt allinea nome e contatto e preserva i crediti di sviluppo', () => {
  const text = renderHumansText(association);
  assert.match(text, /Sviluppo: bickpenna\n/);
  assert.match(text, /Contenuti: Associazione prova ODV\nContatto associazione: segreteria\+privacy@example.org\n/);
  const updated = renderHumansText({ ...association, name: 'Nuova associazione', contacts: { email: 'nuova@example.org' } });
  assert.match(updated, /Contenuti: Nuova associazione\nContatto associazione: nuova@example.org\n/);
  assert.doesNotMatch(updated, /Associazione prova|segreteria/);
  for (const name of ['', '  ', 'Nome\nContact: altro', 'Nome\rAltro']) {
    assert.throws(() => renderHumansText({ ...association, name }), /nome associazione valido/);
  }
});
