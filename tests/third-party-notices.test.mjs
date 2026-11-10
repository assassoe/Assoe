import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { thirdPartyNotices } from '../scripts/third-party-notices.mjs';

function fixture(t, name, metadata, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-licenses-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'node_modules', name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...metadata }));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), text);
  }
  return directory;
}

function generate(directories, additionalPackages = []) {
  const emitted = [];
  const plugin = thirdPartyNotices({ additionalPackages });
  plugin.generateBundle.call({ emitFile: (asset) => emitted.push(asset) }, {}, {
    'app.js': { type: 'chunk', moduleIds: directories.flatMap((directory) => [path.join(directory, 'index.js'), path.join(directory, 'other.js')]) },
  });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].fileName, 'licenses/third-party.txt');
  return emitted[0].source;
}

test('distributed notices retain original licenses, NOTICE files and font asset licenses', (t) => {
  const dependency = fixture(t, '@example/library', { license: 'Apache-2.0' }, {
    LICENSE: 'Original license and copyright',
    NOTICE: 'Required upstream attribution',
    'LICENSES/extra.txt': 'Additional bundled code notice',
  });
  const font = fixture(t, '@example/font', { license: 'OFL-1.1' }, { LICENSE: 'Original font license' });
  const output = generate([dependency], [pathToFileURL(`${font}/`)]);
  assert.ok(output.includes('Original license and copyright'));
  assert.ok(output.includes('Required upstream attribution'));
  assert.ok(output.includes('Additional bundled code notice'));
  assert.ok(output.includes('Original font license'));
  assert.equal(output.match(/## @example\/library@1\.0\.0/g).length, 1);
});

test('missing notices stop a build instead of silently omitting license obligations', (t) => {
  const dependency = fixture(t, 'unreviewed-library', { license: 'BSD-3-Clause' });
  assert.throws(() => generate([dependency]), /Missing third-party license text: unreviewed-library@1\.0\.0/);
});

test('metadata-only MIT packages retain the declared author with complete terms', (t) => {
  const dependency = fixture(t, 'metadata-only', { license: 'MIT', author: { name: 'Original Author' } });
  const output = generate([dependency]);
  assert.ok(output.includes('Author (package.json): Original Author'));
  assert.ok(output.includes('Permission is hereby granted, free of charge'));
  assert.ok(output.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
});

test('versioned supplemental notices accompany packages missing their original license file', (t) => {
  const dependency = fixture(t, 'typo-js', { version: '1.4.0', license: 'BSD-3-Clause' });
  const output = generate([dependency]);
  assert.ok(output.includes('Copyright (c) 2011, Christopher Finke'));
  assert.ok(output.includes('https://raw.githubusercontent.com/cfinke/Typo.js/'));
});

test('shared original notices are included once and referenced by both packages', (t) => {
  const first = fixture(t, 'first-library', { license: 'MIT' }, { LICENSE: 'Shared original license text' });
  const second = fixture(t, 'second-library', { license: 'MIT' }, { LICENSE: 'Shared original license text' });
  const output = generate([first, second]);
  assert.equal(output.match(/Shared original license text/g).length, 1);
  assert.equal(output.match(/LICENSE: notice \[1\]/g).length, 2);
  assert.ok(output.includes('## first-library@1.0.0'));
  assert.ok(output.includes('## second-library@1.0.0'));
});

test('licenses without notice requirements do not add attribution entries', (t) => {
  const zeroBsd = fixture(t, 'zero-bsd-library', { license: '0BSD' }, { LICENSE: 'Unconditional permission' });
  const publicDomain = fixture(t, 'public-domain-library', { license: 'Public Domain' });
  const output = generate([zeroBsd, publicDomain]);
  assert.ok(!output.includes('## zero-bsd-library'));
  assert.ok(!output.includes('## public-domain-library'));
});
