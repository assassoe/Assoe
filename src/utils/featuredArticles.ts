import type { ArticleSummary } from '../content/types.ts';
import { MAX_FEATURED_ARTICLES } from '../../shared/featuredArticles.ts';

/** Seleziona soltanto le scelte editoriali, senza riempire i posti con articoli recenti. */
export function selectFeaturedArticles(articles: readonly ArticleSummary[]): ArticleSummary[] {
  return articles.filter(({ featured }) => featured === true)
    .sort((first, second) => {
      const historical = Number(first.historicalUndated === true) - Number(second.historicalUndated === true);
      if (historical) return historical;
      if (first.historicalUndated === true) return first.id.localeCompare(second.id);
      return Date.parse(second.publishedAt) - Date.parse(first.publishedAt) || first.id.localeCompare(second.id);
    })
    .slice(0, MAX_FEATURED_ARTICLES);
}
