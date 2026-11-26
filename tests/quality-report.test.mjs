import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseLcov, parseTests, reportStatus, renderHtml } from '../scripts/quality-report-lib.mjs';

test('la copertura aggrega i conteggi dei file senza fare la media delle percentuali', () => {
  const report = parseLcov('SF:a.ts\nLF:10\nLH:5\nBRF:2\nBRH:1\nFNF:1\nFNH:1\nend_of_record\nSF:b.ts\nLF:90\nLH:90\nBRF:8\nBRH:8\nFNF:2\nFNH:1\nend_of_record\n');
  assert.equal(report.files, 2);
  assert.equal(report.lines.percent, 95);
  assert.equal(report.branches.percent, 90);
  assert.equal(report.functions.hit, 2);
  assert.equal(report.functions.found, 3);
});

test('report assenti e contatori impossibili non diventano copertura perfetta', () => {
  for (const input of ['', 'non LCOV', 'SF:a.ts\nLF:0\nLH:0', 'SF:a.ts\nLF:1\nLH:2']) assert.equal(parseLcov(input), null);
  const report = parseLcov('SF:a.ts\nLF:1\nLH:1\nBRF:0\nBRH:0\nFNF:0\nFNH:0');
  assert.equal(report.branches.percent, null);
  assert.equal(report.functions.percent, null);
});

test('il conteggio dei test legge riepiloghi TAP e spec senza confondere righe diagnostiche', () => {
  assert.deepEqual(parseTests('# tests 12\n# pass 10\n# fail 1\n# cancelled 0\n# skipped 1\n# todo 0\n'), { tests: 12, pass: 10, fail: 1, cancelled: 0, skipped: 1, todo: 0 });
  assert.deepEqual(parseTests('ℹ tests 2\nℹ pass 2\nℹ fail 0\n'), { tests: 2, pass: 2, fail: 0 });
  assert.equal(parseTests('the tests 123 passed'), null);
});

test('una misura mancante non è un successo e un fallimento prevale sugli altri risultati', () => {
  const checks = Array.from({ length: 8 }, () => ({ status: 'passed' }));
  assert.equal(reportStatus(checks, { status: 'not_run' }), 'incomplete');
  assert.equal(reportStatus(checks.slice(1), { status: 'passed' }), 'incomplete');
  assert.equal(reportStatus(checks, { status: 'passed' }), 'passed');
  assert.equal(reportStatus(checks, { status: 'failed' }), 'failed');
  assert.equal(reportStatus([...checks.slice(1), { status: 'failed' }], { status: 'not_run' }), 'failed');
  assert.equal(reportStatus([...checks.slice(1), { status: 'not_run' }], { status: 'passed' }), 'incomplete');
});

test('il consolidamento rifiuta prove mancanti o appartenenti a sorgenti diversi', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-report-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const script = fileURLToPath(new URL('../scripts/quality-report.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [script, '--merge', directory, '--output', path.join(directory, 'output')], { encoding: 'utf8' });
  assert.notEqual(run().status, 0);
  for (const [group, digest] of [['frontend', 'first'], ['studio', 'different']]) {
    fs.mkdirSync(path.join(directory, group));
    fs.writeFileSync(path.join(directory, group, 'result.json'), JSON.stringify({ metadata: { revision: 'abc', sourceDigest: digest }, checks: [] }));
  }
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sorgenti diversi/);
});

test('il report HTML tratta diagnostica e nomi del ramo come testo', () => {
  const malicious = '</pre><script>alert(1)</script>';
  const report = { status: 'incomplete', metadata: { revision: 'abc', branch: malicious, sourceDigest: 'digest', dirty: true, startedAt: '2026-11-26T12:00:00Z', versions: {} },
    finishedAt: '2026-11-26T12:01:00Z', checks: [{ label: malicious, status: 'not_run', reason: malicious }], coverage: null, tests: null, sonar: { status: 'not_run', reason: malicious } };
  const html = renderHtml(report);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Modifiche locali presenti/);
});

test('SonarQube non configurato è registrato come non eseguito senza usare una scansione precedente', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-sonar-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'sonar.json');
  const script = fileURLToPath(new URL('../scripts/sonar-report.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, output], { cwd: directory, env: { ...process.env, SONAR_SCAN_OUTCOME: 'skipped', SONAR_TOKEN: '', SONAR_SCAN_REASON: 'Non configurato' }, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), { status: 'not_run', reason: 'Non configurato' });
});
