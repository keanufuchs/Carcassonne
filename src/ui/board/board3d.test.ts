import { describe, it, expect } from 'vitest';
import type { Feature } from '../../core/feature/Feature';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player, SegmentRef } from '../../core/types';
import { segmentKey } from '../../core/types';
import type { PlacedTile } from '../../core/tile/Tile';
import {
  controllingPlayerIndex,
  featureLocalIdsOnTile,
  tileClaims,
} from './board3d';

const player = (id: string): Player => ({ id, name: id, color: '#000', score: 0, meeplesAvailable: 7 });

function feature(partial: Partial<Feature> & Pick<Feature, 'id' | 'kind'>): Feature {
  return {
    openEdges: 0,
    segments: new Set(),
    meeples: [],
    shieldCount: 0,
    completed: false,
    ...partial,
  };
}

const ref = (tileId: string, localId: number): SegmentRef => ({ tileId, localId });

describe('controllingPlayerIndex', () => {
  const players = [player('p0'), player('p1'), player('p2')];

  it('returns -1 when the feature has no meeples', () => {
    expect(controllingPlayerIndex(feature({ id: 'f', kind: 'CITY' }), players)).toBe(-1);
  });

  it('returns the sole owner', () => {
    const f = feature({ id: 'f', kind: 'CITY', meeples: [{ playerId: 'p1', segmentRef: ref('T1', 0) }] });
    expect(controllingPlayerIndex(f, players)).toBe(1);
  });

  it('returns the majority owner', () => {
    const f = feature({
      id: 'f',
      kind: 'CITY',
      meeples: [
        { playerId: 'p2', segmentRef: ref('T1', 0) },
        { playerId: 'p2', segmentRef: ref('T2', 0) },
        { playerId: 'p1', segmentRef: ref('T3', 0) },
      ],
    });
    expect(controllingPlayerIndex(f, players)).toBe(2);
  });

  it('breaks ties toward the lowest player index', () => {
    const f = feature({
      id: 'f',
      kind: 'CITY',
      meeples: [
        { playerId: 'p2', segmentRef: ref('T1', 0) },
        { playerId: 'p1', segmentRef: ref('T2', 0) },
      ],
    });
    expect(controllingPlayerIndex(f, players)).toBe(1);
  });
});

describe('featureLocalIdsOnTile', () => {
  it('returns only the localIds belonging to the given tile', () => {
    const f = feature({ id: 'f', kind: 'ROAD' });
    f.segments.add(segmentKey(ref('T1', 0)));
    f.segments.add(segmentKey(ref('T1', 3)));
    f.segments.add(segmentKey(ref('T2', 1)));
    expect(featureLocalIdsOnTile(f, 'T1')).toEqual(new Set([0, 3]));
    expect(featureLocalIdsOnTile(f, 'T2')).toEqual(new Set([1]));
    expect(featureLocalIdsOnTile(f, 'T9')).toEqual(new Set());
  });
});

describe('tileClaims', () => {
  const players = [player('p0'), player('p1')];

  function registryWith(features: Feature[]): FeatureRegistry {
    const reg: FeatureRegistry = { features: new Map(), segmentToFeature: new Map(), nextId: 1 };
    for (const f of features) {
      reg.features.set(f.id, f);
      for (const key of f.segments) reg.segmentToFeature.set(key, f.id);
    }
    return reg;
  }

  const placed = (tileId: string, segs: Array<{ localId: number; kind: 'CITY' | 'ROAD' | 'FIELD' | 'MONASTERY' }>): PlacedTile => ({
    tileId,
    prototypeId: 'proto',
    coord: { x: 0, y: 0 },
    rotation: 0,
    segmentInstances: segs.map((s) => ({ ref: ref(tileId, s.localId), kind: s.kind, edgeSlots: [] })),
  });

  it('emits a claim per segment whose feature is claimed', () => {
    const city = feature({ id: 'c', kind: 'CITY', meeples: [{ playerId: 'p1', segmentRef: ref('T2', 5) }] });
    city.segments.add(segmentKey(ref('T1', 0)));
    city.segments.add(segmentKey(ref('T2', 5)));
    const reg = registryWith([city]);

    const claims = tileClaims(placed('T1', [{ localId: 0, kind: 'CITY' }]), reg, players);
    expect(claims.get(0)).toEqual({ localId: 0, kind: 'CITY', playerIndex: 1 });
  });

  it('omits segments whose feature has no meeples', () => {
    const road = feature({ id: 'r', kind: 'ROAD' });
    road.segments.add(segmentKey(ref('T1', 2)));
    const reg = registryWith([road]);

    const claims = tileClaims(placed('T1', [{ localId: 2, kind: 'ROAD' }]), reg, players);
    expect(claims.size).toBe(0);
  });
});
