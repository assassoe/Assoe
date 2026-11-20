import { toHTML } from '@portabletext/to-html';
import { articlePublicSlug } from '../../utils/articleSlug.ts';
import { validArticleAliases } from '../../../shared/articleSlug.ts';
import { EVENT_RESERVED_SLUGS, isValidSlug } from '../../../shared/slug.ts';
import { sanitizeRichTextHtml } from '../../utils/sanitizeHtml.ts';
import {
  emailAddressOrUndefined,
  httpsUrlOrUndefined,
  phoneNumberOrUndefined,
  sanityAssetUrlOrUndefined,
} from '../../../shared/url.ts';
import { validIbanOrUndefined } from '../../../shared/iban.ts';
import { initiativeImageUrl } from './sanityImage.ts';
import { isHomeNoticeExpired, MAX_HOME_NOTICES, MAX_HOME_NOTICE_LINK_LABEL_LENGTH, todayInRome } from '../../../shared/homeNotices.ts';
import {
  isSanityHomeNotice,
  isSanityRelatedInitiative,
  toPortableTextBlocks,
  type SanityArticle,
  type SanityAssociation,
  type SanityEvent,
  type SanityInitiative,
  type SanityRelatedInitiative,
} from './sanityValidation.ts';
import type {
  ArticleSummary,
  AssociationInfo,
  EventSummary,
  HomeNotice,
  InitiativeSummary,
} from '../types.ts';

export function toHomeNotices(value: unknown, today: string = todayInRome()): HomeNotice[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isSanityHomeNotice)
    .filter(({ expiresOn }) => !isHomeNoticeExpired(expiresOn ?? undefined, today))
    .slice(0, MAX_HOME_NOTICES)
    .map(({ _key, title, text, documentUrl, linkUrl, linkLabel, expiresOn }) => {
      const safeDocumentUrl = sanityAssetUrlOrUndefined(documentUrl);
      const safeLinkUrl = httpsUrlOrUndefined(linkUrl);
      const trimmedLinkLabel = typeof linkLabel === 'string' && linkLabel.length <= MAX_HOME_NOTICE_LINK_LABEL_LENGTH
        ? linkLabel.trim()
        : undefined;

      return {
        id: _key,
        title: title.trim(),
        text: text.trim(),
        ...(safeDocumentUrl ? { documentUrl: safeDocumentUrl } : {}),
        ...(safeLinkUrl ? { linkUrl: safeLinkUrl } : {}),
        ...(safeLinkUrl && trimmedLinkLabel ? { linkLabel: trimmedLinkLabel } : {}),
        ...(expiresOn ? { expiresOn } : {}),
      };
    });
}

export function renderRichText(blocks: unknown): string | undefined {
  const validBlocks = toPortableTextBlocks(blocks);
  return validBlocks?.length ? sanitizeRichTextHtml(toHTML(validBlocks)) : undefined;
}

export function toArticleSummary(article: SanityArticle): ArticleSummary {
  const aliases = validArticleAliases(article.legacyArticleSlugs);
  return {
    id: article._id,
    title: article.title,
    slug: articlePublicSlug(article.slug, article.publishedAt, article.historicalUndated === true),
    summary: article.summary ?? undefined,
    publishedAt: article.publishedAt,
    ...(article.historicalUndated === true ? { historicalUndated: true } : {}),
    ...(article.featured === true ? { featured: true } : {}),
    imageUrl: sanityAssetUrlOrUndefined(article.imageUrl),
    ...(isValidSlug(article.legacyEventSlug, { reserved: EVENT_RESERVED_SLUGS })
      ? { legacyEventSlug: article.legacyEventSlug }
      : {}),
    ...(aliases.length ? { legacyArticleSlugs: aliases } : {}),
  };
}

export function toInitiativeSummary(initiative: SanityInitiative): InitiativeSummary {
  return {
    id: initiative._id,
    name: initiative.name,
    slug: initiative.slug,
    area: initiative.area,
    imageUrl: initiativeImageUrl(initiative.image),
  };
}

export function toRelatedInitiatives(initiatives: Array<SanityRelatedInitiative | null> | null): InitiativeSummary[] {
  return (initiatives ?? [])
    .filter((initiative): initiative is SanityRelatedInitiative => Boolean(initiative?.active && isSanityRelatedInitiative(initiative)))
    .map(toInitiativeSummary);
}

export function toEventSummary(event: SanityEvent): EventSummary {
  return {
    id: event._id,
    title: event.title,
    slug: event.slug,
    date: event.date,
    place: event.place ?? undefined,
    status: event.status,
    imageUrl: sanityAssetUrlOrUndefined(event.imageUrl),
  };
}

export function safeSanityAssetUrls(urls: Array<string | null> | null): string[] {
  return (urls ?? []).flatMap((url) => {
    const safeUrl = sanityAssetUrlOrUndefined(url);
    return safeUrl ? [safeUrl] : [];
  });
}

export function toAssociationInfo(info: SanityAssociation): AssociationInfo {
  const iban = validIbanOrUndefined(info.bankDetails?.iban);
  const accountHolder = info.bankDetails?.accountHolder?.trim();

  return {
    name: info.associationName.trim(),
    shortDescription: info.shortDescription?.trim() || undefined,
    logoUrl: sanityAssetUrlOrUndefined(info.logoUrl),
    aboutText: info.aboutText?.trim() || undefined,
    aboutImageUrl: sanityAssetUrlOrUndefined(info.aboutImageUrl),
    taxCode: info.taxCode ?? undefined,
    bankDetails: iban && accountHolder ? {
      iban,
      accountHolder,
      bankName: info.bankDetails?.bankName?.trim() || undefined,
    } : undefined,
    registryInfo: info.registryInfo ?? undefined,
    copyright: info.copyright ?? undefined,
    contacts: {
      email: emailAddressOrUndefined(info.contacts?.email),
      phone: phoneNumberOrUndefined(info.contacts?.phone),
      address: info.contacts?.address ?? undefined,
      postalCode: info.contacts?.postalCode ?? undefined,
      city: info.contacts?.city ?? undefined,
      province: info.contacts?.province ?? undefined,
    },
    socialLinks: (info.socialLinks ?? []).flatMap((socialLink) => {
      if (!socialLink) return [];
      const safeUrl = httpsUrlOrUndefined(socialLink.url);
      return socialLink.platform && safeUrl ? [{ name: socialLink.platform, url: safeUrl }] : [];
    }),
    documents: {
      statuteUrl: sanityAssetUrlOrUndefined(info.statuteUrl),
      ...(sanityAssetUrlOrUndefined(info.membershipFormUrl) ? { membershipFormUrl: sanityAssetUrlOrUndefined(info.membershipFormUrl) } : {}),
      regulationUrl: sanityAssetUrlOrUndefined(info.regulationUrl),
      privacyPolicyUrl: sanityAssetUrlOrUndefined(info.privacyPolicyUrl),
      cookiePolicyUrl: sanityAssetUrlOrUndefined(info.cookiePolicyUrl),
    },
  };
}

