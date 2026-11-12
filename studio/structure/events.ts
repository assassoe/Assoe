import type { Template } from 'sanity';
import type { ListItemBuilder, StructureBuilder } from 'sanity/structure';

const EVENT_INITIATIVE_TEMPLATE = 'event-by-initiative';
export const eventsByInitiativeFilter = '_type == "event" && $initiativeId in initiatives[]._ref';

export const eventInitiativeTemplate: Template = {
  id: EVENT_INITIATIVE_TEMPLATE,
  title: 'Evento per iniziativa',
  schemaType: 'event',
  parameters: [{ name: 'initiativeId', title: 'Iniziativa', type: 'string' }],
  value: ({ initiativeId }: { initiativeId: string }) => ({
    initiatives: [{ _key: 'initiative', _type: 'reference', _ref: initiativeId.replace(/^drafts\./, '') }],
  }),
};

/** Le iniziative sono categorie di navigazione; il collegamento usa i riferimenti esistenti. */
export function createEventsStructure(S: StructureBuilder): ListItemBuilder {
  return S.listItem()
    .id('events')
    .title('Eventi')
    .schemaType('event')
    .child(
      S.list()
        .id('event-tools')
        .title('Eventi')
        .items([
          S.documentTypeListItem('event').title('Tutti gli eventi'),
          S.listItem()
            .id('events-by-initiative')
            .title('Per iniziativa')
            .schemaType('initiative')
            .child(
              S.documentTypeList('initiative')
                .id('event-initiatives')
                .title('Scegli un’iniziativa')
                .defaultOrdering([{ field: 'name', direction: 'asc' }])
                .initialValueTemplates([])
                .canHandleIntent(() => false)
                .child((id) => {
                  const initiativeId = id.replace(/^drafts\./, '');
                  return S.documentTypeList('event')
                    .id('initiative-events')
                    .title('Eventi dell’iniziativa')
                    .apiVersion('2026-03-01')
                    .filter(eventsByInitiativeFilter)
                    .params({ initiativeId })
                    .defaultOrdering([{ field: 'date', direction: 'desc' }])
                    .initialValueTemplates([
                      S.initialValueTemplateItem(EVENT_INITIATIVE_TEMPLATE, { initiativeId }),
                    ]);
                }),
            ),
        ]),
    );
}
