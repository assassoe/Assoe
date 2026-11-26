import { coverageIncludes } from './coverage-scope.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const coverageThresholds = { lines: 95, branches: 90, functions: 100 };
export const coverageScope = coverageIncludes;

export function reportDirectory(root, requested) {
  root = path.resolve(root);
  const parent = path.join(root, 'quality-reports');
  const output = path.resolve(root, requested);
  const relative = path.relative(parent, output);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('I report devono restare nella cartella quality-reports');
  for (let directory = output; directory !== root; directory = path.dirname(directory)) {
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error('Il percorso dei report non può contenere collegamenti simbolici');
  }
  return output;
}

export function parseLcov(text) {
  const fields = { LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 };
  let files = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) files++;
    const match = /^(LF|LH|BRF|BRH|FNF|FNH):(\d+)$/.exec(line);
    if (match) fields[match[1]] += Number(match[2]);
  }
  if (!files || !fields.LF) return null;
  const metric = (hit, found) => ({ hit, found, percent: found ? 100 * hit / found : null });
  if (fields.LH > fields.LF || fields.BRH > fields.BRF || fields.FNH > fields.FNF) return null;
  return { files, lines: metric(fields.LH, fields.LF), branches: metric(fields.BRH, fields.BRF), functions: metric(fields.FNH, fields.FNF) };
}

export function parseTests(text) {
  const result = {};
  const plain = text.replace(/\u001b\[[\d;]*m/g, '');
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...plain.matchAll(new RegExp(`^(?:#|ℹ) ${key} (\\d+)\\s*$`, 'gm'))];
    if (matches.length) result[key] = Number(matches.at(-1)[1]);
  }
  return Number.isInteger(result.tests) ? result : null;
}

export function reportStatus(checks, sonar) {
  if (checks.some((check) => check.status === 'failed') || sonar.status === 'failed') return 'failed';
  if (checks.length !== 8 || checks.some((check) => check.status !== 'passed') || sonar.status !== 'passed') return 'incomplete';
  return 'passed';
}

export const labels = { passed: 'Superato', failed: 'Fallito', not_run: 'Non eseguito', incomplete: 'Incompleto' };
const percent = (metric) => metric?.percent == null ? 'Non misurato' : `${metric.percent.toFixed(2)}% (${metric.hit}/${metric.found})`;

export function renderMarkdown(report) {
  const lines = ['# Qualità del codice · Assoe', '', `**Esito: ${labels[report.status]}.**`, '',
    `Commit ${report.metadata.revision}; ramo ${report.metadata.branch}.`,
    `Cartella di lavoro: ${report.metadata.dirty ? 'con modifiche locali: il commit identifica la base, non tutti i file verificati' : 'pulita'}.`,
    `Sorgenti SHA-256: ${report.metadata.sourceDigest}.`,
    `Esecuzione: ${report.metadata.startedAt} — ${report.finishedAt}. Node ${report.metadata.node}; npm ${report.metadata.npm}.`,
    `Astro ${report.metadata.versions.astro}; TypeScript frontend ${report.metadata.versions.typescript}; TypeScript Studio ${report.metadata.versions.studioTypescript}; Sanity ${report.metadata.versions.sanity}.`, ''];
  if (report.metadata.runUrl) lines.push(`[Apri l’esecuzione GitHub](${report.metadata.runUrl})`, '');
  if (report.metadata.pullRequestHead) lines.push(`Commit della pull request: ${report.metadata.pullRequestHead}. Il commit verificato sopra può essere il merge di prova di GitHub.`, '');
  lines.push('| Controllo | Esito | Durata | Dettagli |', '| --- | --- | --- | --- |');
  for (const check of report.checks) lines.push(`| ${check.label} | ${labels[check.status]} | ${check.seconds ?? '—'} s | ${check.reason || `[Log](${check.log})`} |`);
  lines.push('', '## Test e copertura', '');
  if (report.tests) lines.push(`Test: ${report.tests.tests}; superati: ${report.tests.pass ?? '—'}; falliti: ${report.tests.fail ?? '—'}; saltati: ${report.tests.skipped ?? '—'}; annullati: ${report.tests.cancelled ?? '—'}.`, '');
  else lines.push('Conteggio dei test non disponibile.', '');
  lines.push('| Copertura LCOV | Misura | Soglia V8 applicata dal comando |', '| --- | --- | --- |');
  for (const [key, label] of Object.entries({ lines: 'Righe', branches: 'Rami', functions: 'Funzioni' })) lines.push(`| ${label} | ${percent(report.coverage?.[key])} | ${coverageThresholds[key]}% |`);
  lines.push('', `File nel report LCOV: ${report.coverage?.files ?? 'non misurati'}. Le soglie sono applicate dal test runner V8; la scheda mostra i conteggi LCOV esportati dalla stessa esecuzione. Un controllo fallito resta fallito anche quando il report parziale mostra percentuali alte.`, '',
    'Perimetro della copertura:', '', ...coverageScope.map((scope) => `- \`${scope}\``), '',
    'Sono esclusi dalla copertura V8 componenti e pagine Astro, CSS e interfaccia React. Le percentuali non misurano la copertura dei requisiti.', '',
    '## SonarQube Cloud', '', `**${labels[report.sonar.status]}** — ${report.sonar.reason}`, '');
  if (report.sonar.url) lines.push(`[Apri SonarQube](${report.sonar.url})`, '');
  if (report.sonar.analysisId) lines.push(`Analisi: ${report.sonar.analysisId}; Quality Gate: ${report.sonar.gate}.`, '');
  if (report.sonar.conditions?.length) {
    lines.push('| Condizione SonarQube | Valore | Soglia | Esito |', '| --- | --- | --- | --- |');
    for (const condition of report.sonar.conditions) lines.push(`| ${condition.metricKey} | ${condition.actualValue ?? 'Non misurato'} | ${condition.comparator} ${condition.errorThreshold} | ${condition.status} |`);
    lines.push('');
  }
  lines.push('I file .astro non sono inclusi nella scansione SonarQube. La copertura SonarQube usa il proprio perimetro di sorgenti e può differire dalla copertura V8. Le condizioni riferite al nuovo codice non descrivono tutto il progetto.', '',
    '## Limiti della valutazione', '',
    '- Il report documenta misure tecniche; non costituisce una certificazione ISO.',
    '- Build e verifica HTML leggono i contenuti Sanity disponibili durante l’esecuzione; il dataset non è congelato dal commit.',
    '- Gli audit dipendono dalle advisory disponibili al momento. “Superato” significa che è rispettata la politica dello script, che può prevedere eccezioni documentate; consultare i log.',
    '- Gli artefatti GitHub scadono secondo la durata configurata. Scaricare quelli da conservare stabilmente.',
    '- Il workflow Pages resta separato: questo report non introduce un blocco del deploy o delle integrazioni.', '');
  return lines.join('\n');
}

