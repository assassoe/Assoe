import { defineArrayMember, defineField, defineType } from 'sanity';
import { SPECIAL_SECTION_TYPES, requiredSpecialSectionText } from '../../shared/initiativeSpecialSections';
import { validateEditorialImageSize } from './editorialImage';

const title = () => defineField({
  name: 'title', title: 'Titolo', type: 'string',
  validation: (rule) => rule.required().max(160).custom(requiredSpecialSectionText),
});
const body = () => defineField({
  name: 'body', title: 'Testo', type: 'richText',
  validation: (rule) => rule.required().min(1),
});

export const initiativeSpecialSectionTypes = SPECIAL_SECTION_TYPES.map(({ name, title: label }) => defineType({
  name,
  title: label,
  type: 'object',
  fields: [
    title(),
    ...(name === 'initiativeTextSection' || name === 'initiativeInstitutionalSection' ? [
      ...(name === 'initiativeInstitutionalSection' ? [defineField({
        name: 'period', title: 'Periodo di riferimento', type: 'string',
        description: 'Facoltativo: per esempio “Anno 2026” o “Progetto concluso nel 2025”. Non determina scadenze automatiche.',
      })] : []),
      body(),
    ] : []),
    ...(name === 'initiativeLogosSection' ? [defineField({
      name: 'logos', title: 'Loghi ufficiali', type: 'array',
      description: 'Usa gli asset ufficiali, senza ritagli o modifiche ai marchi. Per composizioni prescritte dai manuali, carica il blocco ufficiale completo. L’ordine è quello di pubblicazione.',
      validation: (rule) => rule.required().min(1),
      of: [defineArrayMember({
        type: 'object', name: 'initiativeLogo', title: 'Logo o blocco di loghi',
        fields: [
          defineField({
            name: 'image', title: 'Immagine ufficiale', type: 'image',
            validation: (rule) => rule.required().custom(validateEditorialImageSize),
          }),
          defineField({ name: 'alt', title: 'Descrizione accessibile', type: 'string', validation: (rule) => rule.required().custom(requiredSpecialSectionText) }),
          defineField({ name: 'url', title: 'Collegamento ufficiale', type: 'url', validation: (rule) => rule.uri({ scheme: ['https'], allowCredentials: false }) }),
        ],
        preview: { select: { title: 'alt', media: 'image' } },
      })],
    })] : []),
    ...(name === 'initiativeDocumentsSection' ? [defineField({
      name: 'documents', title: 'Documenti pubblici', type: 'array',
      description: 'Carica soltanto PDF destinati alla pubblicazione, senza fascicoli degli assistiti o moduli compilati.',
      validation: (rule) => rule.required().min(1),
      of: [defineArrayMember({
        type: 'object', name: 'initiativeDocument', title: 'Documento PDF',
        fields: [
          title(),
          defineField({ name: 'description', title: 'Descrizione', type: 'text', rows: 2 }),
          defineField({ name: 'file', title: 'PDF', type: 'file', options: { accept: 'application/pdf' }, validation: (rule) => rule.required() }),
        ],
        preview: { select: { title: 'title' } },
      })],
    })] : []),
    ...(name === 'initiativeFactsSection' ? [defineField({
      name: 'facts', title: 'Dati da pubblicare', type: 'array',
      description: 'Facoltativi per l’iniziativa: aggiungili soltanto quando richiesti o scelti per la comunicazione pubblica. Nessun indicatore predefinito.',
      validation: (rule) => rule.required().min(1),
      of: [defineArrayMember({
        type: 'object', name: 'initiativeFact', title: 'Dato',
        fields: [
          defineField({ name: 'label', title: 'Etichetta', type: 'string', validation: (rule) => rule.required().custom(requiredSpecialSectionText) }),
          defineField({ name: 'value', title: 'Valore', type: 'string', description: 'Testo da mostrare, per esempio “12” o “2025–2026”.', validation: (rule) => rule.required().custom(requiredSpecialSectionText) }),
          defineField({ name: 'unit', title: 'Unità di misura', type: 'string' }),
        ],
        preview: { select: { title: 'label', subtitle: 'value' } },
      })],
    })] : []),
  ],
  preview: {
    select: { title: 'title' },
    prepare: ({ title }) => ({ title, subtitle: label }),
  },
}));
