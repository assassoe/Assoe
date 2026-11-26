import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const directories = [
  '.astro', 'dist', 'coverage', 'quality-reports', '.scannerwork',
  'studio/dist', 'studio/.sanity',
];

for (const directory of directories) {
  fs.rmSync(new URL(directory, root), { recursive: true, force: true });
}

console.log('Build, cache e report generati rimossi.');
