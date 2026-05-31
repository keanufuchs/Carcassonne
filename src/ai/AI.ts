import type { Coord, SegmentRef } from '../core/types';
import type { GameState } from '../core/game/GameState';

export interface AIDecision {
  coord: Coord;
  rotation: number;
  meepleRef?: SegmentRef;
}

export interface AI {
  readonly name: string;
  /**
   * Given the current game state, decide on the next move.
   * Returns null if no move is possible (should be handled by game controller).
   */
  decide(state: GameState): Promise<AIDecision>;
}