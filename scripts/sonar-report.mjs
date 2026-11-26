import fs from 'node:fs';
import path from 'node:path';

const output = process.argv[2] || 'quality-reports/frontend/sonar.json';
const outcome = process.env.SONAR_SCAN_OUTCOME;
let report = { status: 'not_run', reason: process.env.SONAR_SCAN_REASON || 'Scansione SonarQube non configurata o non eseguita per questo ramo.' };

try {
  if (outcome && outcome !== 'skipped') {
    if (!process.env.SONAR_TOKEN) throw new Error('Autenticazione SonarQube assente');
    const taskFile = fs.readFileSync('.scannerwork/report-task.txt', 'utf8');
    const taskId = /^ceTaskId=([\w-]+)$/m.exec(taskFile)?.[1];
    if (!taskId) throw new Error('Identificativo della scansione non disponibile');
    const query = async (endpoint, parameters) => {
      const url = new URL(endpoint, 'https://sonarcloud.io');
      url.search = new URLSearchParams(parameters).toString();
      const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.SONAR_TOKEN}` }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`API SonarQube: HTTP ${response.status}`);
      return response.json();
    };
    const { task } = await query('/api/ce/task', { id: taskId });
    if (task?.status !== 'SUCCESS' || !task.analysisId) throw new Error('Elaborazione SonarQube non completata con successo');
    const { projectStatus } = await query('/api/qualitygates/project_status', { analysisId: task.analysisId });
    if (!['OK', 'ERROR'].includes(projectStatus?.status)) throw new Error('Quality Gate non disponibile o non valutato');
    report = {
      status: projectStatus.status === 'OK' && outcome === 'success' ? 'passed' : 'failed',
      reason: 'Esito e condizioni del Quality Gate della scansione di questa esecuzione; SonarQube è inizialmente informativo.',
      analysisId: task.analysisId, gate: projectStatus.status,
      url: `https://sonarcloud.io/dashboard?id=${encodeURIComponent(process.env.SONAR_PROJECT_KEY)}`,
      conditions: projectStatus.conditions ?? [], ignoredConditions: projectStatus.ignoredConditions ?? false,
    };
  }
} catch {
  // Never copy API bodies or authentication material into public artifacts.
  report = { status: 'failed', reason: 'Impossibile acquisire un risultato SonarQube completo per questa scansione; consultare il log della GitHub Action.' };
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`SonarQube: ${report.status}`);
