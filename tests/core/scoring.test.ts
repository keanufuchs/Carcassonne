import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { createEmptyBoard } from '../../src/core/board/Board';
import { placeTileInternal } from '../../src/core/board/placement';
import { lookupBySegment } from '../../src/core/feature/segments';
import { scoreCompletedMidGame } from '../../src/core/scoring/midGame';
import { scoreIncompleteEndGame } from '../../src/core/scoring/endGame';
import { scoreFarmers } from '../../src/core/scoring/farmers';
import type { Feature } from '../../src/core/feature/Feature';
import type { PlacedTile } from '../../src/core/tile/Tile';
import { TILE_E } from '../../src/core/deck/tiles/tile-E';

function makeFeature(
  kind: Feature['kind'],
  tileIds: string[],
  meeples: Array<{ playerId: string }>,
  extra: Partial<Feature> = {},
): Feature {
  return {
    id: 'F1', kind,
    segments: new Set(tileIds.map(id => `${id}#0`)),
    openEdges: 0,
    meeples: meeples.map(m => ({ playerId: m.playerId, segmentRef: { tileId: tileIds[0], localId: 0 } })),
    shieldCount: 0,
    completed: true,
    ...extra,
  };
}

beforeEach(() => _resetTileSeq());

// ─── §8.3.6 Mid-game scoring ──────────────────────────────────────────────

describe('§8.3.6 Mid-game scoring', () => {
  it('completed road scores 1 point per tile', () => {
    const f = makeFeature('ROAD', ['T1', 'T2', 'T3'], [{ playerId: 'P1' }]);
    const { winners, points } = scoreCompletedMidGame(f);
    expect(winners).toEqual(['P1']);
    expect(points).toBe(3);
  });

  it('completed 4-tile city with 2 shields scores 12', () => {
    const f = makeFeature('CITY', ['T1', 'T2', 'T3', 'T4'], [{ playerId: 'P1' }], { shieldCount: 2 });
    expect(scoreCompletedMidGame(f).points).toBe(12); // (4+2)×2
  });

  it('majority tie awards full points to all tied players', () => {
    const f = makeFeature('ROAD', ['T1', 'T2', 'T3', 'T4'], []);
    f.meeples = [
      { playerId: 'P1', segmentRef: { tileId: 'T1', localId: 0 } },
      { playerId: 'P2', segmentRef: { tileId: 'T2', localId: 0 } },
    ];
    const { winners, points } = scoreCompletedMidGame(f);
    expect(winners.sort()).toEqual(['P1', 'P2']);
    expect(points).toBe(4);
  });
});

// ─── §8.3.7 End-game scoring ──────────────────────────────────────────────

describe('§8.3.7 End-game scoring', () => {
  it('incomplete city scores 1 per tile + 1 per shield', () => {
    const f = makeFeature('CITY', ['T1', 'T2', 'T3'], [{ playerId: 'P1' }], {
      shieldCount: 1, completed: false, openEdges: 2,
    });
    expect(scoreIncompleteEndGame(f).points).toBe(4); // 3 + 1
  });
});

// ─── §8.3.8 Farmer scoring ────────────────────────────────────────────────

describe('§8.3.8 Farmer scoring', () => {
  it('farmer scores 3 per completed adjacent city', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_E, { x: 0, y: 0 }, 0);
    placeTileInternal(board, TILE_E, { x: 0, y: -1 }, 180);
    const fieldInst = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'FIELD')!;
    lookupBySegment(board.registry, fieldInst.ref).meeples.push(
      { playerId: 'P1', segmentRef: fieldInst.ref },
    );
    const tileById = new Map<string, PlacedTile>(
      [...board.tiles.values()].map(t => [t.tileId, t]),
    );
    const results = scoreFarmers(board.registry, tileById);
    expect(results.find(r => r.winners.includes('P1'))!.points).toBe(3);
  });
});
