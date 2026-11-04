const initiativeImageProjection = `"image": image {
  "url": asset->url,
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  crop
}`;

const initiativeFields = `_id,
  name,
  area,
  "slug": slug.current,
  ${initiativeImageProjection}`;

const relatedInitiativeFields = `_id,
  name,
  area,
  "slug": slug.current,
  active,
  ${initiativeImageProjection}`;

const articleFields = `_id,
  title,
  "slug": slug.current,
  summary,
  publishedAt,
  "imageUrl": mainImage.asset->url`;

const eventFields = `_id,
  title,
  "slug": slug.current,
  date,
  place,
  status,
  "imageUrl": poster.asset->url`;

export const initiativesQuery = `*[
  _type == "initiative" &&
  active == true &&
  defined(name) &&
  defined(slug.current)
] | order(defined(orderRank) desc, orderRank asc, order asc, name asc) {
  ${initiativeFields}
}`;

export const initiativeBySlugQuery = `*[
  _type == "initiative" &&
  active == true &&
  defined(name) &&
  slug.current == $slug
][0] {
  ${initiativeFields},
  description
}`;

export const articlesByInitiativeQuery = `*[
  _type == "article" &&
  references($initiativeId) &&
  defined(title) &&
  defined(slug.current) &&
  defined(publishedAt)
] | order(publishedAt desc) {
  ${articleFields}
}`;

export const eventsByInitiativeQuery = `*[
  _type == "event" &&
  references($initiativeId) &&
  defined(title) &&
  defined(slug.current) &&
  defined(date) &&
  defined(status)
] | order(date desc) {
  ${eventFields}
}`;

export const articlesQuery = `*[
  _type == "article" &&
  defined(title) &&
  defined(slug.current) &&
  defined(publishedAt)
] | order(publishedAt desc) {
  ${articleFields}
}`;

export const articleByIdQuery = `*[
  _type == "article" &&
  defined(title) &&
  defined(publishedAt) &&
  _id == $id
][0] {
  ${articleFields},
  body,
  facebookPostUrl,
  "galleryImageUrls": gallery[].asset->url,
  "initiatives": initiatives[]-> {
    ${relatedInitiativeFields}
  },
  "event": event-> {
    ${eventFields}
  }
}`;

export const eventsQuery = `*[
  _type == "event" &&
  defined(title) &&
  defined(slug.current) &&
  defined(date) &&
  defined(status)
] | order(date desc) {
  ${eventFields}
}`;

export const eventBySlugQuery = `*[
  _type == "event" &&
  defined(title) &&
  defined(date) &&
  defined(status) &&
  slug.current == $slug
][0] {
  ${eventFields},
  description,
  facebookPostUrl,
  "galleryImageUrls": gallery[].asset->url,
  "initiatives": initiatives[]-> {
    ${relatedInitiativeFields}
  }
}`;

export const peopleQuery = `*[
  _type == "person" &&
  visible == true &&
  defined(firstName) &&
  defined(lastName) &&
  defined(role)
] | order(defined(orderRank) desc, orderRank asc, order asc, lastName asc, firstName asc) {
  _id,
  firstName,
  lastName,
  role,
  "photoUrl": photo.asset->url
}`;

export const homeSectionOrderQuery = `*[_type == "homeSettings"][0].sectionOrder[] { section }`;

export const homeNoticesQuery = `*[_type == "homeSettings"][0].notices[] {
  _key,
  title,
  text,
  "documentUrl": document.asset->url,
  linkUrl,
  linkLabel,
  expiresOn
}`;

export const associationQuery = `*[_type == "siteSettings" && defined(associationName)][0] {
  associationName,
  shortDescription,
  "logoUrl": logo.asset->url,
  aboutText,
  "aboutImageUrl": aboutImage.asset->url,
  taxCode,
  bankDetails { iban, accountHolder, bankName },
  registryInfo,
  copyright,
  contacts {
    email,
    phone,
    address,
    postalCode,
    city,
    province
  },
  socialLinks[] { platform, url },
  "statuteUrl": statute.asset->url,
  "regulationUrl": regulation.asset->url,
  "privacyPolicyUrl": privacyPolicy.asset->url,
  "cookiePolicyUrl": cookiePolicy.asset->url
}`;
