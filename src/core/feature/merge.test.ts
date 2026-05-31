import { describe, it, expect } from 'vitest';
import { unify } from './merge';
import { createRegistry, createFeature, attachSegment } from './segments';

describe('unify', () => {
  it('returns feature unchanged when both IDs are equal', () => {
    const reg = createRegistry();
    const f = createFeature(reg, 'ROAD');
    const ref = { tileId: 'T1', localId: 0 };
    attachSegment(reg, f, ref);
    f.openEdges = 2;

    const result = unify(reg, f, f);
    expect(result.id).toBe(f.id);
    expect(result.openEdges).toBe(2);
    expect(reg.features.has(f.id)).toBe(true);
  });

  it('merges two features; lower-ID feature survives', () => {
    const reg = createRegistry();

    const a = createFeature(reg, 'ROAD');
    attachSegment(reg, a, { tileId: 'T1', localId: 0 });
    a.openEdges = 2;
    a.shieldCount = 1;
    a.meeples = [{ playerId: 'P1', segmentRef: { tileId: 'T1', localId: 0 } }];

    const b = createFeature(reg, 'ROAD');
    attachSegment(reg, b, { tileId: 'T2', localId: 0 });
    b.openEdges = 3;
    b.shieldCount = 0;
    b.meeples = [{ playerId: 'P2', segmentRef: { tileId: 'T2', localId: 0 } }];

    const winner = unify(reg, a, b);
    expect(winner.id).toBe(a.id);
    expect(reg.features.has(b.id)).toBe(false);
    expect(reg.features.has(a.id)).toBe(true);
    expect(winner.openEdges).toBe(5);
    expect(winner.shieldCount).toBe(1);
    expect(winner.meeples).toHaveLength(2);
    expect(reg.segmentToFeature.get('T1#0')).toBe(a.id);
    expect(reg.segmentToFeature.get('T2#0')).toBe(a.id);
  });

  it('is deterministic — smaller-id feature always survives', () => {
    const reg = createRegistry();
    const a = createFeature(reg, 'CITY');
    const b = createFeature(reg, 'CITY');
    attachSegment(reg, a, { tileId: 'T1', localId: 0 });
    attachSegment(reg, b, { tileId: 'T2', localId: 0 });

    const winner = unify(reg, b, a);
    expect(winner.id).toBe('F1');
    expect(reg.features.has('F2')).toBe(false);
  });
});