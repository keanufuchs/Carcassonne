import { expect, type Page } from '@playwright/test';
import type { Scenario, ScenarioStep } from './types';
import type { ScenarioSummary } from '../../src/test-bridge/scenarioBridge';

const WAIT = { timeout: 10_000 };

export interface StepLogEntry {
  index: number;
  tile: string;
  at: { x: number; y: number };
  rotation: number;
  meepleAction?: string;
  ok: boolean;
  error?: string;
}

export interface ScenarioRunResult {
  summary: ScenarioSummary;
  stepLog: StepLogEntry[];
}

/**
 * Drive one scenario in a real browser against the real engine + 2D UI:
 *   seed 2D view → start deterministic deck → per-step real DOM clicks → summary.
 * Throws with an actionable message (incl. step context) on any failure.
 */
export async function runScenario(page: Page, scenario: Scenario): Promise<ScenarioRunResult> {
  const stepLog: StepLogEntry[] = [];

  // Boot straight into the 2D BoardView (no toggle click) by seeding the same
  // localStorage key loadBoardViewMode() reads, before the app mounts.
  await page.addInitScript(() => {
    try { localStorage.setItem('carc_board_view', '2d'); } catch { /* ignore */ }
  });

  await page.goto('/');
  await page.waitForFunction(() => !!window.__carcTest, null, WAIT);

  const deck = [...scenario.steps.map(s => s.tile), ...(scenario.padding ?? [])];
  await page.evaluate(
    ({ players, deck }) => window.__carcTest!.startScenario({ players, deck }),
    { players: scenario.players, deck },
  );

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    try {
      await runStep(page, step, i);
      stepLog.push({
        index: i,
        tile: step.tile,
        at: step.at,
        rotation: step.rotation ?? 0,
        meepleAction: describeMeepleAction(step),
        ok: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stepLog.push({
        index: i,
        tile: step.tile,
        at: step.at,
        rotation: step.rotation ?? 0,
        meepleAction: describeMeepleAction(step),
        ok: false,
        error: message,
      });
      throw err;
    }
  }

  if (scenario.endGame) {
    await page.evaluate(() => window.__carcTest!.endGame());
  }

  const summary = await page.evaluate(() => window.__carcTest!.getSummary());
  return { summary, stepLog };
}

function describeMeepleAction(step: ScenarioStep): string | undefined {
  if (step.meeple) return `segment ${step.meeple.segment}`;
  if (step.skip) return 'skip';
  return undefined;
}

async function runStep(page: Page, step: ScenarioStep, index: number): Promise<void> {
  const ctx = `step ${index} (tile ${step.tile} @ ${step.at.x},${step.at.y})`;

  // 1. Wait for the auto-drawn tile and verify the deck dealt what we expect.
  await page
    .waitForFunction(() => window.__carcTest!.getSummary().pendingTileId !== null, null, WAIT)
    .catch(() => { throw new Error(`${ctx}: no tile was dealt (deck exhausted or unexpected phase)`); });

  const drawn = await page.evaluate(() => window.__carcTest!.getSummary().pendingTileId);
  if (drawn !== step.tile) {
    throw new Error(
      `${ctx}: deck/steps drift — expected to draw "${step.tile}" but the engine dealt "${drawn}". ` +
      `Either the deck order is wrong or "${step.tile}" was unplaceable and skipped.`,
    );
  }

  // 2. Rotate to the requested rotation via real button clicks.
  const rotation = step.rotation ?? 0;
  for (let r = 0; r < (rotation / 90) % 4; r++) {
    await page.click('[data-testid="rotate-cw-btn"]');
  }
  await expect(page.locator('[data-testid="tile-preview-img"]')).toHaveAttribute('data-rotation', String(rotation));

  // 3. Place by clicking the ghost at the target coord — it must be legal there.
  const sel = `[data-testid="ghost-tile"][data-coord="${step.at.x},${step.at.y}"]`;
  if (await page.locator(sel).count() === 0) {
    throw new Error(`${ctx}: no placement candidate at (${step.at.x},${step.at.y}) — it must be orthogonally adjacent to a placed tile.`);
  }
  const legal = page.locator(`${sel}[data-legal="true"]`);
  if (await legal.count() === 0) {
    throw new Error(`${ctx}: ${step.tile} does not fit at (${step.at.x},${step.at.y}) rotation ${rotation} (edge mismatch).`);
  }
  await legal.click();

  // 4. Meeple step — only if the placement opened a meeple phase. Tiles with no
  //    targets auto-advance the turn inside placeTile(), so there is nothing to do.
  const phase = await page.evaluate(() => window.__carcTest!.getSummary().phase);
  if (phase === 'PLACING_MEEPLE') {
    if (step.skip || !step.meeple) {
      await page.evaluate(() => window.__carcTest!.skipMeepleTurn());
    } else {
      await page.evaluate(
        (localId) => window.__carcTest!.placeMeepleOnLastTile(localId),
        step.meeple.segment,
      );
    }
  } else if (step.meeple) {
    throw new Error(`${ctx}: scenario wanted a meeple on segment ${step.meeple.segment}, but the placed tile produced no meeple targets.`);
  }
}
