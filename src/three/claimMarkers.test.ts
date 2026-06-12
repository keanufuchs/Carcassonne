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

const lanternNames = (group: { children: { name: string }[] }) =>
  group.children.map((c) => c.name).filter((n) => n.startsWith('road-lantern-'));

describe('buildClaimMarkers', () => {
  it('emits a marker per non-road claim, named by kind+localId', () => {
    const claims: ClaimMap = new Map([
      [0, { localId: 0, kind: 'CITY', playerIndex: 0 }],
      [1, { localId: 1, kind: 'FIELD', playerIndex: 1 }],
      [3, { localId: 3, kind: 'MONASTERY', playerIndex: 2 }],
    ]);
    const names = buildClaimMarkers(regions, claims).children
      .map((c) => c.name)
      .filter((n) => n.startsWith('claim-marker-'))
      .sort();
    expect(names).toEqual(['claim-marker-CITY-0', 'claim-marker-FIELD-1', 'claim-marker-MONASTERY-3']);
  });

  it('places a lantern beside every road, even with no claims', () => {
    expect(lanternNames(buildClaimMarkers(regions, new Map()))).toEqual(['road-lantern-2']);
  });

  it('keeps the lantern (and adds a pennant) when a road is claimed', () => {
    const claims: ClaimMap = new Map([[2, { localId: 2, kind: 'ROAD', playerIndex: 0 }]]);
    const group = buildClaimMarkers(regions, claims);
    expect(lanternNames(group)).toEqual(['road-lantern-2']);
    // A claimed lantern carries an extra child (the pennant group) over a neutral one.
    const claimed = group.children.find((c) => c.name === 'road-lantern-2')!;
    const neutral = buildClaimMarkers(regions, new Map()).children.find((c) => c.name === 'road-lantern-2')!;
    expect(claimed.children.length).toBeGreaterThan(neutral.children.length);
  });
});
