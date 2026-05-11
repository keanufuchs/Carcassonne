import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { createEmptyBoard } from '../../src/core/board/Board';
import { placeTileInternal } from '../../src/core/board/placement';
import { lookupBySegment } from '../../src/core/feature/segments';
import { scoreCompletedMidGame } from '../../src/core/scoring/midGame';
import { scoreIncompleteEndGame } from '../../src/core/scoring/endGame';
import { scoreFarmers } from '../../src/core/scoring/farmers';
import { skipMeeple } from '../../src/core/game/Game';
import type { Feature } from '../../src/core/feature/Feature';
import type { GameState } from '../../src/core/game/GameState';
import type { PlacedTile } from '../../src/core/tile/Tile';
import { TILE_A } from '../../src/core/deck/tiles/tile-A';
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

  it('completed monastery scores 9', () => {
    const f = makeFeature('MONASTERY', ['T1'], [{ playerId: 'P1' }]);
    expect(scoreCompletedMidGame(f).points).toBe(9);
  });

  it('meeples return when their completed feature is scored via skipMeeple', () => {
    // TILE_A dead-ends: road exits S on (0,0) and N on (0,1) → both terminate on placement.
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_A, { x: 0, y: 0 }, 0);
    const { completedFeatures } = placeTileInternal(board, TILE_A, { x: 0, y: 1 }, 180);

    const roadFeature = completedFeatures.find(f => f.kind === 'ROAD')!;
    // Simulate P1 had placed a meeple on this road before it completed.
    roadFeature.meeples.push({
      playerId: 'P1',
      segmentRef: board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'ROAD')!.ref,
    });

    const state: GameState = {
      version: 1, board,
      deck: { startTile: TILE_A, remaining: [TILE_E] },
      players: [
        { id: 'P1', name: 'Alice', color: '#e63946', score: 0, meeplesAvailable: 6 },
        { id: 'P2', name: 'Bob',   color: '#2a9d8f', score: 0, meeplesAvailable: 7 },
      ],
      currentPlayerIndex: 0,
      phase: 'PLACING_MEEPLE',
      pendingTile: null, pendingRotation: 0,
      lastPlacedTileId: board.tiles.get('0,1')!.tileId,
      lastCompletedFeatures: [roadFeature.id],
    };

    expect(state.players[0].meeplesAvailable).toBe(6);
    skipMeeple(state);
    expect(state.players[0].meeplesAvailable).toBe(7); // returned
    expect(state.players[0].score).toBe(2);             // 2-tile road
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

  it('incomplete road scores 1 per tile', () => {
    const f = makeFeature('ROAD', ['T1', 'T2'], [{ playerId: 'P1' }], { completed: false, openEdges: 1 });
    expect(scoreIncompleteEndGame(f).points).toBe(2);
  });

  it('incomplete monastery scores 1 + surroundCount', () => {
    const f = makeFeature('MONASTERY', ['T1'], [{ playerId: 'P1' }], {
      completed: false, monasterySurroundCount: 5,
    });
    expect(scoreIncompleteEndGame(f).points).toBe(6); // 1 + 5
  });
});

// ─── §8.3.8 Farmer scoring ────────────────────────────────────────────────

describe('§8.3.8 Farmer scoring', () => {
  function buildBoard(closedCity: boolean) {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_E, { x: 0, y: 0 }, 0);
    if (closedCity) placeTileInternal(board, TILE_E, { x: 0, y: -1 }, 180);
    return board;
  }

  it('farmer scores 3 per completed adjacent city', () => {
    const board = buildBoard(true);
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

  it('farmer ignores incomplete adjacent cities', () => {
    const board = buildBoard(false);
    const fieldInst = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'FIELD')!;
    lookupBySegment(board.registry, fieldInst.ref).meeples.push(
      { playerId: 'P1', segmentRef: fieldInst.ref },
    );
    const tileById = new Map<string, PlacedTile>(
      [...board.tiles.values()].map(t => [t.tileId, t]),
    );
    const total = scoreFarmers(board.registry, tileById).reduce((s, r) => s + r.points, 0);
    expect(total).toBe(0);
  });

  it('farmer ties award both players full points', () => {
    const board = buildBoard(true);
    const fieldInst = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'FIELD')!;
    const field = lookupBySegment(board.registry, fieldInst.ref);
    field.meeples.push({ playerId: 'P1', segmentRef: fieldInst.ref });
    field.meeples.push({ playerId: 'P2', segmentRef: fieldInst.ref });
    const tileById = new Map<string, PlacedTile>(
      [...board.tiles.values()].map(t => [t.tileId, t]),
    );
    const r = scoreFarmers(board.registry, tileById)[0];
    expect(r.winners.sort()).toEqual(['P1', 'P2']);
    expect(r.points).toBe(3);
  });

  it('field with no meeples produces no score entry', () => {
    const board = buildBoard(true);
    const tileById = new Map<string, PlacedTile>(
      [...board.tiles.values()].map(t => [t.tileId, t]),
    );
    expect(scoreFarmers(board.registry, tileById)).toHaveLength(0);
  });
});
