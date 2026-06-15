import type { Page } from '@playwright/test';
import { fitBoardForScreenshot } from './fitBoardForScreenshot';

/** Dismiss the Game Over overlay so the map and HUD are visible again. */
export async function dismissEndGameOverlayIfPresent(page: Page): Promise<void> {
  const viewMap = page.locator('[data-testid="view-map-btn"]');
  if (await viewMap.count() === 0) return;
  if (!(await viewMap.isVisible())) return;

  await viewMap.click();
  await viewMap.waitFor({ state: 'hidden', timeout: 5_000 });
}

/**
 * Prepare the UI and capture the full in-game view: sidebar (scores), board, timeline.
 * If Game Over is showing, clicks View Map first, then centers the board.
 */
export async function captureGameScreenshot(page: Page): Promise<Buffer | undefined> {
  await dismissEndGameOverlayIfPresent(page);
  // Best-effort centering: on a large board (e.g. the full-game playthrough with
  // ~80 tiles) the fit's centroid sanity-check can't settle within tolerance.
  // Don't let that drop the screenshot — capture the frame regardless.
  await fitBoardForScreenshot(page).catch(() => { /* keep the best available view */ });

  const layout = page.locator('[data-testid="game-layout"]');
  if (await layout.count() === 0) return undefined;
  return layout.screenshot();
}
