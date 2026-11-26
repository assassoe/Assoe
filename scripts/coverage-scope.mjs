import fs from 'node:fs';
import path from 'node:path';

export const coverageIncludes = [
  'src/utils/**/*.ts',
  'src/scripts/**/*.ts',
  'src/content/providers/**/*.ts',
  'shared/**/*.ts',
  'studio/structure/**/*.ts',
  'studio/schemaTypes/slugValidation.ts',
  'studio/schemaTypes/editorialImage.ts',
  'studio/schemaTypes/galleryUpload.ts',
  'studio/schemaTypes/featuredArticles.ts',
  'scripts/quality-report-lib.mjs',
  'scripts/quality-report.mjs',
  'scripts/sonar-report.mjs',
];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [filename] : [];
  });
}

/** Il report Node omette i moduli mai caricati: devono comunque far fallire il controllo. */
export function missingCoverage(root, lcov) {
  const covered = new Set(lcov.split('\n').filter((line) => line.startsWith('SF:'))
    .map((line) => path.resolve(root, line.slice(3).trim())));
  const expected = [
    ...['src/utils', 'src/scripts', 'src/content/providers', 'shared', 'studio/structure']
      .flatMap((directory) => sourceFiles(path.join(root, directory))),
    ...coverageIncludes.filter((pattern) => !pattern.includes('*')).map((filename) => path.join(root, filename)),
  ];
  return expected.filter((filename) => !covered.has(filename)).map((filename) => path.relative(root, filename));
}
