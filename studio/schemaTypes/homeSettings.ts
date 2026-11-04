import { defineArrayMember, defineField, defineType } from 'sanity';
import { hasVisibleText, MAX_HOME_NOTICES, MAX_HOME_NOTICE_LINK_LABEL_LENGTH, MAX_HOME_NOTICE_TEXT_LENGTH } from '../../shared/homeNotices';
import { NoticeMarkdownInput } from './NoticeMarkdownInput';
import { HOME_SECTIONS, homeSectionOrderError } from '../../shared/homeSections';
import { HomeSectionOrderInput } from './HomeSectionOrderInput';

export const homeSettings = defineType({
  name: 'homeSettings',
  title: 'Homepage',
  type: 'document',
  groups: [
    { name: 'sections', title: 'Ordine delle sezioni', default: true },
    { name: 'notices', title: 'Avvisi' },
  ],
  fields: [
    defineField({
      name: 'sectionOrder',
      title: 'Ordine delle sezioni',
      group: 'sections',
      description: 'Trascina le sezioni per scegliere in quale ordine mostrarle nella homepage. La presentazione iniziale resta in alto. Avvisi e prossimo appuntamento compaiono solo quando hanno contenuti visibili. Pubblica e ricostruisci il sito per applicare l’ordine.',
      type: 'array',
      components: { input: HomeSectionOrderInput },
      initialValue: HOME_SECTIONS.map(({ value }) => ({ _type: 'homeSection', section: value })),
      options: { sortable: true, disableActions: ['add', 'remove', 'duplicate', 'copy'] },
      of: [defineArrayMember({
        name: 'homeSection',
        title: 'Sezione della homepage',
        type: 'object',
        fields: [defineField({
          name: 'section',
          title: 'Sezione',
          type: 'string',
          readOnly: true,
          options: { list: HOME_SECTIONS.map(({ value, title }) => ({ value, title })) },
        })],
        preview: {
          select: { section: 'section' },
          prepare: ({ section }) => ({ title: HOME_SECTIONS.find(({ value }) => value === section)?.title ?? 'Sezione non valida' }),
        },
      })],
      validation: (rule) => rule.custom((value) => homeSectionOrderError(value) ?? true),
    }),
    defineField({
      name: 'notices',
      title: 'Avvisi',
      group: 'notices',
      description: 'Massimo tre avvisi. Trascinali per cambiare l’ordine in cui compaiono nella homepage. Gli avvisi scaduti occupano comunque un posto: rimuovili quando non servono più.',
      type: 'array',
      of: [defineArrayMember({
        name: 'homeNotice',
        title: 'Avviso',
        type: 'object',
        fieldsets: [
          { name: 'moreLink', title: 'Link di approfondimento' },
        ],
        fields: [
          defineField({
            name: 'title',
            title: 'Titolo',
            type: 'string',
            validation: (rule) => rule.required().max(100)
              .custom((value) => hasVisibleText(value) ? true : 'Il titolo non può contenere solo spazi.'),
          }),
          defineField({
            name: 'text',
            title: 'Testo',
            description: `Scrivi un testo breve, fino a ${MAX_HOME_NOTICE_TEXT_LENGTH} caratteri. Puoi usare grassetto, corsivo ed elenchi con i pulsanti dell’editor. Anche i simboli di formattazione contano nel limite; non inserire immagini o codice HTML.`,
            type: 'markdown',
            components: { input: NoticeMarkdownInput },
            validation: (rule) => rule.required().max(MAX_HOME_NOTICE_TEXT_LENGTH)
              .custom((value) => hasVisibleText(value) ? true : 'Il testo non può contenere solo spazi.'),
          }),
          defineField({
            name: 'document',
            title: 'Documento PDF',
            type: 'file',
            description: 'Facoltativo. Carica un PDF da aprire dall’avviso.',
            options: { accept: 'application/pdf' },
          }),
          defineField({
            name: 'linkUrl',
            title: 'Indirizzo del link (URL)',
            type: 'url',
            fieldset: 'moreLink',
            description: 'Facoltativo. Incolla un indirizzo HTTPS, anche di una pagina del nostro sito.',
            validation: (rule) => rule.uri({ scheme: ['https'] }),
          }),
          defineField({
            name: 'linkLabel',
            title: 'Testo del link',
            type: 'string',
            fieldset: 'moreLink',
            description: 'Facoltativo. Se lasci vuoto questo campo, sul sito compare “Approfondisci”. Viene mostrato solo se hai inserito un link.',
            validation: (rule) => rule.max(MAX_HOME_NOTICE_LINK_LABEL_LENGTH)
              .custom((value) => value === undefined || value === null || value === '' || hasVisibleText(value)
                ? true
                : 'Il testo del link non può contenere solo spazi.'),
          }),
          defineField({
            name: 'expiresOn',
            title: 'Visibile fino al',
            type: 'date',
            description: 'Facoltativa. L’avviso resta visibile per tutta questa data (ora italiana) e scompare dal giorno successivo. Se la lasci vuota, rimane visibile finché non lo rimuovi.',
          }),
        ],
        preview: {
          select: { title: 'title', subtitle: 'text' },
        },
      })],
      validation: (rule) => rule.max(MAX_HOME_NOTICES),
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Homepage' }),
  },
});
