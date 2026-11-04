import { createClient, type SanityClient } from '@sanity/client';
import { facebookPostUrlOrUndefined } from '../../utils/facebook.ts';
import { articlePublicSlug } from '../../utils/articleSlug.ts';
import { cachePromise } from '../../utils/cachePromise.ts';
import { assertUniqueSlugs } from '../../utils/content.ts';
import { sanityAssetUrlOrUndefined } from '../../../shared/url.ts';
import { resolveHomeSectionOrder } from '../../../shared/homeSections.ts';
import {
  articleByIdQuery,
  articlesByInitiativeQuery,
  articlesQuery,
  associationQuery,
  eventBySlugQuery,
  eventsByInitiativeQuery,
  eventsQuery,
  homeNoticesQuery,
  homeSectionOrderQuery,
  initiativeBySlugQuery,
  initiativesQuery,
  peopleQuery,
} from './sanityQueries.ts';
import {
  isSanityArticle,
  isSanityArticleDetail,
  isSanityAssociation,
  isSanityEvent,
  isSanityEventDetail,
  isSanityPerson,
  isSanityInitiative,
  isSanityInitiativeDetail,
} from './sanityValidation.ts';
import {
  renderRichText,
  safeSanityAssetUrls,
  toArticleSummary,
  toAssociationInfo,
  toEventSummary,
  toHomeNotices,
  toInitiativeSummary,
  toRelatedInitiatives,
} from './sanityMappers.ts';
import type {
  AssociationInfo,
  ContentRepository,
  ArticleDetail,
  EventDetail,
  InitiativeDetail,
} from '../types.ts';

interface SanityConfig {
  projectId: string;
  dataset: string;
}

interface SanityDependencies {
  client?: Pick<SanityClient, 'fetch'>;
  development?: boolean;
}

export function createSanityRepository(
  { projectId, dataset }: SanityConfig,
  dependencies: SanityDependencies = {},
): ContentRepository {
  const {
    client = createClient({
      projectId,
      dataset,
      apiVersion: '2026-03-01',
      perspective: 'published',
      useCdn: false,
    }),
    development = import.meta.env?.DEV ?? false,
  } = dependencies;
  // La build condivide le letture; in sviluppo recepiamo subito le modifiche dello Studio.
  const cache = <T>(factory: () => Promise<T>) => cachePromise(factory, !development);

  const listInitiatives = cache(async () => {
    const initiatives = await client.fetch<unknown>(initiativesQuery);
    const summaries = (Array.isArray(initiatives) ? initiatives : []).filter(isSanityInitiative).map(toInitiativeSummary);
    assertUniqueSlugs(summaries, 'Le iniziative');
    return summaries;
  });

  const listArticles = cache(async () => {
    const articles = await client.fetch<unknown>(articlesQuery);
    const summaries = (Array.isArray(articles) ? articles : []).filter(isSanityArticle).map(toArticleSummary);
    assertUniqueSlugs(summaries, 'Gli articoli');
    return summaries;
  });

  const listEvents = cache(async () => {
    const events = await client.fetch<unknown>(eventsQuery);
    const summaries = (Array.isArray(events) ? events : []).filter(isSanityEvent).map(toEventSummary);
    assertUniqueSlugs(summaries, 'Gli eventi');
    return summaries;
  });

  const listPeople = cache(async () => {
    const people = await client.fetch<unknown>(peopleQuery);
    return (Array.isArray(people) ? people : []).filter(isSanityPerson).map(({ _id, firstName, lastName, role, photoUrl }) => ({
      id: _id,
      firstName,
      lastName,
      role,
      photoUrl: sanityAssetUrlOrUndefined(photoUrl),
    }));
  });

  const listHomeNotices = cache(async () => toHomeNotices(await client.fetch<unknown>(homeNoticesQuery)));
  const listHomeSections = cache(async () => resolveHomeSectionOrder(await client.fetch<unknown>(homeSectionOrderQuery)));

  const getAssociationInfo = cache(async (): Promise<AssociationInfo | null> => {
    const info = await client.fetch<unknown>(associationQuery);

    if (!isSanityAssociation(info)) return null;

    return toAssociationInfo(info);
  });

  return {
    listHomeSections,
    listHomeNotices,
    listInitiatives,

    async getInitiativeBySlug(slug: string): Promise<InitiativeDetail | null> {
      const initiative = await client.fetch<unknown>(initiativeBySlugQuery, { slug });

      if (!isSanityInitiativeDetail(initiative)) return null;

      const [articles, events] = await Promise.all([
        client.fetch<unknown>(articlesByInitiativeQuery, { initiativeId: initiative._id }),
        client.fetch<unknown>(eventsByInitiativeQuery, { initiativeId: initiative._id }),
      ]);

      return {
        ...toInitiativeSummary(initiative),
        descriptionHtml: renderRichText(initiative.description),
        relatedArticles: (Array.isArray(articles) ? articles : []).filter(isSanityArticle).map(toArticleSummary),
        relatedEvents: (Array.isArray(events) ? events : []).filter(isSanityEvent).map(toEventSummary),
      };
    },

    listArticles,

    async getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
      const summary = (await listArticles()).find((article) => article.slug === slug);
      if (!summary) return null;

      const article = await client.fetch<unknown>(articleByIdQuery, { id: summary.id });

      if (!isSanityArticleDetail(article)) return null;
      if (articlePublicSlug(article.slug, article.publishedAt) !== slug) return null;

      return {
        ...toArticleSummary(article),
        bodyHtml: renderRichText(article.body),
        discussionUrl: facebookPostUrlOrUndefined(article.facebookPostUrl),
        galleryImageUrls: safeSanityAssetUrls(article.galleryImageUrls),
        relatedInitiatives: toRelatedInitiatives(article.initiatives),
        relatedEvent: isSanityEvent(article.event)
          ? toEventSummary(article.event)
          : undefined,
      };
    },

    listEvents,

    async getEventBySlug(slug: string): Promise<EventDetail | null> {
      const event = await client.fetch<unknown>(eventBySlugQuery, { slug });

      if (!isSanityEventDetail(event)) return null;

      return {
        ...toEventSummary(event),
        descriptionHtml: renderRichText(event.description),
        discussionUrl: facebookPostUrlOrUndefined(event.facebookPostUrl),
        galleryImageUrls: safeSanityAssetUrls(event.galleryImageUrls),
        relatedInitiatives: toRelatedInitiatives(event.initiatives),
      };
    },

    listPeople,

    getAssociationInfo,
  };
}
