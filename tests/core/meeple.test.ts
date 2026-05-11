import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { startGame, placeTile, placeMeeple, getMeepleTargets } from '../../src/core/game/Game';
import { lookupBySegment } from '../../src/core/feature/segments';
import { TILE_D } from '../../src/core/deck/tiles/tile-D';

beforeEach(() => _resetTileSeq());

// ─── §8.3.5 Meeple placement legality ────────────────────────────────────

describe('§8.3.5 Meeple placement legality', () => {
  function setupWithPendingTile() {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    // TILE_D(1,0) rot 0 fits east of start TILE_D(0,0):
    // both tiles share TILE_D.E=[FIELD,ROAD,FIELD] ↔ TILE_D.W=[FIELD,ROAD,FIELD]
    state.pendingTile = TILE_D;
    state.pendingRotation = 0;
    placeTile(state, { x: 1, y: 0 });
    return state;
  }

  it('cannot place a meeple on a feature already occupied', () => {
    const state = setupWithPendingTile();
    expect(state.phase).toBe('PLACING_MEEPLE');

    const lastTile = [...state.board.tiles.values()].find(t => t.tileId === state.lastPlacedTileId)!;
    const roadSeg = lastTile.segmentInstances.find(s => s.kind === 'ROAD')!;
    lookupBySegment(state.board.registry, roadSeg.ref).meeples.push({
      playerId: 'P2', segmentRef: roadSeg.ref,
    });

    const r = placeMeeple(state, roadSeg.ref);
    expect(r.ok).toBe(false);
    expect((r as { ok: false; error: string }).error).toBe('MEEPLE_FEATURE_OCCUPIED');
  });

  it('meeple may only be placed on the tile just placed', () => {
    const state = setupWithPendingTile();
    const startTile = state.board.tiles.get('0,0')!;
    const oldSeg = startTile.segmentInstances.find(s => s.kind === 'ROAD')!;

    const r = placeMeeple(state, oldSeg.ref);
    expect(r.ok).toBe(false);
    expect((r as { ok: false; error: string }).error).toBe('MEEPLE_NOT_ON_PLACED_TILE');
  });

  it('cannot place when supply is 0', () => {
    const state = setupWithPendingTile();
    // Drain supply after phase is PLACING_MEEPLE — tests the defensive guard in placeMeeple
    state.players[0].meeplesAvailable = 0;

    const lastTile = [...state.board.tiles.values()].find(t => t.tileId === state.lastPlacedTileId)!;
    const roadSeg = lastTile.segmentInstances.find(s => s.kind === 'ROAD')!;

    const r = placeMeeple(state, roadSeg.ref);
    expect(r.ok).toBe(false);
    expect((r as { ok: false; error: string }).error).toBe('NO_MEEPLES_AVAILABLE');
  });

  it('getMeepleTargets returns refs only for the last placed tile', () => {
    const state = setupWithPendingTile();
    const targets = getMeepleTargets(state);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every(ref => ref.tileId === state.lastPlacedTileId)).toBe(true);
  });

  it('getMeepleTargets excludes occupied segments', () => {
    const state = setupWithPendingTile();
    const lastTile = [...state.board.tiles.values()].find(t => t.tileId === state.lastPlacedTileId)!;
    const roadSeg = lastTile.segmentInstances.find(s => s.kind === 'ROAD')!;
    lookupBySegment(state.board.registry, roadSeg.ref).meeples.push({
      playerId: 'P2', segmentRef: roadSeg.ref,
    });

    const targets = getMeepleTargets(state);
    const hasRoad = targets.some(
      r => r.tileId === roadSeg.ref.tileId && r.localId === roadSeg.ref.localId,
    );
    expect(hasRoad).toBe(false);
  });

  it('getMeepleTargets returns [] when player has no meeples', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    state.players[0].meeplesAvailable = 0;
    state.phase = 'PLACING_MEEPLE';
    state.lastPlacedTileId = 'T1';
    expect(getMeepleTargets(state)).toHaveLength(0);
  });
});
