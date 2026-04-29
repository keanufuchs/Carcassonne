import { describe, it, expect } from 'vitest';
import { majorityWinners } from './majority';
import type { Feature } from '../feature/Feature';

function makeFeature(meeples: Array<{ playerId: string }>): Feature {
  return {
    id: 'F1', kind: 'CITY',
    segments: new Set(),
    openEdges: 0,
    meeples: meeples.map(m => ({ playerId: m.playerId, segmentRef: { tileId: 'T1', localId: 0 } })),
    shieldCount: 0,
    completed: true,
  };
}

describe('majorityWinners', () => {
  it('returns [] when no meeples', () => {
    expect(majorityWinners(makeFeature([]))).toEqual([]);
  });
  it('returns sole winner', () => {
    expect(majorityWinners(makeFeature([{ playerId: 'P1' }, { playerId: 'P1' }]))).toEqual(['P1']);
  });
  it('returns all tied players', () => {
    expect(majorityWinners(makeFeature([{ playerId: 'P1' }, { playerId: 'P2' }])).sort()).toEqual(['P1', 'P2']);
  });
  it('excludes minority players from tie', () => {
    expect(majorityWinners(makeFeature([
      { playerId: 'P1' }, { playerId: 'P1' }, { playerId: 'P2' },
    ]))).toEqual(['P1']);
  });
});
