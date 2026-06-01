import { describe, it, expect } from 'vitest';
import { startGame, drawTile, rotatePending, placeTile, skipMeeple, endGame } from './Game';
import { _resetTileSeq } from '../tile/Tile';
import type { GameState } from './GameState';

function freshGame(playerNames: string[] = ['Alice', 'Bob']): GameState {
  _resetTileSeq();
  return startGame(playerNames, () => 0.5);
}

describe('Game flow', () => {
  describe('startGame', () => {
    it('initializes a game with 2 players', () => {
      const state = freshGame();
      expect(state.players).toHaveLength(2);
      expect(state.players[0].name).toBe('Alice');
      expect(state.players[1].name).toBe('Bob');
      expect(state.phase).toBe('PLACING_TILE');
      expect(state.currentPlayerIndex).toBe(0);
    });

    it('gives each player 7 meeples', () => {
      const state = freshGame();
      for (const p of state.players) {
        expect(p.meeplesAvailable).toBe(7);
      }
    });

    it('places the start tile at (0,0)', () => {
      const state = freshGame();
      expect(state.board.tiles.get('0,0')).toBeDefined();
    });

    it('throws for < 2 players', () => {
      expect(() => startGame(['Solo'])).toThrow('playerCount must be 2..5');
    });

    it('throws for > 5 players', () => {
      expect(() => startGame(['A', 'B', 'C', 'D', 'E', 'F'])).toThrow();
    });

    it('builds a deck with remaining tiles', () => {
      const state = freshGame();
      expect(state.deck.remaining.length).toBeGreaterThan(0);
    });
  });

  describe('drawTile', () => {
    it('sets pendingTile', () => {
      const state = freshGame();
      const r = drawTile(state);
      expect(r.ok).toBe(true);
      expect(state.pendingTile).not.toBeNull();
    });

    it('errs in wrong phase', () => {
      const state = freshGame();
      state.phase = 'PLACING_MEEPLE';
      expect(drawTile(state).ok).toBe(false);
    });
  });

  describe('rotatePending', () => {
    it('rotates 90° CW', () => {
      const state = freshGame();
      drawTile(state);
      expect(rotatePending(state, 'CW').ok).toBe(true);
      expect(state.pendingRotation).toBe(90);
    });

    it('rotates 270° CCW', () => {
      const state = freshGame();
      drawTile(state);
      rotatePending(state, 'CCW');
      expect(state.pendingRotation).toBe(270);
    });

    it('wraps at 360°', () => {
      const state = freshGame();
      drawTile(state);
      for (let i = 0; i < 4; i++) rotatePending(state, 'CW');
      expect(state.pendingRotation).toBe(0);
    });

    it('errs without pending tile', () => {
      const state = freshGame();
      const r = rotatePending(state, 'CW');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('NO_PENDING_TILE');
    });
  });

  describe('placeTile', () => {
    it('transitions to PLACING_MEEPLE after legal placement', () => {
      const state = freshGame();
      drawTile(state);
      // Try adjacent coords until we find a legal one
      let placed = false;
      for (let attempt = 0; attempt < 4 && !placed; attempt++) {
        if (attempt > 0) rotatePending(state, 'CW');
        for (const coord of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const r = placeTile(state, coord);
          if (r.ok) { placed = true; break; }
        }
      }
      expect(placed).toBe(true);
      expect(state.phase).toBe('PLACING_MEEPLE');
    });

    it('errs on occupied cell', () => {
      const state = freshGame();
      drawTile(state);
      const r = placeTile(state, { x: 0, y: 0 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('CELL_OCCUPIED');
    });

    it('errs without drawn tile', () => {
      const state = freshGame();
      const r = placeTile(state, { x: 1, y: 0 });
      expect(r.ok).toBe(false);
    });
  });

  describe('skipMeeple', () => {
    it('advances turn after skip', () => {
      const state = freshGame();
      drawTile(state);
      // Find legal placement
      let placed = false;
      for (let a = 0; a < 4 && !placed; a++) {
        if (a > 0) rotatePending(state, 'CW');
        for (const c of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          if (placeTile(state, c).ok) { placed = true; break; }
        }
      }
      if (!placed) return;
      expect(state.phase).toBe('PLACING_MEEPLE');
      const prev = state.currentPlayerIndex;
      expect(skipMeeple(state).ok).toBe(true);
      expect(state.phase).toBe('PLACING_TILE');
      expect(state.currentPlayerIndex).toBe((prev + 1) % 2);
    });
  });

  describe('endGame', () => {
    it('sets GAME_OVER phase', () => {
      const state = freshGame();
      expect(endGame(state).ok).toBe(true);
      expect(state.phase).toBe('GAME_OVER');
    });

    it('errs if already over', () => {
      const state = freshGame();
      endGame(state);
      expect(endGame(state).ok).toBe(false);
    });
  });
});