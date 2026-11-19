import { defineArrayMember, defineField, defineType } from 'sanity';
import { ARTICLE_SLUG_MAX_LENGTH, articleSlugError } from '../../shared/articleSlug';
import { MAX_GALLERY_IMAGES } from '../../shared/imageSize';
import { validateEditorialImageSize } from './editorialImage';
import { isArticleSlugUnique, validateUniqueSlug } from './slugValidation';
import { galleryDescription, imageDescription } from './imageDescriptions';
import { GalleryInput } from './GalleryInput';
import { facebookPostField } from './facebookPostField';

export const article = defineType({
  name: 'article',
  title: 'Articolo',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Titolo',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Parte breve dell’URL',
      type: 'slug',
      description: 'Scrivi poche parole, per esempio “benedizione-nuova-sede”. La data di pubblicazione viene aggiunta automaticamente all’indirizzo del sito: non inserirla qui.',
      options: { source: 'title', maxLength: ARTICLE_SLUG_MAX_LENGTH, isUnique: isArticleSlugUnique },
      validation: (rule) => rule.required()
        .custom((value) => articleSlugError(value?.current) ?? true)
        .custom(validateUniqueSlug),
    }),
    defineField({ name: 'summary', title: 'Sommario', type: 'text', rows: 3 }),
    defineField({
      name: 'legacyEventSlug',
      title: 'Slug dell’evento precedente',
      type: 'string',
      hidden: true,
      readOnly: true,
    }),
    defineField({ name: 'body', title: 'Testo', type: 'richText' }),
    facebookPostField,
    defineField({
      name: 'mainImage',
      title: 'Immagine principale',
      type: 'image',
      description: imageDescription(),
      options: { hotspot: true },
      validation: (rule) => rule.custom(validateEditorialImageSize),
    }),
    defineField({
      name: 'gallery',
      title: 'Galleria',
      type: 'array',
      description: galleryDescription(),
      components: { input: GalleryInput },
      of: [defineArrayMember({ type: 'image', options: { hotspot: true }, validation: (rule) => rule.custom(validateEditorialImageSize) })],
      validation: (rule) => rule.max(MAX_GALLERY_IMAGES),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Data pubblicazione',
      type: 'datetime',
      description: 'Questa data compare anche nell’URL pubblico. Dopo la pubblicazione, cambiarla modifica il link.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'initiatives',
      title: 'Iniziative collegate',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'initiative' }] }],
    }),
    defineField({
      name: 'event',
      title: 'Evento raccontato',
      type: 'reference',
      to: [{ type: 'event' }],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'publishedAt',
      media: 'mainImage',
    },
  },
});
