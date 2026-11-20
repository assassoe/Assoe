import { INITIATIVE_AREAS } from '../../shared/initiativeAreas.ts';
import type { InitiativeArea, InitiativeSummary } from '../content/types.ts';
import { sitePath } from './sitePath.ts';

const details: Record<InitiativeArea, { slug: string; description: string; emptyMessage: string }> = {
  social: {
    slug: 'iniziative-sociali',
    description: 'Incontri, cultura e momenti da condividere nella comunità.',
    emptyMessage: 'Non ci sono ancora iniziative sociali pubblicate.',
  },
  volunteering: {
    slug: 'volontariato',
    description: 'Solidarietà e sostegno alle persone e alle famiglie.',
    emptyMessage: 'Non ci sono ancora iniziative di volontariato pubblicate.',
  },
};

export const initiativeSections = INITIATIVE_AREAS.map((area) => ({
  ...area,
  ...details[area.value],
  path: `/${details[area.value].slug}/`,
}));

/** Mantiene l'ordine editoriale all'interno di ciascun ambito. */
export function groupInitiatives(initiatives: readonly InitiativeSummary[]) {
  return initiativeSections.map((section) => ({
    ...section,
    initiatives: initiatives.filter(({ area }) => area === section.value),
  }));
}

/** Ogni ambito mantiene attiva la propria voce del menu, anche nelle pagine successive. */
export function initiativeNavigationPath(pathname: string, base = import.meta.env?.BASE_URL ?? '/') {
  const section = initiativeSections.find(({ path }) => pathname.startsWith(sitePath(path, base)));
  return section ? sitePath(section.path, base) : pathname;
}
