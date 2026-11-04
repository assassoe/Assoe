/** Sezioni riordinabili sotto la presentazione iniziale della homepage. */
export const HOME_SECTIONS = [
  { value: 'notices', title: 'Avvisi' },
  { value: 'event', title: 'Prossimo appuntamento' },
  { value: 'social', title: 'Iniziative sociali' },
  { value: 'volunteering', title: 'Volontariato' },
  { value: 'articles', title: 'Articoli' },
  { value: 'support', title: '5×1000' },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['value'];

export function isHomeSectionId(value: unknown): value is HomeSectionId {
  return HOME_SECTIONS.some((section) => section.value === value);
}

function sectionIds(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value.map((item) => item && typeof item === 'object' ? item.section : undefined)
    : [];
}

/** Preserva l'ordine valido e completa gli elementi mancanti senza duplicati. */
export function resolveHomeSectionOrder(value: unknown): HomeSectionId[] {
  return [...new Set([
    ...sectionIds(value).filter(isHomeSectionId),
    ...HOME_SECTIONS.map(({ value }) => value),
  ])];
}

/** L'assenza del campo conserva la compatibilità con i documenti già pubblicati. */
export function homeSectionOrderError(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const ids = sectionIds(value);
  return ids.length === HOME_SECTIONS.length && ids.every(isHomeSectionId) && new Set(ids).size === HOME_SECTIONS.length
    ? undefined
    : 'L’elenco deve contenere tutte le sei sezioni, ciascuna una sola volta.';
}
