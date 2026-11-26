import type { ArticleSummary } from '../content/types.ts';
import { MAX_FEATURED_ARTICLES, HOME_ARTICLE_COUNT } from '../../shared/featuredArticles.ts';

function compareArticles(first: ArticleSummary, second: ArticleSummary): number {
  const historical = Number(first.historicalUndated === true) - Number(second.historicalUndated === true);
  if (historical) return historical;
  if (first.historicalUndated === true) return first.id.localeCompare(second.id);
  return Date.parse(second.publishedAt) - Date.parse(first.publishedAt) || first.id.localeCompare(second.id);
}

/** Le scelte editoriali mantengono il proprio limite, senza aggiunte automatiche. */
export function selectFeaturedArticles(articles: readonly ArticleSummary[]): ArticleSummary[] {
  return articles.filter(({ featured }) => featured === true)
    .sort(compareArticles)
    .slice(0, MAX_FEATURED_ARTICLES);
}

/** Quattro articoli totali: prima le scelte editoriali, poi i più recenti rimasti. */
export function selectHomeArticles(articles: readonly ArticleSummary[]): ArticleSummary[] {
  const featured = selectFeaturedArticles(articles);
  const featuredIds = new Set(featured.map(({ id }) => id));
  const recent = articles.filter(({ id }) => !featuredIds.has(id)).sort(compareArticles);
  return [...featured, ...recent].slice(0, HOME_ARTICLE_COUNT);
}
