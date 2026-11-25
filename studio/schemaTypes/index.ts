import type { SchemaTypeDefinition } from 'sanity';
import { article } from './article';
import { event } from './event';
import { homeSettings } from './homeSettings';
import { person } from './person';
import { initiative } from './initiative';
import { richText, siteContacts, socialLink } from './objects';
import { siteSettings } from './siteSettings';
import { initiativeSpecialSectionTypes } from './initiativeSpecialSections';

export const schemaTypes: SchemaTypeDefinition[] = [
  richText,
  socialLink,
  siteContacts,
  siteSettings,
  homeSettings,
  ...initiativeSpecialSectionTypes,
  initiative,
  article,
  event,
  person,
];
