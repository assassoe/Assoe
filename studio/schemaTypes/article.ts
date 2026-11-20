import { defineArrayMember, defineField, defineType } from 'sanity';
import { ARTICLE_SLUG_MAX_LENGTH, articleSlugError, isArticlePublicSlug } from '../../shared/articleSlug';
import { MAX_GALLERY_IMAGES } from '../../shared/imageSize';
import { validateEditorialImageSize } from './editorialImage';
import { isArticleSlugUnique, validateUniqueSlug } from './slugValidation';
import { galleryDescription, imageDescription } from './imageDescriptions';
import { GalleryInput } from './GalleryInput';
import { facebookPostField } from './facebookPostField';
import { validateFeaturedArticle } from './featuredArticles';
import { MAX_FEATURED_ARTICLES } from '../../shared/featuredArticles';

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
      name: 'featured',
      title: 'In evidenza nella homepage',
      type: 'boolean',
      initialValue: false,
      description: `Attiva per scegliere questo articolo tra i preferiti della homepage, fino a ${MAX_FEATURED_ARTICLES} in totale. Pubblica l’articolo e ricostruisci il sito per aggiornare la selezione.`,
      validation: (rule) => rule.custom(validateFeaturedArticle),
    }),
    defineField({
      name: 'legacyArticleSlugs',
      title: 'Indirizzi precedenti dell’articolo',
      type: 'array',
      hidden: true,
      readOnly: true,
      of: [defineArrayMember({ type: 'string', validation: (rule) => rule.custom((value) => isArticlePublicSlug(value) || 'Indirizzo articolo non valido.') })],
      validation: (rule) => rule.unique(),
    }),
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
      name: 'historicalUndated',
      title: 'Ricordo storico senza data verificata',
      type: 'boolean',
      description: 'Attiva solo per materiale storico privo di una data attendibile. Il sito omette la data e la rimuove dall’URL, conservando il vecchio collegamento nel registro degli indirizzi precedenti. Il racconto segue gli articoli datati negli elenchi.',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Data pubblicazione',
      type: 'datetime',
      description: 'La data compare sul sito e nell’URL, salvo i ricordi storici senza data verificata. Prima di modificarla conserva il vecchio indirizzo nel registro di migrazione.',
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
