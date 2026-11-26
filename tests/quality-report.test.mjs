import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLcov, parseTests, reportStatus, renderHtml, renderMarkdown, reportDirectory } from '../scripts/quality-report-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function reportOutput(t) {
  fs.mkdirSync(path.join(root, 'quality-reports'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'quality-reports/test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

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
  const output = reportOutput(t);
  const run = () => spawnSync(process.execPath, [script, '--merge', directory, '--output', output], { encoding: 'utf8' });
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
  const output = path.join(directory, 'quality-reports/frontend/sonar.json');
  const script = fileURLToPath(new URL('../scripts/sonar-report.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], { cwd: directory, env: { ...process.env, SONAR_SCAN_OUTCOME: 'skipped', SONAR_TOKEN: '', SONAR_SCAN_REASON: 'Non configurato' }, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), { status: 'not_run', reason: 'Non configurato' });
});

test('l’output del report resta nella cartella prevista e rifiuta traversal e symlink', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-output-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const parent = path.join(directory, 'quality-reports');
  fs.mkdirSync(parent);
  assert.equal(reportDirectory(directory, 'quality-reports/valid/report'), path.join(parent, 'valid/report'));
  assert.equal(reportDirectory(directory, parent), parent);
  for (const unsafe of ['.', '..', 'quality-reports/../../escape', path.join(os.tmpdir(), 'elsewhere')]) {
    assert.throws(() => reportDirectory(directory, unsafe), /quality-reports/);
  }
  fs.symlinkSync(os.tmpdir(), path.join(parent, 'linked'));
  assert.throws(() => reportDirectory(directory, 'quality-reports/linked/report'), /simbolici/);
});

function runFakeChecks(t, extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-checks-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = reportOutput(t);
  const cli = path.join(directory, 'npm-cli.cjs');
  fs.writeFileSync(cli, `const fs=require('node:fs');
    const command=process.argv.slice(2).join(' ');
    if(command==='--version') {console.log('test-npm'); process.exit(0)}
    if(command==='test') console.log('# tests 3\\n# pass 3\\n# fail 0\\n# skipped 0');
    if(command==='run test:coverage') fs.writeFileSync(process.env.COVERAGE_REPORT_PATH,'SF:src/utils/example.ts\\nLF:10\\nLH:10\\nBRF:2\\nBRH:2\\nFNF:1\\nFNH:1\\nend_of_record\\n');
    if(command===process.env.TEST_FAIL_COMMAND) process.exit(1);
  `);
  const script = path.join(root, 'scripts/quality-report.mjs');
  const result = spawnSync(process.execPath, [script, '--output', output], { encoding: 'utf8', env: { ...process.env, npm_execpath: cli, GITHUB_STEP_SUMMARY: path.join(directory, 'summary.md'), ...extra } });
  const reportFile = path.join(output, 'report.json');
  return { ...result, report: fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null, output };
}

test('il runner raccoglie prove, conteggi e log anche senza uno scanner configurato', (t) => {
  const result = runFakeChecks(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.checks.length, 8);
  assert.ok(result.report.checks.every(check => check.status === 'passed'));
  assert.equal(result.report.tests.tests, 3);
  assert.equal(result.report.coverage.lines.percent, 100);
  assert.equal(result.report.metadata.npm, 'test-npm');
  for (const check of result.report.checks) assert.ok(fs.existsSync(path.join(result.output, check.log)));
  assert.ok(fs.existsSync(path.join(result.output, 'report.html')));
});

test('una build fallita impedisce la verifica di un vecchio HTML ma non nasconde gli audit', (t) => {
  const result = runFakeChecks(t, { TEST_FAIL_COMMAND: 'run build' });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.report.status, 'failed');
  assert.equal(result.report.checks.find(check => check.id === 'frontend-html').status, 'not_run');
  assert.equal(result.report.checks.find(check => check.id === 'frontend-audit').status, 'passed');
  assert.equal(result.report.checks.find(check => check.id === 'studio-audit').status, 'passed');
});

