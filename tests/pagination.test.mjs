import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paginationItems, paginateArchive } from '../src/utils/pagination.ts';

test('mostra tutte le pagine quando non ci sono buchi', () => {
  assert.deepEqual(paginationItems(2, 4), [1, 2, 3, 4]);
});

test('inserisce un ellissi tra pagine lontane', () => {
  assert.deepEqual(paginationItems(8, 20), [1, null, 6, 7, 8, 9, 10, null, 20]);
});

test('rifiuta parametri di paginazione non validi', () => {
  assert.deepEqual(paginationItems(0, 3), []);
  assert.deepEqual(paginationItems(4, 3), []);
  assert.deepEqual(paginationItems(1.5, 3), []);
});


test('la pagina viene ricalcolata dopo aggiunte e rimozioni, senza mutare i dati', () => {
  const items = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(paginateArchive(items, 2, 6), { currentPage: 2, total: 7, data: [7] });
  assert.equal(paginateArchive(items.slice(0, 6), 2, 6), undefined);
  assert.deepEqual(paginateArchive([], 1, 6), { currentPage: 1, total: 0, data: [] });
  assert.equal(items.length, 7);
});

test('la pagina rifiuta numeri e dimensioni non validi', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal(paginateArchive([1], value, 6), undefined);
    assert.equal(paginateArchive([1], 1, value), undefined);
  }
});
