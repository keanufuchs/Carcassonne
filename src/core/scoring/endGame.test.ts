import { describe, it, expect } from 'vitest';
import { scoreIncompleteEndGame } from './endGame';
import type { Feature } from '../feature/Feature';

function segKeys(count: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < count; i++) s.add(`T${i}#0`);
  return s;
}

describe('scoreIncompleteEndGame', () => {
  it('incomplete city scores 1 per tile + 1 per shield', () => {
    const f: Feature = {
      id: 'F1', kind: 'CITY', segments: segKeys(3), openEdges: 1,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 1, completed: false,
    };
    const { winners, points } = scoreIncompleteEndGame(f);
    expect(winners).toEqual(['P1']);
    expect(points).toBe(4);
  });

  it('incomplete road scores 1 per tile', () => {
    const f: Feature = {
      id: 'F2', kind: 'ROAD', segments: segKeys(2), openEdges: 1,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 0, completed: false,
    };
    expect(scoreIncompleteEndGame(f).points).toBe(2);
  });

  it('incomplete monastery scores 1 + surroundCount', () => {
    const f: Feature = {
      id: 'F3', kind: 'MONASTERY', segments: segKeys(1), openEdges: 0,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 0, completed: false,
      monasteryTileId: 'T0', monasterySurroundCount: 5,
    };
    expect(scoreIncompleteEndGame(f).points).toBe(6);
  });

  it('field scores 0', () => {
    const f: Feature = {
      id: 'F4', kind: 'FIELD', segments: segKeys(2), openEdges: 0,
      meeples: [{ playerId: 'P1', segmentRef: { tileId: 'T0', localId: 0 } }],
      shieldCount: 0, completed: false,
    };
    expect(scoreIncompleteEndGame(f).points).toBe(0);
  });

  it('feature with no meeples returns points but no winners', () => {
    const f: Feature = {
      id: 'F5', kind: 'CITY', segments: segKeys(2), openEdges: 1,
      meeples: [], shieldCount: 0, completed: false,
    };
    const { winners, points } = scoreIncompleteEndGame(f);
    expect(winners).toEqual([]);
    expect(points).toBe(2);
  });
});