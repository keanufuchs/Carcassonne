import { describe, it, expect } from 'vitest';
import { buildClaimMarkers } from './claimMarkers';
import type { ClaimMap } from './claims';
import type { TileRegions } from './svgRegions';

const regions: TileRegions = {
  polygons: [
    { localId: 0, kind: 'CITY', points: [[0, 0], [40, 0], [40, 40], [0, 40]] },
    { localId: 1, kind: 'FIELD', points: [[50, 50], [100, 50], [100, 100], [50, 100]] },
  ],
  roads: [{ localId: 2, centerline: [[0, 50], [100, 50]], width: 10 }],
  markers: [{ localId: 3, pos: [70, 20], radius: 12 }],
};

describe('buildClaimMarkers', () => {
  it('emits a marker per non-road claim, named by kind+localId', () => {
    const claims: ClaimMap = new Map([
      [0, { localId: 0, kind: 'CITY', playerIndex: 0 }],
      [1, { localId: 1, kind: 'FIELD', playerIndex: 1 }],
      [3, { localId: 3, kind: 'MONASTERY', playerIndex: 2 }],
    ]);
    const group = buildClaimMarkers(regions, claims);
    const names = group.children.map((c) => c.name).sort();
    expect(names).toEqual(['claim-marker-CITY-0', 'claim-marker-FIELD-1', 'claim-marker-MONASTERY-3']);
  });

  it('does not emit a marker for road claims (those are tinted)', () => {
    const claims: ClaimMap = new Map([[2, { localId: 2, kind: 'ROAD', playerIndex: 0 }]]);
    expect(buildClaimMarkers(regions, claims).children).toHaveLength(0);
  });

  it('is empty when there are no claims', () => {
    expect(buildClaimMarkers(regions, new Map()).children).toHaveLength(0);
  });
});