export function renderHtml(report) {
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rows = report.checks.map((check) => `<tr><td>${escape(check.label)}</td><td>${escape(labels[check.status])}</td><td>${check.seconds ?? '—'} s</td><td>${check.reason ? escape(check.reason) : `<a href="${escape(check.log)}">Apri log</a>`}</td></tr>`).join('');
  const cards = Object.entries({ lines: 'Righe', branches: 'Rami', functions: 'Funzioni' }).map(([key, label]) => `<div class="card"><span>${label}</span><strong>${escape(percent(report.coverage?.[key]))}</strong><small>Soglia V8 ${coverageThresholds[key]}%</small></div>`).join('');
  return `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qualità del codice · Assoe</title><style>
  :root{color-scheme:light;--ink:#16372d;--muted:#53675f;--paper:#f3f6f3;--line:#cbd7ce;--surface:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.2}h2{margin-top:36px}.meta,small{color:var(--muted)}code{overflow-wrap:anywhere}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{background:var(--surface);border:1px solid var(--line);padding:20px;border-radius:12px}.card strong{display:block;font-size:24px}.card span,small{display:block}table{width:100%;border-collapse:collapse;background:var(--surface)}td,th{padding:12px;text-align:left;border-bottom:1px solid var(--line)}.table{overflow:auto}a{color:var(--ink)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--surface);padding:20px;border:1px solid var(--line)}.status{font-weight:700;font-size:22px}details{margin-top:32px}summary{cursor:pointer;font-weight:600}</style><main>
  <p class="meta">ASSOE · REPORT TECNICO</p><h1>Qualità del codice</h1><p class="status">${escape(labels[report.status])}</p>
  <p>Commit <code>${escape(report.metadata.revision)}</code><br>Ramo ${escape(report.metadata.branch)} · ${escape(new Date(report.finishedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }))} (Europe/Rome)</p>
  <p>${report.metadata.dirty ? 'Modifiche locali presenti: il commit identifica la base del codice verificato.' : 'Cartella di lavoro pulita.'} <a href="report.json">Dati JSON</a> · <a href="report.md">Report Markdown</a></p>
  <div class="cards">${cards}</div><p>Copertura LCOV del perimetro dichiarato · ${report.coverage?.files ?? '—'} file · ${report.tests?.pass ?? '—'}/${report.tests?.tests ?? '—'} test superati.</p>
  <h2>Controlli eseguiti</h2><div class="table"><table><thead><tr><th>Controllo</th><th>Esito</th><th>Durata</th><th>Dettagli</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2>SonarQube Cloud</h2><p><strong>${escape(labels[report.sonar.status])}.</strong> ${escape(report.sonar.reason)}</p>
  <p>I file Astro richiedono controlli dedicati. La misura non costituisce una certificazione ISO.</p>
  <details><summary>Perimetro, risultati SonarQube e limiti della misura</summary><pre>${escape(renderMarkdown(report))}</pre></details></main></html>`;
}
