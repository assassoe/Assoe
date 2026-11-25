/** Le due parti restano testo semplice e non possono essere composte solo da spazi. */
export function associationNamePart(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

export function validateAssociationNamePart(value: unknown): true | string {
  return associationNamePart(value) ? true : 'Inserisci una parte del nome, non soltanto spazi.';
}
