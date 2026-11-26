import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBoardMembers, groupPeopleByRole, groupPeopleForDirectory } from '../src/utils/people.ts';
import { PERSON_ROLE_GROUPS, personRoleLabel } from '../shared/personRoles.ts';

const person = (id, role) => ({ id, firstName: id, lastName: 'Test', role });

test('la pagina associati unisce il direttivo e mantiene separate le altre due sezioni', () => {
  const input = Object.freeze([person('socio', 'volunteer'), person('consigliere', 'boardMember'), person('civile', 'civilServiceVolunteer'), person('presidente', 'president'), person('vice', 'vicePresident'), person('segretario', 'secretary')].map(Object.freeze));
  const groups = groupPeopleForDirectory(input);
  assert.deepEqual(groups.map(({ title }) => title), ['Direttivo', 'Servizio civile', 'Associati']);
  assert.deepEqual(groups.map(({ people }) => people.map(({ id }) => id)), [['presidente', 'vice', 'segretario', 'consigliere'], ['civile'], ['socio']]);
  assert.deepEqual(groupPeopleForDirectory([]), []);
  assert.deepEqual(groupPeopleForDirectory([person('ignoto', 'other')]), []);
  assert.deepEqual(groupPeopleForDirectory([person('socio', 'volunteer')]).map(({ id }) => id), ['associati']);
  assert.equal(input[0].id, 'socio');
});

test('raggruppa i ruoli nella gerarchia fissa mantenendo l’ordine dentro ogni ruolo', () => {
  const groups = groupPeopleByRole([
    person('volontario-2', 'volunteer'),
    person('servizio-civile-2', 'civilServiceVolunteer'),
    person('consigliere-2', 'boardMember'),
    person('presidente', 'president'),
    person('volontario-1', 'volunteer'),
    person('servizio-civile-1', 'civilServiceVolunteer'),
    person('consigliere-1', 'boardMember'),
  ]);

  assert.deepEqual(groups.map(({ role }) => role), ['president', 'boardMember', 'civilServiceVolunteer', 'volunteer']);
  assert.deepEqual(groups[1].people.map(({ id }) => id), ['consigliere-2', 'consigliere-1']);
  assert.deepEqual(groups[2].people.map(({ id }) => id), ['servizio-civile-2', 'servizio-civile-1']);
  assert.deepEqual(groups[3].people.map(({ id }) => id), ['volontario-2', 'volontario-1']);
  assert.equal(personRoleLabel('civilServiceVolunteer'), 'Volontario del servizio civile');
  assert.equal(personRoleLabel('unknown'), 'unknown');
  assert.equal(new Set(PERSON_ROLE_GROUPS.map(({ role }) => role)).size, PERSON_ROLE_GROUPS.length);
});

test('non mostra sezioni vuote o ruoli sconosciuti', () => {
  assert.deepEqual(groupPeopleByRole([]), []);
  assert.deepEqual(groupPeopleByRole([person('sconosciuto', 'other')]), []);
});

test('mostra il direttivo in ordine di ruolo senza includere gli altri associati', () => {
  const people = [
    person('volontario', 'volunteer'),
    person('consigliere-1', 'boardMember'),
    person('presidente', 'president'),
    person('segretario', 'secretary'),
    person('vicepresidente', 'vicePresident'),
    person('consigliere-2', 'boardMember'),
    person('servizio-civile', 'civilServiceVolunteer'),
  ];

  assert.deepEqual(getBoardMembers(people).map(({ id }) => id), [
    'presidente', 'vicepresidente', 'segretario', 'consigliere-1', 'consigliere-2',
  ]);
  assert.equal(people[0].id, 'volontario');
});

test('gestisce elenchi vuoti o senza persone del direttivo', () => {
  assert.deepEqual(getBoardMembers([]), []);
  assert.deepEqual(getBoardMembers([person('volontario', 'volunteer')]), []);
});

test('ignora ruoli sconosciuti provenienti da dati non validi', () => {
  assert.deepEqual(getBoardMembers([person('sconosciuto', 'other')]), []);
});
