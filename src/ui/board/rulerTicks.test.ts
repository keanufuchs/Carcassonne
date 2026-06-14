import { describe, it, expect } from 'vitest';
import { getVisibleTicks } from './rulerTicks';

const TILE = 80;
const OFFSET = 40;

describe('getVisibleTicks', () => {
  it('places origin at the correct screen position', () => {
    // Game coord 0 → canvas pixel = (0 + 40) * 80 = 3200
    // We want it at screen position 100: offsetX = 100 - 3200 = -3100
    const ticks = getVisibleTicks(-3100, 1, 400, TILE, OFFSET);
    const origin = ticks.find(t => t.gameCoord === 0);
    expect(origin).toBeDefined();
    expect(origin!.screenPos).toBe(100);
  });

  it('includes negative coordinates when panned', () => {
    // Put game coord -2 at screen 40: offsetX = 40 - ((-2+40)*80) = 40 - 3040 = -3000
    const ticks = getVisibleTicks(-3000, 1, 400, TILE, OFFSET);
    expect(ticks.some(t => t.gameCoord === -2)).toBe(true);
  });

  it('skips every other coord when zoomed out (tileScreen < 28px)', () => {
    // scale 0.3 → tileScreen = 24 → skipFactor = ceil(28/24) = 2
    const ticks = getVisibleTicks(0, 0.3, 300, TILE, OFFSET);
    for (const t of ticks) {
      expect(Math.abs(t.gameCoord % 2)).toBe(0);
    }
  });

  it('shows every coord when zoomed in (tileScreen >= 28px)', () => {
    // scale 1 → tileScreen = 80 → skipFactor = 1
    // Put coord 0 at screen 40, viewport 400 → visible coords 0..4
    const ticks = getVisibleTicks(-3200 + 40, 1, 400, TILE, OFFSET);
    const coords = ticks.map(t => t.gameCoord).sort((a, b) => a - b);
    for (let i = 1; i < coords.length; i++) {
      expect(coords[i] - coords[i - 1]).toBe(1);
    }
  });

  it('excludes ticks outside the viewport', () => {
    const ticks = getVisibleTicks(0, 1, 300, TILE, OFFSET);
    for (const t of ticks) {
      expect(t.screenPos).toBeGreaterThanOrEqual(-TILE);
      expect(t.screenPos).toBeLessThanOrEqual(300 + TILE);
    }
  });
});
