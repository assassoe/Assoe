import type { AssociationInfo, ContentRepository } from '../content/types.ts';

interface AssociationPage {
  associationInfo?: Promise<AssociationInfo | null>;
}

/** Condivide la lettura fra i componenti della pagina, senza cache fra richieste locali. */
export function getPageAssociation(page: AssociationPage, repository: Pick<ContentRepository, 'getAssociationInfo'>): Promise<AssociationInfo | null> {
  return page.associationInfo ??= repository.getAssociationInfo();
}
