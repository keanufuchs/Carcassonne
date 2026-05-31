import { describe, it, expect } from 'vitest';
import { scoreCompletedMidGame, tileCount } from './midGame';
import type { Feature } from '../feature/Feature';

function segKeys(count: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < count; i++) s.add(`T${i}#0`);
  return s;
}

describe('scoreCompletedMidGame', () => {
  it('completed road scores 1 point per tile', () => {
    const f: Feature = {
      id: 'F1', kind: 'ROAD', segments: segKeys(3), openEdges: 0,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 0, completed: true,
    };
    const { winners, points } = scoreCompletedMidGame(f);
    expect(winners).toEqual(['P1']);
    expect(points).toBe(3);
  });

  it('completed city scores 2 × (tiles + shields)', () => {
    const f: Feature = {
      id: 'F2', kind: 'CITY', segments: segKeys(4), openEdges: 0,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 2, completed: true,
    };
    const { winners, points } = scoreCompletedMidGame(f);
    expect(winners).toEqual(['P1']);
    expect(points).toBe(12);
  });

  it('completed monastery scores 9 points', () => {
    const f: Feature = {
      id: 'F3', kind: 'MONASTERY', segments: segKeys(1), openEdges: 0,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 0, completed: true,
      monasteryTileId: 'T0', monasterySurroundCount: 8,
    };
    const { winners, points } = scoreCompletedMidGame(f);
    expect(winners).toEqual(['P1']);
    expect(points).toBe(9);
  });

  it('tie awards full points to both players', () => {
    const f: Feature = {
      id: 'F4', kind: 'ROAD', segments: segKeys(4), openEdges: 0,
      meeples: [
        { playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } },
        { playerId: 'P2', segmentRef: { tileId: 'T1', localId: 0 } },
      ],
      shieldCount: 0, completed: true,
    };
    const { winners, points } = scoreCompletedMidGame(f);
    expect(winners).toContain('P1');
    expect(winners).toContain('P2');
    expect(points).toBe(4);
  });

  it('throws when field is passed', () => {
    const f: Feature = {
      id: 'F5', kind: 'FIELD', segments: segKeys(2), openEdges: 0,
      meeples: [], shieldCount: 0, completed: true,
    };
    expect(() => scoreCompletedMidGame(f)).toThrow('Fields do not complete mid-game');
  });
});

describe('tileCount', () => {
  it('returns unique tile count', () => {
    const segments = new Set<string>(['A#0', 'A#1', 'B#0', 'C#0']);
    expect(tileCount({ segments } as Feature)).toBe(3);
  });
});