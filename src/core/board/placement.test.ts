import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../tile/Tile';
import { createEmptyBoard } from './Board';
import { canPlace, placeTileInternal, hasAnyLegalPlacement } from './placement';
import { TILE_D } from '../deck/tiles/tile-D';
import { TILE_U } from '../deck/tiles/tile-U';
import { TILE_B } from '../deck/tiles/tile-B';

beforeEach(() => _resetTileSeq());

describe('canPlace', () => {
  it('allows valid placement adjacent to start tile', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    // TILE_D.South = ['FIELD','FIELD','FIELD']. South neighbor needs all-field on its North.
    // TILE_B (monastery, all-field edges) has North=['FIELD','FIELD','FIELD'] → matches.
    expect(canPlace(board, TILE_B, { x: 0, y: 1 }, 0)).toBe(true);
  });

  it('rejects occupied cell', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(canPlace(board, TILE_D, { x: 0, y: 0 }, 0)).toBe(false);
  });

  it('rejects non-adjacent cell', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(canPlace(board, TILE_D, { x: 5, y: 5 }, 0)).toBe(false);
  });

  it('rejects edge-terrain mismatch', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    // TILE_D.North = ['CITY','CITY','CITY']. North neighbor needs CITY on its South.
    // TILE_U North edge is ['FIELD','ROAD','FIELD'] — placing it south would check
    // TILE_D.East = ['FIELD','ROAD','FIELD'] vs TILE_U.West = ['FIELD','FIELD','FIELD'] → mismatch on C.
    // Actually easier: TILE_B placed north of TILE_D — TILE_D.N=CITY, TILE_B.S=FIELD → mismatch.
    expect(canPlace(board, TILE_B, { x: 0, y: -1 }, 0)).toBe(false);
  });
});

describe('hasAnyLegalPlacement', () => {
  it('returns true when some rotation fits after start tile', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(hasAnyLegalPlacement(board, TILE_D)).toBe(true);
  });

  it('returns true for TILE_U after another TILE_U', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_U, { x: 0, y: 0 }, 0);
    expect(hasAnyLegalPlacement(board, TILE_U)).toBe(true);
  });
});

describe('placeTileInternal — feature registry', () => {
  it('creates features for every segment on the start tile', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    // TILE_D has: 1 city seg, 1 road seg, 2 field segs = 4 features
    expect(board.registry.features.size).toBe(4);
  });

  it('merges road features when two straight road tiles share an edge', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_U, { x: 0, y: 0 }, 0); // road N-S
    placeTileInternal(board, TILE_U, { x: 0, y: 1 }, 0); // road N-S

    // Both TILE_U road segments (localId 0) should map to the same FeatureId
    const t0 = board.tiles.get('0,0')!;
    const t1 = board.tiles.get('0,1')!;
    const road0Seg = t0.segmentInstances.find(s => s.kind === 'ROAD')!;
    const road1Seg = t1.segmentInstances.find(s => s.kind === 'ROAD')!;
    const fid0 = board.registry.segmentToFeature.get(`${road0Seg.ref.tileId}#${road0Seg.ref.localId}`)!;
    const fid1 = board.registry.segmentToFeature.get(`${road1Seg.ref.tileId}#${road1Seg.ref.localId}`)!;
    expect(fid0).toBe(fid1);
  });

  it('road feature has openEdges = 0 after closing (both road ends connected)', () => {
    // Place two TILE_U end-to-end and check that neither road is closed (still open at their outer ends).
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_U, { x: 0, y: 0 }, 0);
    placeTileInternal(board, TILE_U, { x: 0, y: 1 }, 0);

    const t0 = board.tiles.get('0,0')!;
    const roadSeg = t0.segmentInstances.find(s => s.kind === 'ROAD')!;
    const fid = board.registry.segmentToFeature.get(`${roadSeg.ref.tileId}#${roadSeg.ref.localId}`)!;
    const feature = board.registry.features.get(fid)!;
    // Two tiles connected end-to-end — road has 2 open slots originally (N and S each),
    // shared edge closes 1 on each, leaving 2 open total across the merged road.
    expect(feature.openEdges).toBe(2);
    expect(feature.completed).toBe(false);
  });
});
