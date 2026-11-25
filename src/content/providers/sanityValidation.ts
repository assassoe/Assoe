import { PERSON_ROLE_GROUPS, type PersonRole } from '../../../shared/personRoles.ts';
import { articleSlugError } from '../../../shared/articleSlug.ts';
import { EVENT_RESERVED_SLUGS, isValidSlug } from '../../../shared/slug.ts';
import { isValidSanityDateTime } from '../../../shared/sanityDateTime.ts';
import { isCalendarDate, MAX_HOME_NOTICE_TEXT_LENGTH } from '../../../shared/homeNotices.ts';
import type { EventStatus } from '../types';
import type { SanityImage } from './sanityImage';
import { isInitiativeArea, type InitiativeArea } from '../../../shared/initiativeAreas.ts';

export interface SanityInitiative {
  _id: string;
  name: string;
  slug: string;
  area: InitiativeArea;
  image: SanityImage | null;
}

export interface SanityInitiativeDetail extends SanityInitiative {
  description: Array<{ _type: string; _key?: string }> | null;
}

export interface SanityRelatedInitiative extends SanityInitiative {
  active: boolean | null;
}

export interface SanityArticle {
  _id: string;
  title: string;
  slug: string;
  summary: string | null;
  publishedAt: string;
  historicalUndated?: unknown;
  featured?: unknown;
  imageUrl: string | null;
  legacyEventSlug?: unknown;
  legacyArticleSlugs?: unknown;
}

export interface SanityArticleDetail extends SanityArticle {
  body: Array<{ _type: string; _key?: string }> | null;
  galleryImageUrls: Array<string | null> | null;
  facebookPostUrl: string | null;
  initiatives: Array<SanityRelatedInitiative | null> | null;
  event: SanityEvent | null;
}

export interface SanityEvent {
  _id: string;
  title: string;
  slug: string;
  date: string;
  place: string | null;
  status: EventStatus;
  imageUrl: string | null;
}

export interface SanityEventDetail extends SanityEvent {
  description: Array<{ _type: string; _key?: string }> | null;
  galleryImageUrls: Array<string | null> | null;
  facebookPostUrl: string | null;
  initiatives: Array<SanityRelatedInitiative | null> | null;
  articles?: unknown;
}

export interface SanityPerson {
  _id: string;
  firstName: string;
  lastName: string;
  role: PersonRole;
  photoUrl: string | null;
}

export interface SanityHomeNotice {
  _key: string;
  title: string;
  text: string;
  documentUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: unknown;
  expiresOn?: string | null;
}

export interface SanityAssociation {
  associationName?: string | null;
  associationShortName?: string | null;
  associationSubtitle?: string | null;
  shortDescription?: string | null;
  logoUrl?: string | null;
  aboutText?: string | null;
  aboutImageUrl?: string | null;
  taxCode?: string | null;
  bankDetails?: {
    iban: string | null;
    accountHolder: string | null;
    bankName: string | null;
  } | null;
  registryInfo?: string | null;
  copyright?: string | null;
  contacts?: {
    email: string | null;
    phone: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    province: string | null;
  } | null;
  socialLinks?: Array<{ platform: string; url: string } | null> | null;
  statuteUrl?: string | null;
  membershipFormUrl?: string | null;
  regulationUrl?: string | null;
  privacyPolicyUrl?: string | null;
  cookiePolicyUrl?: string | null;
}

const eventStatuses = new Set<EventStatus>(['scheduled', 'ongoing', 'completed', 'cancelled']);
const personRoles = new Set<PersonRole>(PERSON_ROLE_GROUPS.map(({ role }) => role));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function isValidArticleSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && articleSlugError(value) === undefined;
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isSanityImage(value: unknown): value is SanityImage | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;

  return isNullableString(value.url)
    && (value.width === null || (typeof value.width === 'number' && Number.isInteger(value.width)))
    && (value.height === null || (typeof value.height === 'number' && Number.isInteger(value.height)))
    && (value.crop === null || isRecord(value.crop));
}

function isPortableTextBlocks(value: unknown): value is Array<{ _type: string; _key?: string }> | null {
  return value === null || (
    Array.isArray(value)
    && value.every((block) => isRecord(block) && isNonEmptyString(block._type))
  );
}

export function isSanityInitiative(value: unknown): value is SanityInitiative {
  return isRecord(value)
    && isNonEmptyString(value._id)
    && isNonEmptyString(value.name)
    && isInitiativeArea(value.area)
    && isValidSlug(value.slug)
    && isSanityImage(value.image);
}

export function isSanityInitiativeDetail(value: unknown): value is SanityInitiativeDetail {
  return isSanityInitiative(value) && isPortableTextBlocks(field(value, 'description'));
}

export function isSanityRelatedInitiative(value: unknown): value is SanityRelatedInitiative {
  const active = field(value, 'active');
  return isSanityInitiative(value) && (active === null || typeof active === 'boolean');
}

