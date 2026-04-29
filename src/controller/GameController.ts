import type { Coord, SegmentRef, Result, Rotation, ErrorCode } from '../core/types';
import { err, okVoid } from '../core/types';
import type { GameState } from '../core/game/GameState';
import {
  startGame, drawTile, rotatePending,
  placeTile, placeMeeple, skipMeeple, getMeepleTargets, endGame,
} from '../core/game/Game';
import { canPlace } from '../core/board/placement';
import { createPubSub } from './pubsub';
import type { Unsubscribe } from './pubsub';

export interface GameController {
  startGame(playerNames: string[]): Result;
  drawTile(): Result;
  rotatePending(direction: 'CW' | 'CCW'): Result;
  placeTile(coord: Coord): Result;
  placeMeeple(ref: SegmentRef): Result;
  skipMeeple(): Result;
  endGame(): Result;
  getState(): Readonly<GameState>;
  previewPlacement(coord: Coord, rotation: Rotation): { legal: true } | { legal: false; reason: ErrorCode };
  getMeepleTargetsForLastTile(): SegmentRef[];
  subscribe(listener: (state: Readonly<GameState>) => void): Unsubscribe;
}

export function createGameController(initialState?: GameState): GameController {
  let state: GameState | null = initialState ?? null;
  const pubsub = createPubSub<Readonly<GameState>>();

  function requireState(): GameState {
    if (!state) throw new Error('Game not started');
    return state;
  }

  function publish(): void { pubsub.publish(requireState()); }

  return {
    startGame(playerNames) {
      try {
        state = startGame(playerNames);
        publish();
        return okVoid();
      } catch (e) {
        return err('WRONG_PHASE', String(e));
      }
    },

    drawTile() {
      const s = requireState();
      const r = drawTile(s);
      if (r.ok) publish();
      return r;
    },

    rotatePending(direction) {
      const s = requireState();
      const r = rotatePending(s, direction);
      if (r.ok) publish();
      return r;
    },

    placeTile(coord) {
      const s = requireState();
      const r = placeTile(s, coord);
      if (r.ok) publish();
      return r;
    },

    placeMeeple(ref) {
      const s = requireState();
      const r = placeMeeple(s, ref);
      if (r.ok) publish();
      return r;
    },

    skipMeeple() {
      const s = requireState();
      const r = skipMeeple(s);
      if (r.ok) publish();
      return r;
    },

    endGame() {
      const s = requireState();
      const r = endGame(s);
      if (r.ok) publish();
      return r;
    },

    getState() { return requireState(); },

    previewPlacement(coord, rotation) {
      const s = requireState();
      if (s.phase !== 'PLACING_TILE' || !s.pendingTile) {
        return { legal: false, reason: 'WRONG_PHASE' as ErrorCode };
      }
      if (canPlace(s.board, s.pendingTile, coord, rotation)) return { legal: true };
      const key = `${coord.x},${coord.y}`;
      if (s.board.tiles.has(key)) return { legal: false, reason: 'CELL_OCCUPIED' as ErrorCode };
      return { legal: false, reason: 'EDGE_MISMATCH' as ErrorCode };
    },

    getMeepleTargetsForLastTile() { return getMeepleTargets(requireState()); },

    subscribe(listener) { return pubsub.subscribe(listener); },
  };
}
