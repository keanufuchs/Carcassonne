import { test, expect, type Page } from '@playwright/test';

async function startGame(page: Page) {
  await page.goto('/');
  await page.click('[data-testid="start-game-btn"]');
}

async function drawTile(page: Page) {
  await page.click('[data-testid="draw-tile-btn"]');
  await expect(page.locator('[data-testid="tile-preview-img"]')).toBeVisible();
}

test.describe('Carcassonne MVP', () => {
  test('draw tile – tile appears in preview', async ({ page }) => {
    await startGame(page);

    await expect(page.locator('[data-testid="draw-tile-btn"]')).toBeVisible();
    await page.click('[data-testid="draw-tile-btn"]');

    await expect(page.locator('[data-testid="tile-preview-img"]')).toBeVisible();
    await expect(page.locator('[data-testid="draw-tile-btn"]')).not.toBeVisible();
  });

  test('place tile – tile appears on board', async ({ page }) => {
    await startGame(page);
    await drawTile(page);

    const initial = await page.locator('[data-testid="placed-tile"]').count();

    // Rotate up to 3 times to find a legal placement (drawn tile may not fit at rotation 0)
    const legal = page.locator('[data-testid="ghost-tile"][data-legal="true"]');
    for (let i = 0; i < 3; i++) {
      if (await legal.count() > 0) break;
      await page.click('[data-testid="rotate-cw-btn"]');
    }

    await expect(legal.first()).toBeVisible();
    await legal.first().click();

    // After placement we enter PLACING_MEEPLE — skip it to confirm board updated
    await page.click('[data-testid="skip-meeple-btn"]');

    await expect(page.locator('[data-testid="placed-tile"]')).toHaveCount(initial + 1);
  });

  test('rotate tile – rotation updates visually', async ({ page }) => {
    await startGame(page);
    await drawTile(page);

    const img = page.locator('[data-testid="tile-preview-img"]');
    const before = await img.getAttribute('data-rotation');

    await page.click('[data-testid="rotate-cw-btn"]');

    const after = await img.getAttribute('data-rotation');
    expect(after).not.toBe(before);
    expect(Number(after)).toBe((Number(before) + 90) % 360);
  });

  test('meeple phase – skip advances turn', async ({ page }) => {
    await startGame(page);
    await drawTile(page);

    const legal = page.locator('[data-testid="ghost-tile"][data-legal="true"]');
    for (let i = 0; i < 3; i++) {
      if (await legal.count() > 0) break;
      await page.click('[data-testid="rotate-cw-btn"]');
    }
    await legal.first().click();

    await expect(page.locator('[data-testid="skip-meeple-btn"]')).toBeVisible();
    await page.click('[data-testid="skip-meeple-btn"]');

    await expect(page.locator('[data-testid="draw-tile-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="skip-meeple-btn"]')).not.toBeVisible();
  });

  test('meeple phase – targets render as clickable circles', async ({ page }) => {
    await startGame(page);
    await drawTile(page);

    const legal = page.locator('[data-testid="ghost-tile"][data-legal="true"]');
    for (let i = 0; i < 3; i++) {
      if (await legal.count() > 0) break;
      await page.click('[data-testid="rotate-cw-btn"]');
    }
    await legal.first().click();

    await expect(page.locator('[data-testid="skip-meeple-btn"]')).toBeVisible();

    const targets = page.locator('[data-testid="meeple-target"]');
    await expect(targets.first()).toBeVisible();
    expect(await targets.count()).toBeGreaterThan(0);
  });

  test('meeple phase – clicking target advances turn', async ({ page }) => {
    await startGame(page);
    await drawTile(page);

    const legal = page.locator('[data-testid="ghost-tile"][data-legal="true"]');
    for (let i = 0; i < 3; i++) {
      if (await legal.count() > 0) break;
      await page.click('[data-testid="rotate-cw-btn"]');
    }
    await legal.first().click();

    const targets = page.locator('[data-testid="meeple-target"]');
    if (await targets.count() === 0) {
      test.skip(true, 'No meeple targets for this tile');
      return;
    }

    await targets.first().click();

    await expect(page.locator('[data-testid="draw-tile-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="meeple-target"]')).toHaveCount(0);
  });

  test('invalid placement – rejected (tile count unchanged)', async ({ page }) => {
    await startGame(page);
    await drawTile(page);

    const initial = await page.locator('[data-testid="placed-tile"]').count();

    const illegal = page.locator('[data-testid="ghost-tile"][data-legal="false"]');
    const illegalCount = await illegal.count();

    if (illegalCount > 0) {
      await illegal.first().click({ force: true });
      await expect(page.locator('[data-testid="placed-tile"]')).toHaveCount(initial);
    } else {
      test.skip(true, 'All candidate placements are legal for this tile – no illegal ghost to test');
    }
  });
});
