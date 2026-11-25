import { defineField, defineType } from 'sanity';
import { orderRankField } from '@sanity/orderable-document-list';
import { CONTENT_SLUG_MAX_LENGTH, slugError } from '../../shared/slug';
import { validateEditorialImageSize } from './editorialImage';
import { imageDescription } from './imageDescriptions';
import { validateUniqueSlug } from './slugValidation';
import { INITIATIVE_AREAS, initiativeAreaError, initiativeAreaLabel } from '../../shared/initiativeAreas';
import { SPECIAL_SECTION_TYPES } from '../../shared/initiativeSpecialSections';
import { InitiativeSpecialSectionsField } from './InitiativeSpecialSectionsEditor';

export const initiative = defineType({
  name: 'initiative',
  title: 'Iniziativa',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Nome',
      type: 'string',
      options: { search: { weight: 10 } },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'area',
      title: 'Ambito',
      description: 'Scegli uno dei due ambiti: è obbligatorio per pubblicare. Per spostare questa iniziativa, cambia ambito e pubblica; poi scegli la posizione nella vista Ordina del nuovo ambito. Nome, indirizzo, articoli ed eventi collegati vengono mantenuti.',
      type: 'string',
      options: {
        list: INITIATIVE_AREAS.map(({ title, value }) => ({ title, value })),
        layout: 'radio',
        direction: 'horizontal',
      },
      validation: (rule) => rule.required().custom((value) => initiativeAreaError(value) ?? true),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name', maxLength: CONTENT_SLUG_MAX_LENGTH },
      validation: (rule) => rule.required()
        .custom((value) => slugError(value?.current) ?? true)
        .custom(validateUniqueSlug),
    }),
    defineField({ name: 'description', title: 'Descrizione', type: 'richText' }),
    defineField({
      name: 'image',
      title: 'Immagine',
      type: 'image',
      description: imageDescription('Se il file ha bordi bianchi, ritagliali nell’editor dell’immagine prima di pubblicare.'),
      options: { hotspot: true },
      validation: (rule) => rule.custom(validateEditorialImageSize),
    }),
    orderRankField({ type: 'initiative' }),
    defineField({ name: 'active', title: 'Attivo', type: 'boolean', initialValue: true }),
    defineField({
      name: 'specialSections',
      title: 'Sezioni istituzionali',
      type: 'array',
      of: SPECIAL_SECTION_TYPES.map(({ name }) => ({ type: name })),
      components: { field: InitiativeSpecialSectionsField },
    }),
  ],
  preview: {
    select: {
      title: 'name',
      media: 'image',
      area: 'area',
      active: 'active',
    },
    prepare({ title, media, area, active }) {
      return {
        title,
        subtitle: `${initiativeAreaLabel(area)}${active === true ? '' : ' · Non visibile sul sito'}`,
        media,
      };
    },
  },
});
