import { slugError } from './slug.ts';
import { isValidSanityDateTime } from './sanityDateTime.ts';

export const ARTICLE_SLUG_MAX_LENGTH = 48;

/** Un messaggio per lo Studio, oppure undefined se la parte breve dell'URL è valida. */
export function articleSlugError(slug: string | undefined): string | undefined {
  return slugError(slug, { maxLength: ARTICLE_SLUG_MAX_LENGTH, disallowDatePrefix: true });
}

const urlDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Compone l’URL pubblico dell’articolo con la data italiana di pubblicazione. */
export function articlePublicSlug(slug: string, publishedAt: string, historicalUndated = false): string {
  if (!isValidSanityDateTime(publishedAt)) {
    throw new RangeError(`Data pubblicazione non valida: ${publishedAt}`);
  }

  if (historicalUndated) return slug;

  const parts = Object.fromEntries(
    urlDateFormatter.formatToParts(new Date(publishedAt)).map(({ type, value }) => [type, value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}-${slug}`;
}

/** Valida un indirizzo articolo completo, senza percorso, query o frammenti. */
export function isArticlePublicSlug(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (articleSlugError(value) === undefined) return true;
  const match = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(value);
  return Boolean(match && isValidSanityDateTime(`${match[1]}T12:00:00Z`)
    && match[2].length > 0 && articleSlugError(match[2]) === undefined);
}

export function validArticleAliases(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter(isArticlePublicSlug))] : [];
}