test('il consolidamento conserva prove, perimetro e risultato della specifica analisi SonarQube', (t) => {
  const original = runFakeChecks(t).report;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-merge-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const group of ['frontend', 'studio']) {
    const destination = path.join(directory, group);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'result.json'), JSON.stringify({ ...original, checks: original.checks.filter(check => check.id.startsWith(group)) }));
    fs.mkdirSync(path.join(destination, 'logs'));
    fs.writeFileSync(path.join(destination, 'logs', `${group}.log`), 'evidence');
  }
  fs.writeFileSync(path.join(directory, 'frontend/lcov.info'), 'coverage evidence');
  fs.writeFileSync(path.join(directory, 'frontend/sonar.json'), JSON.stringify({ status: 'passed', reason: 'Gate della scansione test', analysisId: 'specific-analysis', gate: 'OK' }));
  const output = reportOutput(t);
  const summary = path.join(directory, 'summary.md');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/quality-report.mjs'), '--merge', directory, '--output', output], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary } });
  assert.equal(result.status, 0, result.stderr);
  const merged = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
  assert.equal(merged.status, 'passed');
  assert.deepEqual(merged.checks, original.checks);
  assert.equal(merged.sonar.analysisId, 'specific-analysis');
  assert.equal(fs.readFileSync(path.join(output, 'lcov.info'), 'utf8'), 'coverage evidence');
  assert.match(fs.readFileSync(summary, 'utf8'), /specific-analysis/);
});

function runSonar(t, mode = 'ok', extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-sonar-fetch-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, '.scannerwork'));
  if (mode !== 'missing-task') fs.writeFileSync(path.join(directory, '.scannerwork/report-task.txt'), mode === 'invalid-task' ? 'ceTaskId=../../outside' : 'ceTaskId=task-1\n');
  const mock = path.join(directory, 'fetch.mjs');
  fs.writeFileSync(mock, `globalThis.fetch=async function(url) {
    if(url.origin!=='https://sonarcloud.io') throw new Error('Unexpected API origin');
    const mode=process.env.TEST_SONAR_MODE;
    if(mode==='network') throw new Error('private response must not leak');
    return {ok:mode!=='http',status:mode==='http'?403:200,json:async()=>url.pathname==='/api/ce/task'
      ? {task:{status:mode==='pending'?'PENDING':'SUCCESS',analysisId:mode==='no-analysis'?null:'analysis-1'}}
      : {projectStatus:{status:mode==='no-gate'?'NONE':mode==='gate-failed'?'ERROR':'OK',conditions:[{metricKey:'new_coverage',actualValue:'90',comparator:'LT',errorThreshold:'80',status:'OK'}],ignoredConditions:false}}};
  };`);
  const script = path.join(root, 'scripts/sonar-report.mjs');
  const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${pathToFileURL(mock).href}`, TEST_SONAR_MODE: mode, SONAR_TOKEN: 'test-token-not-a-real-secret', SONAR_PROJECT_KEY: 'test_project', SONAR_SCAN_OUTCOME: 'success', SONAR_PULL_REQUEST: '6', ...extra } });
  const reportFile = path.join(directory, 'quality-reports/frontend/sonar.json');
  return { ...result, report: fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null, directory };
}

test('SonarQube usa il task e il gate della scansione e collega la pull request corretta', (t) => {
  const result = runSonar(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.status, 'passed');
  assert.equal(result.report.analysisId, 'analysis-1');
  assert.equal(result.report.conditions[0].actualValue, '90');
  assert.equal(result.report.url, 'https://sonarcloud.io/dashboard?id=test_project&pullRequest=6');
  const main = runSonar(t, 'ok', { SONAR_PULL_REQUEST: '' });
  assert.equal(main.report.url, 'https://sonarcloud.io/dashboard?id=test_project');
  assert.match(renderMarkdown({ ...runFakeChecks(t).report, sonar: result.report }), /new_coverage/);
});

test('gate falliti e scansioni non riuscite non diventano risultati positivi', (t) => {
  assert.equal(runSonar(t, 'gate-failed').report.status, 'failed');
  assert.equal(runSonar(t, 'ok', { SONAR_SCAN_OUTCOME: 'failure' }).report.status, 'failed');
  for (const mode of ['missing-task', 'invalid-task', 'pending', 'no-analysis', 'no-gate', 'http', 'network']) {
    const result = runSonar(t, mode);
    assert.equal(result.report.status, 'failed', mode);
    assert.doesNotMatch(JSON.stringify(result.report), /private response|test-token/);
  }
  assert.equal(runSonar(t, 'ok', { SONAR_TOKEN: '' }).report.status, 'failed');
});

test('l’esportatore SonarQube rifiuta percorsi CLI e non scrive fuori dalla destinazione fissa', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-sonar-path-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const outside = path.join(directory, 'must-not-exist.json');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/sonar-report.mjs'), outside], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /percorso.*fisso/);
  assert.equal(fs.existsSync(outside), false);
});
