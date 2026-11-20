import { validArticleAliases } from '../../shared/articleSlug.ts';

interface ArticleRoute {
  slug: string;
  legacyArticleSlugs?: string[];
}

/** Gli indirizzi canonici hanno precedenza; due destinazioni per un alias sono un errore. */
export function articleStaticPaths(articles: readonly ArticleRoute[]) {
  const canonical = new Set(articles.map(({ slug }) => slug));
  if (canonical.size !== articles.length) throw new Error('Indirizzo articolo canonico duplicato.');
  const paths: Array<{ params: { slug: string }; props?: { articleSlug: string } }> = articles.map(({ slug }) => ({ params: { slug } }));
  const assigned = new Set<string>();
  for (const article of articles) {
    for (const alias of validArticleAliases(article.legacyArticleSlugs)) {
      if (canonical.has(alias)) continue;
      if (assigned.has(alias)) throw new Error(`Alias articolo con più destinazioni: ${alias}`);
      assigned.add(alias);
      paths.push({ params: { slug: alias }, props: { articleSlug: article.slug } });
    }
  }
  return paths;
}
