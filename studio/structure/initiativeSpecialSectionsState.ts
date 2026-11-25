/** Stato dell'interfaccia locale: aprire l'editor non scrive nel documento. */
export function createSpecialSectionsState() {
  const opened = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();

  return {
    isOpen: (key: string) => opened.has(key),
    setOpen(key: string, value: boolean) {
      if (opened.has(key) === value) return;
      if (value) opened.add(key);
      else opened.delete(key);
      listeners.get(key)?.forEach((listener) => listener());
    },
    subscribe(key: string, listener: () => void) {
      const group = listeners.get(key) ?? new Set<() => void>();
      group.add(listener);
      listeners.set(key, group);
      return () => {
        group.delete(listener);
        if (!group.size) {
          listeners.delete(key);
          opened.delete(key);
        }
      };
    },
  };
}

export function specialSectionsEditorKey(project: string, dataset: string, id: string): string {
  return `${project}/${dataset}/${id.replace(/^drafts\./, '')}`;
}

export const specialSectionsState = createSpecialSectionsState();
