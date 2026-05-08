import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { startGame } from '../../src/core/game/Game';
import { placeTileInternal } from '../../src/core/board/placement';
import { createGameController } from '../../src/controller/GameController';
import { TILE_C } from '../../src/core/deck/tiles/tile-C';
import { TILE_D } from '../../src/core/deck/tiles/tile-D';
import { TILE_E } from '../../src/core/deck/tiles/tile-E';

beforeEach(() => _resetTileSeq());

// ─── §8.3.11 Controller integration ──────────────────────────────────────

describe('§8.3.11 Controller integration', () => {
  it('full 2-player turn cycle through the public API', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    // TILE_D(1,0) rot 0 fits east of start TILE_D(0,0)
    state.pendingTile = TILE_D;
    state.pendingRotation = 0;
    const controller = createGameController(state);

    expect(controller.placeTile({ x: 1, y: 0 }).ok).toBe(true);
    if (controller.getState().phase === 'PLACING_MEEPLE') {
      expect(controller.skipMeeple().ok).toBe(true);
    }
    expect(controller.getState().currentPlayerIndex).toBe(1);
  });

  it('subscribers receive exactly one notification per successful command', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    const controller = createGameController(state);

    const calls: number[] = [];
    controller.subscribe(s => calls.push(s.version));

    controller.drawTile();
    expect(calls).toHaveLength(1);

    controller.rotatePending('CW');
    expect(calls).toHaveLength(2);
  });

  it('failed commands do not notify subscribers', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    const controller = createGameController(state);

    const calls: number[] = [];
    controller.subscribe(s => calls.push(s.version));

    const r = controller.placeTile({ x: 1, y: 0 }); // fails: no pending tile
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('previewPlacement returns legal:true for a valid position', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    state.pendingTile = TILE_D;
    state.pendingRotation = 0;
    const controller = createGameController(state);

    expect(controller.previewPlacement({ x: 1, y: 0 }, 0).legal).toBe(true);
  });

  it('previewPlacement returns legal:false for an edge mismatch', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    state.pendingTile = TILE_D;
    state.pendingRotation = 0;
    const controller = createGameController(state);

    // TILE_D.N=CITY; the tile north of start would need S=CITY but TILE_D.S=FIELD
    const result = controller.previewPlacement({ x: 0, y: -1 }, 0);
    expect(result.legal).toBe(false);
  });
});

// ─── §8.3.10 Game-end conditions ─────────────────────────────────────────

describe('§8.3.10 Game-end conditions', () => {
  it('game ends when deck exhausts at end of turn', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    state.deck.remaining = [];  // drain deck
    state.pendingTile = TILE_D;
    state.pendingRotation = 0;
    const controller = createGameController(state);

    controller.placeTile({ x: 1, y: 0 });
    if (controller.getState().phase === 'PLACING_MEEPLE') {
      controller.skipMeeple();
    }
    expect(controller.getState().phase).toBe('GAME_OVER');
  });

  it('game ends immediately if all remaining tiles are unplaceable', () => {
    // TILE_D(0,0) start + TILE_E(0,-1,rot180) closes the north city.
    // All remaining candidate positions now reject TILE_C (all-city edges).
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    placeTileInternal(state.board, TILE_E, { x: 0, y: -1 }, 180);
    state.deck.remaining = [TILE_C];
    const controller = createGameController(state);

    controller.drawTile(); // TILE_C unplaceable → _applyEndGame
    expect(controller.getState().phase).toBe('GAME_OVER');
  });

  it('endGame can be forced via controller.endGame()', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    const controller = createGameController(state);

    expect(controller.endGame().ok).toBe(true);
    expect(controller.getState().phase).toBe('GAME_OVER');
  });
});
