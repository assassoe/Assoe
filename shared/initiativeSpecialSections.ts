export const SPECIAL_SECTION_TYPES = [
  { name: 'initiativeTextSection', title: 'Testo' },
  { name: 'initiativeInstitutionalSection', title: 'Comunicazione istituzionale' },
  { name: 'initiativeLogosSection', title: 'Loghi' },
  { name: 'initiativeDocumentsSection', title: 'Documenti' },
  { name: 'initiativeFactsSection', title: 'Dati in evidenza' },
] as const;

/** La presenza del campo è facoltativa; i testi compilati devono essere leggibili. */
export function requiredSpecialSectionText(value: unknown): true | string {
  return typeof value === 'string' && value.trim().length > 0
    ? true
    : 'Inserisci un testo non vuoto.';
}
