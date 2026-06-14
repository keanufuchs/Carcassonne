/**
 * Writes a GitHub Actions job summary listing scenario results and artifacts.
 * Reads playwright-report/results.json (CI only) and tests/scenarios/*.yaml.
 */
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (!summaryPath) process.exit(0);

const outcome = process.env.TEST_OUTCOME ?? 'unknown';
const scenarioDir = 'tests/scenarios';
const resultsPath = 'playwright-report/results.json';

function loadYamlScenarios() {
  const files = readdirSync(scenarioDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  return files.map(file => {
    const raw = yaml.load(readFileSync(join(scenarioDir, file), 'utf8'));
    return {
      name: raw?.name ?? file,
      description: typeof raw?.description === 'string' ? raw.description.trim() : '',
    };
  });
}

function loadPlaywrightResults() {
  if (!existsSync(resultsPath)) return new Map();
  const report = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const byTitle = new Map();

  function walkSuites(suites) {
    for (const suite of suites ?? []) {
      walkSuites(suite.suites);
      for (const spec of suite.specs ?? []) {
        byTitle.set(spec.title, spec.ok);
      }
    }
  }

  walkSuites(report.suites);
  return byTitle;
}

const scenarios = loadYamlScenarios();
const results = loadPlaywrightResults();
const lines = [];

lines.push('## Scenario tests');
lines.push('');
lines.push(outcome === 'success' ? '**Result:** ✅ All scenarios passed' : '**Result:** ❌ One or more scenarios failed');
lines.push('');
lines.push('### Scenarios');
lines.push('');
lines.push('| Scenario | Status | Description |');
lines.push('|----------|--------|-------------|');

for (const s of scenarios) {
  const ok = results.get(s.name);
  const status = ok === true ? '✅ pass' : ok === false ? '❌ fail' : '—';
  const desc = s.description.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  lines.push(`| \`${s.name}\` | ${status} | ${desc || '—'} |`);
}

lines.push('');
lines.push('### Artifacts');
lines.push('');
lines.push('Reports are stored as a GitHub Actions artifact (not committed to the repo).');
lines.push('');
lines.push('1. Scroll to **Artifacts** at the bottom of this workflow run.');
lines.push('2. Download **`playwright-report`**.');
lines.push('3. Open **`index.html`** in a browser.');
lines.push('');
lines.push('| Attachment (per scenario) | Format |');
lines.push('|---------------------------|--------|');
lines.push('| `scenario-report` | HTML — description, expect table, board screenshot |');
lines.push('| `expect-recap` | Plain text |');
lines.push('| `final-board` | PNG |');

appendFileSync(summaryPath, lines.join('\n') + '\n');
