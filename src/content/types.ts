/** Dati che il sito usa, indipendenti dalla forma scelta dal CMS. */
export type InitiativeArea = import('../../shared/initiativeAreas').InitiativeArea;
export type HomeSectionId = import('../../shared/homeSections').HomeSectionId;

export interface InitiativeSummary {
  id: string;
  name: string;
  slug: string;
  area: InitiativeArea;
  imageUrl?: string;
}

export interface InitiativeDetail extends InitiativeSummary {
  /** HTML prodotto dal provider, senza formati specifici del CMS. */
  descriptionHtml?: string;
  relatedArticles: ArticleSummary[];
  relatedEvents: EventSummary[];
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  publishedAt: string;
  imageUrl?: string;
}

export interface ArticleDetail extends ArticleSummary {
  bodyHtml?: string;
  galleryImageUrls: string[];
  /** Link esterno facoltativo per continuare la conversazione. */
  discussionUrl?: string;
  relatedInitiatives: InitiativeSummary[];
  relatedEvent?: EventSummary;
}

export type EventStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface EventSummary {
  id: string;
  title: string;
  slug: string;
  date: string;
  place?: string;
  status: EventStatus;
  imageUrl?: string;
}

export interface EventDetail extends EventSummary {
  descriptionHtml?: string;
  galleryImageUrls: string[];
  discussionUrl?: string;
  relatedInitiatives: InitiativeSummary[];
}

export type PersonRole = import('../../shared/personRoles').PersonRole;

export interface PersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: PersonRole;
  photoUrl?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
}

export interface AssociationInfo {
  name: string;
  shortDescription?: string;
  logoUrl?: string;
  aboutText?: string;
  aboutImageUrl?: string;
  taxCode?: string;
  bankDetails?: {
    iban: string;
    accountHolder: string;
    bankName?: string;
  };
  registryInfo?: string;
  copyright?: string;
  contacts: ContactInfo;
  socialLinks: Array<{ name: string; url: string }>;
  documents: {
    statuteUrl?: string;
    regulationUrl?: string;
    privacyPolicyUrl?: string;
    cookiePolicyUrl?: string;
  };
}

export interface HomeNotice {
  id: string;
  title: string;
  text: string;
  documentUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  expiresOn?: string;
}

/** Le pagine dipendono da questo contratto, non da un client CMS. */
export interface ContentRepository {
  listHomeSections(): Promise<HomeSectionId[]>;
  listHomeNotices(): Promise<HomeNotice[]>;
  listInitiatives(): Promise<InitiativeSummary[]>;
  getInitiativeBySlug(slug: string): Promise<InitiativeDetail | null>;
  listArticles(): Promise<ArticleSummary[]>;
  getArticleBySlug(slug: string): Promise<ArticleDetail | null>;
  listEvents(): Promise<EventSummary[]>;
  getEventBySlug(slug: string): Promise<EventDetail | null>;
  listPeople(): Promise<PersonSummary[]>;
  getAssociationInfo(): Promise<AssociationInfo | null>;
}
