import { useCallback, useSyncExternalStore } from 'react';
import { Box, Button, Card, Dialog, Stack, Text } from '@sanity/ui';
import { useDataset, useFormValue, useProjectId, type ArrayFieldProps, type DocumentActionComponent } from 'sanity';
import { specialSectionsEditorKey, specialSectionsState } from '../structure/initiativeSpecialSectionsState';

function useEditorKey(id: string) {
  return specialSectionsEditorKey(useProjectId(), useDataset(), id);
}

export const InitiativeSpecialSectionsAction: DocumentActionComponent = (props) => {
  const key = useEditorKey(props.id);
  return {
    label: 'Configurazione istituzionale · Danilo',
    group: ['paneActions'],
    disabled: !props.initialValueResolved,
    onHandle: () => specialSectionsState.setOpen(key, true),
  };
};

/** L'editor nativo mantiene patch, bozze, validazione e riordino di Sanity. */
export function InitiativeSpecialSectionsField(props: ArrayFieldProps) {
  const id = useFormValue(['_id']);
  const key = useEditorKey(typeof id === 'string' ? id : props.inputId);
  const subscribe = useCallback((listener: () => void) => specialSectionsState.subscribe(key, listener), [key]);
  const snapshot = useCallback(() => specialSectionsState.isOpen(key), [key]);
  const open = useSyncExternalStore(subscribe, snapshot, () => false);
  const close = () => specialSectionsState.setOpen(key, false);

  return <>
    {Boolean(props.value?.length) && <Card padding={3} tone="transparent" border radius={2}>
      <Text size={1}>Questa iniziativa contiene una configurazione istituzionale gestita da Danilo.</Text>
    </Card>}
    {open && <Dialog
      id={`${props.inputId}-editor`}
      header="Contenuti speciali · uso eccezionale"
      width={2}
      onClose={close}
      footer={<Box padding={3}><Button text="Chiudi configurazione" onClick={close} /></Box>}
    >
      <Stack gap={4} padding={4}>
        <Card padding={4} tone="caution" border radius={2}>
          <Stack gap={3}>
            <Text weight="bold">MI RACCOMANDO: NON USARE QUESTA SEZIONE.</Text>
            <Text size={1}>È destinata esclusivamente alla configurazione di contenuti istituzionali richiesti da documentazione specifica. L’utilizzo è affidato a Danilo. Per creare o aggiornare una normale iniziativa, usa i campi principali.</Text>
          </Stack>
        </Card>
        <Text size={1}>Le modifiche vengono salvate nella bozza. Per mostrarle sul sito, pubblica l’iniziativa e ricostruisci il sito. Chiudere questa finestra non annulla le modifiche.</Text>
        {props.renderDefault(props)}
      </Stack>
    </Dialog>}
  </>;
}
