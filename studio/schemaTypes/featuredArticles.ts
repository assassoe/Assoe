import type { ValidationContext } from 'sanity';
import { MAX_FEATURED_ARTICLES } from '../../shared/featuredArticles.ts';

export const featuredArticleIdsQuery = `*[
  _type == "article" && featured == true &&
  !(_id in $excludedIds) && !(_id in path("versions.**"))
]._id`;

/** Conta ogni articolo una sola volta, anche quando esistono bozza e pubblicato. */
export async function validateFeaturedArticle(value: unknown, { document, getClient }: ValidationContext): Promise<true | string> {
  if (value !== true || !document?._id) return true;
  const id = document._id.replace(/^drafts\./, '');
  try {
    const ids = await getClient({ apiVersion: '2026-03-01' }).fetch<unknown>(
      featuredArticleIdsQuery,
      { excludedIds: [id, `drafts.${id}`] },
      { perspective: 'raw' },
    );
    if (!Array.isArray(ids) || !ids.every((item): item is string => typeof item === 'string')) {
      return 'Non è stato possibile verificare gli articoli in evidenza. Riprova prima di pubblicare.';
    }
    const count = new Set(ids.map((item) => item.replace(/^drafts\./, ''))).size;
    return count < MAX_FEATURED_ARTICLES
      ? true
      : `Puoi scegliere al massimo ${MAX_FEATURED_ARTICLES} articoli in evidenza. Disattiva l’opzione su un altro articolo e pubblicalo prima di aggiungerne uno nuovo.`;
  } catch {
    return 'Non è stato possibile verificare gli articoli in evidenza. Riprova prima di pubblicare.';
  }
}
