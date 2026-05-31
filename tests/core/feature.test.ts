import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { createEmptyBoard } from '../../src/core/board/Board';
import { placeTileInternal } from '../../src/core/board/placement';
import {
  createRegistry, createFeature, attachSegment, lookupBySegment,
} from '../../src/core/feature/segments';
import { unify } from '../../src/core/feature/merge';
import { TILE_A } from '../../src/core/deck/tiles/tile-A';
import { TILE_B } from '../../src/core/deck/tiles/tile-B';
import { TILE_E } from '../../src/core/deck/tiles/tile-E';
import { TILE_M } from '../../src/core/deck/tiles/tile-M';
import { TILE_U } from '../../src/core/deck/tiles/tile-U';

beforeEach(() => _resetTileSeq());

// ─── §8.3.3 Feature merge ─────────────────────────────────────────────────

describe('§8.3.3 Feature merge', () => {
  it('two adjacent road tiles merge into one road feature', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_U, { x: 0, y: 0 }, 0);
    placeTileInternal(board, TILE_U, { x: 0, y: 1 }, 0);

    const t0 = board.tiles.get('0,0')!;
    const t1 = board.tiles.get('0,1')!;
    const road0 = t0.segmentInstances.find(s => s.kind === 'ROAD')!;
    const road1 = t1.segmentInstances.find(s => s.kind === 'ROAD')!;
    const fid0 = board.registry.segmentToFeature.get(`${road0.ref.tileId}#${road0.ref.localId}`)!;
    const fid1 = board.registry.segmentToFeature.get(`${road1.ref.tileId}#${road1.ref.localId}`)!;
    expect(fid0).toBe(fid1);
  });

  it('road openEdges reflects unmerged ends after two tiles join', () => {
    // TILE_U road: 2 edge slots (N-C, S-C) → openEdges=2.
    // After a second TILE_U connects south, both outer ends remain open → still 2.
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_U, { x: 0, y: 0 }, 0);
    const road0 = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'ROAD')!;

    expect(lookupBySegment(board.registry, road0.ref).openEdges).toBe(2);

    placeTileInternal(board, TILE_U, { x: 0, y: 1 }, 0);
    expect(lookupBySegment(board.registry, road0.ref).openEdges).toBe(2);
  });

  it('city merge accumulates shieldCount', () => {
    // TILE_M: city on N+E with shield. Placed mirrored (rot 180) east so city edges connect.
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_M, { x: 0, y: 0 }, 0);
    placeTileInternal(board, TILE_M, { x: 1, y: 0 }, 180);

    const citySeg = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'CITY')!;
    expect(lookupBySegment(board.registry, citySeg.ref).shieldCount).toBe(2);
  });

  it('unify is deterministic — lower-id feature always wins', () => {
    const reg = createRegistry();
    const fa = createFeature(reg, 'ROAD'); // F1
    const fb = createFeature(reg, 'ROAD'); // F2
    attachSegment(reg, fa, { tileId: 'T0', localId: 0 });
    attachSegment(reg, fb, { tileId: 'T0', localId: 1 });

    expect(unify(reg, fa, fb).id).toBe('F1');
    expect(reg.features.has('F2')).toBe(false);

    // Reverse order still picks lower id
    const fc = createFeature(reg, 'CITY'); // F3
    const fd = createFeature(reg, 'CITY'); // F4
    attachSegment(reg, fc, { tileId: 'T1', localId: 0 });
    attachSegment(reg, fd, { tileId: 'T1', localId: 1 });
    expect(unify(reg, fd, fc).id).toBe('F3');
  });

  it('unify transfers all segment keys to the winning feature', () => {
    const reg = createRegistry();
    const fa = createFeature(reg, 'CITY'); // F1
    const fb = createFeature(reg, 'CITY'); // F2
    attachSegment(reg, fa, { tileId: 'T1', localId: 0 });
    attachSegment(reg, fb, { tileId: 'T2', localId: 0 });

    unify(reg, fa, fb);
    expect(reg.segmentToFeature.get('T1#0')).toBe('F1');
    expect(reg.segmentToFeature.get('T2#0')).toBe('F1');
  });
});

// ─── §8.3.4 Completion detection ─────────────────────────────────────────

describe('§8.3.4 Completion detection', () => {
  it('placing the closing tile of a city completes that city', () => {
    // Two TILE_E tiles facing each other: city-N on (0,0) closed by city-S on (0,-1).
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_E, { x: 0, y: 0 }, 0);
    const { completedFeatures } = placeTileInternal(board, TILE_E, { x: 0, y: -1 }, 180);
    expect(completedFeatures.map(f => f.kind)).toContain('CITY');
  });

  it('completed city has openEdges=0 and completed=true', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_E, { x: 0, y: 0 }, 0);
    placeTileInternal(board, TILE_E, { x: 0, y: -1 }, 180);

    const citySeg = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'CITY')!;
    const f = lookupBySegment(board.registry, citySeg.ref);
    expect(f.completed).toBe(true);
    expect(f.openEdges).toBe(0);
  });

  it('monastery completes when all 8 surrounding tiles are placed', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_B, { x: 0, y: 0 }, 0);
    for (const c of [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y:  0 },                   { x: 1, y:  0 },
      { x: -1, y:  1 }, { x: 0, y:  1 }, { x: 1, y:  1 },
    ]) placeTileInternal(board, TILE_B, c, 0);

    const mInst = board.tiles.get('0,0')!.segmentInstances.find(s => s.kind === 'MONASTERY')!;
    const f = lookupBySegment(board.registry, mInst.ref);
    expect(f.completed).toBe(true);
    expect(f.monasterySurroundCount).toBe(8);
  });

  it('a single placement can complete multiple features simultaneously', () => {
    // TILE_A at (0,0): monastery + dead-end road south.
    // 7 TILE_B around it (all except south). TILE_A(rot180) at (0,1):
    //   → 8th monastery neighbor → monastery completes
    //   → dead-end road north connects to (0,0)'s road → both roads terminate → road completes
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_A, { x: 0, y: 0 }, 0);
    for (const c of [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y:  0 },                   { x: 1, y:  0 },
      { x: -1, y:  1 },                   { x: 1, y:  1 },
    ]) placeTileInternal(board, TILE_B, c, 0);

    const { completedFeatures } = placeTileInternal(board, TILE_A, { x: 0, y: 1 }, 180);
    const kinds = completedFeatures.map(f => f.kind);
    expect(kinds).toContain('MONASTERY');
    expect(kinds).toContain('ROAD');
    expect(completedFeatures.length).toBeGreaterThanOrEqual(2);
  });
});
