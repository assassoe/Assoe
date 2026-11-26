import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseLcov, parseTests, reportStatus, renderMarkdown, renderHtml, coverageScope, coverageThresholds } from './quality-report-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const group = option('--group', 'all');
if (!['all', 'frontend', 'studio'].includes(group)) throw new Error('Gruppo non valido');
const output = path.resolve(root, option('--output', `quality-reports/${group === 'all' ? 'local' : group}`));
fs.mkdirSync(output, { recursive: true });

function git(...gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Impossibile identificare i sorgenti Git');
  return result.stdout.trim();
}

function metadata() {
  const hash = createHash('sha256');
  const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean).sort();
  // Hash source/configuration files only; never open environment or credential files.
  for (const name of files.filter((name) => !/(^|\/)\.env(?:\.|$)/.test(name) && /\.(?:[cm]?[jt]sx?|astro|css|json|yml|yaml|properties)$/.test(name))) {
    hash.update(name).update('\0');
    if (fs.existsSync(path.join(root, name))) hash.update(fs.readFileSync(path.join(root, name)));
    else hash.update('[deleted]');
    hash.update('\0');
  }
  const frontend = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const studio = JSON.parse(fs.readFileSync(path.join(root, 'studio/package-lock.json'), 'utf8'));
  return {
    revision: git('rev-parse', 'HEAD'), branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git('branch', '--show-current'),
    dirty: Boolean(git('status', '--porcelain')), sourceDigest: hash.digest('hex'), startedAt: new Date().toISOString(),
    node: process.version, npm: spawnSync('npm', ['--version'], { encoding: 'utf8' }).stdout.trim(),
    versions: { astro: frontend.packages['node_modules/astro'].version, typescript: frontend.packages['node_modules/typescript'].version,
      studioTypescript: studio.packages['node_modules/typescript'].version, sanity: studio.packages['node_modules/sanity'].version },
    runUrl: process.env.GITHUB_ACTIONS ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/attempts/${process.env.GITHUB_RUN_ATTEMPT}` : null,
    pullRequestHead: process.env.QUALITY_PR_HEAD_SHA || null,
  };
}

function execute(id, label, command, parameters, dependency) {
  if (dependency && dependency.status !== 'passed') return { id, label, status: 'not_run', reason: 'Richiede una build riuscita nella stessa esecuzione' };
  const filename = `logs/${id}.log`;
  fs.mkdirSync(path.join(output, 'logs'), { recursive: true });
  console.log(`In corso: ${label}`);
  const started = Date.now();
  const descriptor = fs.openSync(path.join(output, filename), 'w');
  let result;
  try {
    result = spawnSync(command, parameters, { cwd: root, stdio: ['ignore', descriptor, descriptor], timeout: 15 * 60 * 1000,
      env: { ...process.env, NO_COLOR: '1', COVERAGE_REPORT_PATH: path.join(output, 'lcov.info') } });
    if (result.error || result.signal) fs.writeSync(descriptor, `\nProcesso non completato: ${result.error?.code || result.signal}\n`);
  } finally { fs.closeSync(descriptor); }
  const check = { id, label, command: [command, ...parameters].join(' '), status: result.status === 0 && !result.error ? 'passed' : 'failed',
    exitCode: result.status, seconds: Math.round((Date.now() - started) / 100) / 10, log: filename };
  console.log(`${label}: ${check.status} (${check.seconds}s)`);
  return check;
}

const missingSonar = { status: 'not_run', reason: 'Progetto SonarQube Cloud e autenticazione non configurati; nessuna misura SonarQube disponibile.' };
let report;
if (args.includes('--merge')) {
  const input = path.resolve(root, option('--merge'));
  const parts = ['frontend', 'studio'].map((name) => {
    const source = path.join(input, name);
    const filename = path.join(source, 'result.json');
    if (!fs.existsSync(filename)) throw new Error(`Report ${name} mancante: la valutazione non è completa`);
    const part = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (fs.existsSync(path.join(source, 'logs'))) fs.cpSync(path.join(source, 'logs'), path.join(output, 'logs'), { recursive: true });
    if (fs.existsSync(path.join(source, 'lcov.info'))) fs.copyFileSync(path.join(source, 'lcov.info'), path.join(output, 'lcov.info'));
    return part;
  });
  if (parts[0].metadata.revision !== parts[1].metadata.revision || parts[0].metadata.sourceDigest !== parts[1].metadata.sourceDigest) throw new Error('I report appartengono a sorgenti diversi');
  const sonarFile = path.join(input, 'frontend', 'sonar.json');
  report = { ...parts[0], checks: parts.flatMap((part) => part.checks), sonar: fs.existsSync(sonarFile) ? JSON.parse(fs.readFileSync(sonarFile, 'utf8')) : missingSonar };
} else {
  report = { schemaVersion: 1, metadata: metadata(), checks: [], tests: null, coverage: null, coverageScope, coverageThresholds, sonar: missingSonar };
  const run = (...parameters) => { const check = execute(...parameters); report.checks.push(check); return check; };
  if (group !== 'studio') {
    run('frontend-types', 'Tipi e componenti Astro', 'npm', ['run', 'check']);
    run('frontend-tests', 'Test automatici', 'npm', ['test']);
    run('frontend-coverage', 'Copertura e soglie V8', 'npm', ['run', 'test:coverage']);
    const build = run('frontend-build', 'Build reale del sito', 'npm', ['run', 'build']);
    run('frontend-html', 'Verifica HTML generato', 'npm', ['run', 'check:build'], build);
    run('frontend-audit', 'Audit dipendenze di produzione', 'npm', ['audit', '--omit=dev', '--audit-level=high']);
    report.tests = parseTests(fs.readFileSync(path.join(output, 'logs/frontend-tests.log'), 'utf8'));
    if (fs.existsSync(path.join(output, 'lcov.info'))) report.coverage = parseLcov(fs.readFileSync(path.join(output, 'lcov.info'), 'utf8'));
  }
  if (group !== 'frontend') {
    run('studio-build', 'Build Studio Sanity', 'npm', ['--prefix', 'studio', 'run', 'build']);
    run('studio-audit', 'Audit Studio e politica advisory', 'npm', ['--prefix', 'studio', 'run', 'audit:high']);
  }
}
report.finishedAt = new Date().toISOString();
report.status = reportStatus(report.checks, report.sonar);
fs.writeFileSync(path.join(output, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = renderMarkdown(report);
fs.writeFileSync(path.join(output, 'report.md'), markdown);
fs.writeFileSync(path.join(output, 'report.html'), renderHtml(report));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(`Report: ${path.join(output, 'report.html')}\nEsito: ${report.status}`);
// Sonar is advisory initially; existing mandatory checks retain their failures.
process.exitCode = report.checks.some((check) => check.status !== 'passed') ? 1 : 0;
