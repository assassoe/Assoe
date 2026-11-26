import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { coverageIncludes, missingCoverage } from './coverage-scope.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-coverage-'));
const report = path.join(temporary, 'lcov.info');
const retainedReport = path.resolve(root, process.env.COVERAGE_REPORT_PATH || 'coverage/lcov.info');
fs.mkdirSync(path.dirname(retainedReport), { recursive: true });
fs.rmSync(retainedReport, { force: true });

try {
  const tests = fs.readdirSync(path.join(root, 'tests')).filter((file) => file.endsWith('.test.mjs'))
    .map((file) => path.join('tests', file));
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', '--experimental-test-coverage',
    ...coverageIncludes.map((pattern) => `--test-coverage-include=${pattern}`),
    '--test-coverage-lines=95', '--test-coverage-branches=90', '--test-coverage-functions=100',
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=lcov', `--test-reporter-destination=${report}`,
    '--test', ...tests,
  ], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (fs.existsSync(report)) fs.copyFileSync(report, retainedReport);
  process.exitCode = result.status ?? 1;
  const missing = missingCoverage(root, fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '');
  if (missing.length) {
    console.error(`Moduli senza copertura:\n${missing.map((file) => `- ${file}`).join('\n')}`);
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