export function isSanityArticle(value: unknown): value is SanityArticle {
  return isRecord(value)
    && isNonEmptyString(value._id)
    && isNonEmptyString(value.title)
    && isValidArticleSlug(value.slug)
    && isValidSanityDateTime(value.publishedAt)
    && isNullableString(value.summary)
    && isNullableString(value.imageUrl);
}

export function isSanityArticleDetail(value: unknown): value is SanityArticleDetail {
  if (!isSanityArticle(value)) return false;
  const body = field(value, 'body');
  const galleryImageUrls = field(value, 'galleryImageUrls');
  const initiatives = field(value, 'initiatives');
  const event = field(value, 'event');
  return isPortableTextBlocks(body)
    && (galleryImageUrls === null || (Array.isArray(galleryImageUrls) && galleryImageUrls.every(isNullableString)))
    && isNullableString(field(value, 'facebookPostUrl'))
    && (initiatives === null || (Array.isArray(initiatives) && initiatives.every((initiative) => initiative === null || isSanityRelatedInitiative(initiative))))
    && (event === null || isSanityEvent(event));
}

export function isSanityEvent(value: unknown): value is SanityEvent {
  return isRecord(value)
    && isNonEmptyString(value._id)
    && isNonEmptyString(value.title)
    && isValidSlug(value.slug, { reserved: EVENT_RESERVED_SLUGS })
    && isValidSanityDateTime(value.date)
    && isNullableString(value.place)
    && typeof value.status === 'string'
    && eventStatuses.has(value.status as EventStatus)
    && isNullableString(value.imageUrl);
}

export function isSanityEventDetail(value: unknown): value is SanityEventDetail {
  if (!isSanityEvent(value)) return false;
  const description = field(value, 'description');
  const galleryImageUrls = field(value, 'galleryImageUrls');
  const initiatives = field(value, 'initiatives');
  return isPortableTextBlocks(description)
    && (galleryImageUrls === null || (Array.isArray(galleryImageUrls) && galleryImageUrls.every(isNullableString)))
    && isNullableString(field(value, 'facebookPostUrl'))
    && (initiatives === null || (Array.isArray(initiatives) && initiatives.every((initiative) => initiative === null || isSanityRelatedInitiative(initiative))));
}

export function isSanityPerson(value: unknown): value is SanityPerson {
  return isRecord(value)
    && isNonEmptyString(value._id)
    && isNonEmptyString(value.firstName)
    && isNonEmptyString(value.lastName)
    && typeof value.role === 'string'
    && personRoles.has(value.role as PersonRole)
    && isNullableString(value.photoUrl);
}

export function isSanityHomeNotice(value: unknown): value is SanityHomeNotice {
  return isRecord(value)
    && isNonEmptyString(value._key)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.text)
    && value.text.length <= MAX_HOME_NOTICE_TEXT_LENGTH
    && (value.documentUrl === undefined || isNullableString(value.documentUrl))
    && (value.linkUrl === undefined || isNullableString(value.linkUrl))
    && (value.expiresOn === undefined || value.expiresOn === null || isCalendarDate(value.expiresOn));
}

export function isSanityAssociation(value: unknown): value is SanityAssociation {
  if (!isRecord(value) || (!isNonEmptyString(value.associationShortName) && !isNonEmptyString(value.associationName))) return false;

  const stringFields = [
    'associationName',
    'associationShortName',
    'associationSubtitle',
    'shortDescription',
    'logoUrl',
    'aboutText',
    'aboutImageUrl',
    'taxCode',
    'registryInfo',
    'copyright',
    'statuteUrl',
    'membershipFormUrl',
    'regulationUrl',
    'privacyPolicyUrl',
    'cookiePolicyUrl',
  ];
  if (!stringFields.every((field) => isOptionalString(value[field]))) return false;

  for (const field of ['bankDetails', 'contacts'] as const) {
    const nested = value[field];
    if (nested !== null && nested !== undefined && !isRecord(nested)) return false;
  }

  const bankDetails = value.bankDetails;
  if (isRecord(bankDetails) && !['iban', 'accountHolder', 'bankName'].every((field) => isOptionalString(bankDetails[field]))) {
    return false;
  }

  const contacts = value.contacts;
  if (isRecord(contacts) && ![
    'email',
    'phone',
    'address',
    'postalCode',
    'city',
    'province',
  ].every((field) => isOptionalString(contacts[field]))) {
    return false;
  }

  return value.socialLinks === null
    || value.socialLinks === undefined
    || (
      Array.isArray(value.socialLinks)
      && value.socialLinks.every((socialLink) => socialLink === null || (
        isRecord(socialLink)
        && isNonEmptyString(socialLink.platform)
        && isNonEmptyString(socialLink.url)
      ))
    );
}

export function toPortableTextBlocks(value: unknown): Array<{ _type: string; _key?: string }> | null {
  return isPortableTextBlocks(value) ? value : null;
}
