import type { Scenario, ExpectedFeature } from './types';
import type { ScenarioSummary, CompletedFeatureSummary } from '../../src/test-bridge/scenarioBridge';
import type { StepLogEntry } from './runScenario';

export interface ExpectCheck {
  field: string;
  expected: string;
  actual: string;
  ok: boolean;
}

function featureMatches(want: ExpectedFeature, got: CompletedFeatureSummary): boolean {
  return got.kind === want.kind
    && (want.points === undefined || got.points === want.points)
    && (want.tiles === undefined || got.tiles === want.tiles)
    && (want.shieldCount === undefined || got.shieldCount === want.shieldCount);
}

function formatFeature(f: ExpectedFeature | CompletedFeatureSummary): string {
  const parts = [f.kind];
  if ('points' in f && f.points !== undefined) parts.push(`${f.points} pts`);
  if ('tiles' in f && f.tiles !== undefined) parts.push(`${f.tiles} tiles`);
  if ('shieldCount' in f && f.shieldCount !== undefined && f.shieldCount > 0) parts.push(`${f.shieldCount} shield(s)`);
  return parts.join(', ');
}

/** Evaluate every `expect` field and return one row per assertion. */
export function evaluateExpectations(scenario: Scenario, summary: ScenarioSummary): ExpectCheck[] {
  const checks: ExpectCheck[] = [];
  const e = scenario.expect;
  const byName = new Map(summary.players.map(p => [p.name, p]));

  if (e.phase) {
    checks.push({
      field: 'phase',
      expected: e.phase,
      actual: summary.phase,
      ok: summary.phase === e.phase,
    });
  }

  if (e.scores) {
    for (const [name, exp] of Object.entries(e.scores)) {
      const p = byName.get(name);
      checks.push({
        field: `scores.${name}`,
        expected: String(exp),
        actual: p ? String(p.score) : '(player missing)',
        ok: p?.score === exp,
      });
    }
  }

  if (e.meeplesAvailable) {
    for (const [name, exp] of Object.entries(e.meeplesAvailable)) {
      const p = byName.get(name);
      checks.push({
        field: `meeplesAvailable.${name}`,
        expected: String(exp),
        actual: p ? String(p.meeplesAvailable) : '(player missing)',
        ok: p?.meeplesAvailable === exp,
      });
    }
  }

  if (typeof e.placedTiles === 'number') {
    checks.push({
      field: 'placedTiles',
      expected: String(e.placedTiles),
      actual: String(summary.placedTiles),
      ok: summary.placedTiles === e.placedTiles,
    });
  }

  if (typeof e.deckRemaining === 'number') {
    checks.push({
      field: 'deckRemaining',
      expected: String(e.deckRemaining),
      actual: String(summary.deckRemaining),
      ok: summary.deckRemaining === e.deckRemaining,
    });
  }

  if (e.deckCounts) {
    for (const [id, exp] of Object.entries(e.deckCounts)) {
      const got = summary.deckCounts[id] ?? 0;
      checks.push({
        field: `deckCounts.${id}`,
        expected: String(exp),
        actual: String(got),
        ok: got === exp,
      });
    }
  }

  if (typeof e.deckTotalTiles === 'number') {
    const total = summary.deckRemaining + (summary.pendingTileId ? 1 : 0);
    checks.push({
      field: 'deckTotalTiles',
      expected: String(e.deckTotalTiles),
      actual: String(total),
      ok: total === e.deckTotalTiles,
    });
  }

  if (e.completedFeatures) {
    const remaining = [...summary.completedFeatures];
    for (let i = 0; i < e.completedFeatures.length; i++) {
      const want = e.completedFeatures[i];
      const idx = remaining.findIndex(got => featureMatches(want, got));
      const got = idx === -1 ? null : remaining.splice(idx, 1)[0];
      checks.push({
        field: `completedFeatures[${i}]`,
        expected: formatFeature(want),
        actual: got ? formatFeature(got) : '(no matching feature)',
        ok: got !== null,
      });
    }
  }

  return checks;
}

export function allChecksPassed(checks: ExpectCheck[]): boolean {
  return checks.every(c => c.ok);
}

