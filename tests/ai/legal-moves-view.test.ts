import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { legalMovesView } from '../../src/ai/boardAnalysis';
import { freshGame, place } from '../helpers/fixtures';
import { TILE_E } from '../helpers/prototypes';

beforeEach(() => _resetTileSeq());

describe('legalMovesView', () => {
  it('includes boardTileCount reflecting tiles currently on the board', () => {
    const state = freshGame();
    // freshGame places the starting tile → 1 tile on board
    state.pendingTile = TILE_E;

    const result = legalMovesView(state);

    expect(result.boardTileCount).toBe(1);
  });

  it('reflects updated boardTileCount after placing more tiles', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 1, y: 0 }, 0);
    place(state, TILE_E, { x: -1, y: 0 }, 0);
    state.pendingTile = TILE_E;

    const result = legalMovesView(state);

    expect(result.boardTileCount).toBe(3);
  });
});
