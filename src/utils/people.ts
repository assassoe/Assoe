import type { PersonRole, PersonSummary } from '@/content/types';
import { PERSON_ROLE_GROUPS } from '../../shared/personRoles.ts';

const boardRoles: readonly PersonRole[] = PERSON_ROLE_GROUPS
  .filter(({ board }) => board)
  .map(({ role }) => role);

/** La gerarchia è fissa; dentro ciascun ruolo rimane l'ordine ricevuto dal repository. */
export function groupPeopleByRole(people: readonly PersonSummary[]) {
  return PERSON_ROLE_GROUPS.map(({ role, groupTitle }) => ({
    role,
    title: groupTitle,
    people: people.filter((person) => person.role === role),
  })).filter((group) => group.people.length > 0);
}

/** Direttivo in ordine di ruolo, mantenendo l'ordine originale tra persone con lo stesso ruolo. */
export function getBoardMembers(people: readonly PersonSummary[]): PersonSummary[] {
  return boardRoles.flatMap((role) => people.filter((person) => person.role === role));
}

/** Le tre sezioni pubbliche conservano i ruoli delle singole persone. */
export function groupPeopleForDirectory(people: readonly PersonSummary[]) {
  return [
    { id: 'direttivo', title: 'Direttivo', people: getBoardMembers(people) },
    { id: 'servizio-civile', title: 'Servizio civile', people: people.filter(({ role }) => role === 'civilServiceVolunteer') },
    { id: 'associati', title: 'Associati', people: people.filter(({ role }) => role === 'volunteer') },
  ].filter((group) => group.people.length > 0);
}
