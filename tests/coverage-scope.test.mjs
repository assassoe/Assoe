import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { missingCoverage } from '../scripts/coverage-scope.mjs';

test('la copertura segnala anche i moduli mai importati, compresi quelli in sottocartelle', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-scope-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['src/utils/nested', 'src/scripts', 'src/content/providers', 'shared', 'studio/schemaTypes', 'studio/structure']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  const files = ['src/utils/tested.ts', 'src/utils/nested/untested.ts', 'src/scripts/browser.ts',
    'src/content/providers/provider.ts', 'shared/helper.ts', 'studio/schemaTypes/slugValidation.ts',
    'studio/schemaTypes/editorialImage.ts', 'studio/schemaTypes/galleryUpload.ts', 'studio/schemaTypes/featuredArticles.ts', 'studio/structure/initiatives.ts'];
  for (const file of [...files, 'src/utils/types.d.ts', 'src/utils/readme.md']) {
    fs.writeFileSync(path.join(root, file), '');
  }
  const lcov = files.filter((file) => !file.includes('untested')).map((file) => `SF:${file}\nend_of_record`).join('\n');
  assert.deepEqual(missingCoverage(root, lcov), ['src/utils/nested/untested.ts']);
  assert.deepEqual(missingCoverage(root, `${lcov}\nSF:${path.join(root, 'src/utils/nested/untested.ts')}\nend_of_record`), []);
  assert.equal(missingCoverage(root, '').length, files.length);
});
