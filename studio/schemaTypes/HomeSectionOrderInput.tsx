import { Button } from '@sanity/ui';
import { set, type ArrayOfObjectsInputProps } from 'sanity';
import { homeSectionOrderError, resolveHomeSectionOrder } from '../../shared/homeSections';

/** I documenti esistenti acquisiscono l'elenco solo dopo un'azione dell'editor. */
export function HomeSectionOrderInput(props: ArrayOfObjectsInputProps) {
  if (props.value && !homeSectionOrderError(props.value)) return props.renderDefault(props);

  return (
    <Button
      text="Configura l’ordine delle sezioni"
      mode="ghost"
      disabled={props.readOnly}
      onClick={() => props.onChange(set(resolveHomeSectionOrder(props.value).map((section) => ({
        _type: 'homeSection',
        _key: section,
        section,
      }))))}
    />
  );
}
