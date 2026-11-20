export function paginationItems(currentPage: number, lastPage: number): Array<number | null> {
  if (
    !Number.isInteger(currentPage) ||
    !Number.isInteger(lastPage) ||
    currentPage < 1 ||
    lastPage < 1 ||
    currentPage > lastPage
  ) {
    return [];
  }

  const visiblePages = [...new Set([
    1,
    lastPage,
    ...Array.from({ length: 5 }, (_, index) => currentPage + index - 2),
  ])]
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= lastPage)
    .sort((first, second) => first - second);

  return visiblePages.flatMap((pageNumber, index): Array<number | null> => {
    const previous = visiblePages[index - 1];
    if (previous === undefined || pageNumber - previous === 1) return [pageNumber];
    return pageNumber - previous === 2 ? [previous + 1, pageNumber] : [null, pageNumber];
  });
}

/** Ricava una pagina dai dati correnti, senza conservare gli elenchi nei percorsi statici. */
export function paginateArchive<T>(items: readonly T[], currentPage: number, pageSize: number) {
  if (!Number.isInteger(currentPage) || currentPage < 1 || !Number.isInteger(pageSize) || pageSize < 1) return undefined;
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  if (currentPage > lastPage) return undefined;
  return {
    currentPage,
    total: items.length,
    data: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}
