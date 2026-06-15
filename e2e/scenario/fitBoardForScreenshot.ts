import type { Page } from '@playwright/test';

const FIT_TIMEOUT_MS = 5_000;

/**
 * Pan/zoom the 2D board so all placed tiles are centered, then wait until
 * React has committed the transform (via flushSync in BoardView).
 */
export async function fitBoardForScreenshot(page: Page): Promise<void> {
  await page.evaluate(
    ({ timeoutMs }) => new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        delete window.__carcBoardFitResolve;
        reject(new Error('fitBoardView timed out'));
      }, timeoutMs);

      window.__carcBoardFitResolve = () => {
        window.clearTimeout(timer);
        delete window.__carcBoardFitResolve;
        resolve();
      };

      window.__carcTest?.fitBoardView?.()
        ?? window.dispatchEvent(new Event('carc:fit-board-view'));
    }),
    { timeoutMs: FIT_TIMEOUT_MS },
  );

  // Two animation frames so the compositor applies the committed transform.
  await page.evaluate(() => new Promise<void>(r => {
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  }));

  // Sanity-check: mean tile centroid should be near the board viewport center.
  await page.waitForFunction(() => {
    const container = document.querySelector('[data-testid="board-scroll"]') as HTMLElement | null;
    if (!container) return false;
    const tiles = [...document.querySelectorAll('[data-testid^="placed-tile-"]')];
    if (tiles.length === 0) return false;
    const cr = container.getBoundingClientRect();
    const midX = cr.width / 2;
    const midY = cr.height / 2;
    let sumDx = 0;
    let sumDy = 0;
    for (const tile of tiles) {
      const r = tile.getBoundingClientRect();
      sumDx += (r.left + r.width / 2 - cr.left) - midX;
      sumDy += (r.top + r.height / 2 - cr.top) - midY;
    }
    const avgDx = sumDx / tiles.length;
    const avgDy = sumDy / tiles.length;
    return Math.abs(avgDx) < 80 && Math.abs(avgDy) < 80;
  }, null, { timeout: 2_000 });
}