/** Plain-text recap for attachments / terminal. */
export function formatExpectRecapText(scenario: Scenario, checks: ExpectCheck[]): string {
  const passed = allChecksPassed(checks);
  const lines = [
    `Scenario: ${scenario.name}`,
    ...(scenario.description?.trim()
      ? ['', scenario.description.trim(), '']
      : ['']),
    `Result: ${passed ? 'PASS' : 'FAIL'}`,
    '',
    'Expect recap:',
    '  field                          expected              actual                ok',
    '  ' + '-'.repeat(78),
  ];
  for (const c of checks) {
    const mark = c.ok ? '✓' : '✗';
    lines.push(
      `  ${c.field.padEnd(30)} ${c.expected.padEnd(20)} ${c.actual.padEnd(20)} ${mark}`,
    );
  }
  return lines.join('\n');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ScenarioReportInput {
  scenario: Scenario;
  summary: ScenarioSummary;
  checks: ExpectCheck[];
  stepLog: StepLogEntry[];
  screenshotBase64?: string;
  errorMessage?: string;
}

/** Self-contained HTML report: expect table + screenshot up front, steps folded. */
export function buildScenarioReportHtml(input: ScenarioReportInput): string {
  const { scenario, summary, checks, stepLog, screenshotBase64, errorMessage } = input;
  const passed = allChecksPassed(checks);

  const checkRows = checks.map(c => `
    <tr class="${c.ok ? 'pass' : 'fail'}">
      <td><code>${esc(c.field)}</code></td>
      <td>${esc(c.expected)}</td>
      <td>${esc(c.actual)}</td>
      <td class="mark">${c.ok ? '✓' : '✗'}</td>
    </tr>`).join('');

  const stepItems = stepLog.map(s => {
    const meeple = s.meepleAction ? ` · meeple: ${s.meepleAction}` : '';
    const status = s.ok ? 'ok' : 'failed';
    const detail = s.error ? ` — ${esc(s.error)}` : '';
    return `<li class="${status}"><strong>Step ${s.index}</strong> ${esc(s.tile)} @ (${s.at.x}, ${s.at.y}) rot ${s.rotation}${meeple}${detail}</li>`;
  }).join('');

  const boardImg = screenshotBase64
    ? `<img class="board" src="data:image/png;base64,${screenshotBase64}" alt="Final game view" />`
    : '<p class="muted">Game screenshot unavailable</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(scenario.name)} — scenario report</title>
  <style>
    :root { --pass: #1a7f37; --fail: #cf222e; --bg: #f6f8fa; --border: #d0d7de; }
    * { box-sizing: border-box; }
    body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: var(--bg); color: #1f2328; }
    h1 { margin: 0 0 4px; font-size: 1.35rem; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 600; font-size: 12px; }
    .badge.pass { background: #dafbe1; color: var(--pass); }
    .badge.fail { background: #ffebe9; color: var(--fail); }
    .desc { color: #656d76; margin: 0 0 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    section { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
    th { background: #f6f8fa; font-weight: 600; }
    tr.pass td { background: #f6ffed; }
    tr.fail td { background: #fff5f5; }
    .mark { font-weight: 700; text-align: center; width: 2rem; }
    tr.pass .mark { color: var(--pass); }
    tr.fail .mark { color: var(--fail); }
    .board { max-width: 100%; border-radius: 6px; border: 1px solid var(--border); background: #2d5016; }
    .meta { font-size: 12px; color: #656d76; margin-top: 8px; }
    .error { background: #fff5f5; border: 1px solid #ff8182; color: var(--fail); padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; white-space: pre-wrap; }
    details { margin-top: 20px; background: #fff; border: 1px solid var(--border); border-radius: 8px; }
    details summary { cursor: pointer; padding: 12px 16px; font-weight: 600; list-style: none; }
    details summary::-webkit-details-marker { display: none; }
    details summary::before { content: '▸ '; color: #656d76; }
    details[open] summary::before { content: '▾ '; }
    details .steps-body { padding: 0 16px 14px; border-top: 1px solid var(--border); }
    ol.steps { margin: 10px 0 0; padding-left: 20px; }
    ol.steps li { margin: 4px 0; }
    ol.steps li.failed { color: var(--fail); }
    .muted { color: #656d76; }
  </style>
</head>
<body>
  <h1>${esc(scenario.name)} <span class="badge ${passed ? 'pass' : 'fail'}">${passed ? 'PASS' : 'FAIL'}</span></h1>
  ${scenario.description ? `<p class="desc">${esc(scenario.description.trim())}</p>` : ''}
  ${errorMessage ? `<div class="error">${esc(errorMessage)}</div>` : ''}

  <div class="grid">
    <section>
      <h2>Expectations</h2>
      <table>
        <thead><tr><th>Field</th><th>Expected</th><th>Actual</th><th></th></tr></thead>
        <tbody>${checkRows || '<tr><td colspan="4" class="muted">No expect fields</td></tr>'}</tbody>
      </table>
      <p class="meta">phase=${esc(summary.phase)} · placedTiles=${summary.placedTiles}</p>
    </section>
    <section>
      <h2>Final game view</h2>
      ${boardImg}
    </section>
  </div>

  <details>
    <summary>Test steps (${stepLog.length})</summary>
    <div class="steps-body">
      <ol class="steps">${stepItems || '<li class="muted">No steps recorded</li>'}</ol>
    </div>
  </details>
</body>
</html>`;
}
