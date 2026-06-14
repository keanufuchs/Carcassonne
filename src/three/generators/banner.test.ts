import { describe, it, expect } from 'vitest';
import { cityAnchor, cityShieldAnchor, fieldAnchor } from './banner';
import { pointInPolygon, type World2 } from './util';

describe('cityAnchor', () => {
  it('returns the centroid of all city parts', () => {
    const a: World2[] = [[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2]];
    const [x, z] = cityAnchor([a]);
    expect(x).toBeCloseTo(0.1, 5);
    expect(z).toBeCloseTo(0.1, 5);
  });
});

describe('cityShieldAnchor', () => {
  it('places the shield banner far from the claim gonfalon anchor', () => {
    const city: World2[] = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]];
    const anchor = cityAnchor([city]);
    const shield = cityShieldAnchor([city]);
    expect(pointInPolygon(shield, city)).toBe(true);
    const separation = Math.hypot(shield[0] - anchor[0], shield[1] - anchor[1]);
    expect(separation).toBeGreaterThan(0.2);
  });
});

describe('fieldAnchor', () => {
  it('returns a point inside a convex field', () => {
    const square: World2[] = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]];
    expect(pointInPolygon(fieldAnchor(square), square)).toBe(true);
  });

  it('returns a point inside a concave (L-shaped) field, not in the notch', () => {
    // L-shape: a 0.4×0.4 square with the top-right quadrant removed.
    const lShape: World2[] = [
      [0, 0], [0.4, 0], [0.4, 0.2], [0.2, 0.2], [0.2, 0.4], [0, 0.4],
    ];
    const anchor = fieldAnchor(lShape);
    expect(pointInPolygon(anchor, lShape)).toBe(true);
  });

  it('keeps the anchor away from an obstacle at the field centre (monastery case)', () => {
    // Whole-tile field with a monastery building at the centre.
    const tile: World2[] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    const monastery: World2 = [0, 0];
    const anchor = fieldAnchor(tile, [monastery]);
    expect(pointInPolygon(anchor, tile)).toBe(true);
    // Monastery hall is ~0.2 wide → its corner reaches ~0.14 from centre.
    const distToMonastery = Math.hypot(anchor[0] - monastery[0], anchor[1] - monastery[1]);
    expect(distToMonastery).toBeGreaterThan(0.15);
  });
});
