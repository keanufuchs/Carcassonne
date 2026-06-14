import { test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScenario } from './scenario/loadScenario';
import { runScenario } from './scenario/runScenario';
import { assertScenario } from './scenario/assertions';
import {
  evaluateExpectations,
  formatExpectRecapText,
  buildScenarioReportHtml,
  allChecksPassed,
} from './scenario/expectRecap';
import type { ScenarioSummary } from '../src/test-bridge/scenarioBridge';
import type { StepLogEntry } from './scenario/runScenario';
import { fitBoardForScreenshot } from './scenario/fitBoardForScreenshot';

const SCENARIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'scenarios');

const files = readdirSync(SCENARIO_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

async function captureBoardScreenshot(page: import('@playwright/test').Page): Promise<Buffer | undefined> {
  await fitBoardForScreenshot(page);
  const board = page.locator('[data-testid="board-scroll"]');
  if (await board.count() === 0) return undefined;
  return board.screenshot();
}

async function readSummary(page: import('@playwright/test').Page): Promise<ScenarioSummary | undefined> {
  return page.evaluate(() => window.__carcTest?.getSummary?.()).catch(() => undefined);
}

test.describe('YAML game-logic scenarios', () => {
  if (files.length === 0) {
    test('no scenarios found', () => {
      throw new Error(`No *.yaml scenarios in ${SCENARIO_DIR}`);
    });
  }

  for (const file of files) {
    // Loaded at collection time → one named test per file.
    // Run one: npx playwright test -g "<name>"   ·   all: npm run test:scenarios
    const scenario = loadScenario(join(SCENARIO_DIR, file));
    const desc = scenario.description?.trim();

    test(scenario.name, {
      annotation: desc ? [{ type: 'description', description: desc }] : [],
    }, async ({ page }, testInfo) => {
      let summary: ScenarioSummary | undefined;
      let stepLog: StepLogEntry[] = [];
      let runError: string | undefined;

      try {
        // Boxed parent step: keeps per-placement noise out of the default report view.
        const result = await test.step(
          `Placement steps (${scenario.steps.length})`,
          async () => runScenario(page, scenario),
          { box: true },
        );
        summary = result.summary;
        stepLog = result.stepLog;
      } catch (err) {
        runError = err instanceof Error ? err.message : String(err);
        summary = await readSummary(page);
      }

      const screenshot = await captureBoardScreenshot(page).catch(() => undefined);

      if (summary) {
        const checks = evaluateExpectations(scenario, summary);
        const passed = allChecksPassed(checks);
        const recapText = formatExpectRecapText(scenario, checks);

        await testInfo.attach('scenario-report', {
          body: buildScenarioReportHtml({
            scenario,
            summary,
            checks,
            stepLog,
            screenshotBase64: screenshot?.toString('base64'),
            errorMessage: runError,
          }),
          contentType: 'text/html',
        });

        await testInfo.attach('expect-recap', {
          body: recapText,
          contentType: 'text/plain',
        });

        if (screenshot) {
          await testInfo.attach('final-board', {
            body: screenshot,
            contentType: 'image/png',
          });
        }

        testInfo.annotations.push({
          type: passed && !runError ? 'pass' : 'fail',
          description: passed && !runError
            ? `All ${checks.length} expect checks passed`
            : `${checks.filter(c => !c.ok).length} expect check(s) failed`,
        });
      }

      if (runError) throw new Error(runError);
      if (summary) assertScenario(scenario, summary);
    });
  }
});
