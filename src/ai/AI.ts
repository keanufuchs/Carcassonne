import type { Coord, SegmentRef } from '../core/types';
import type { GameState } from '../core/game/GameState';

export interface AIDecision {
  coord: Coord;
  rotation: number;
  meepleRef?: SegmentRef;
  /**
   * True when the producer of this decision made an authoritative meeple choice
   * that must be honoured verbatim — including an explicit "no meeple" (meepleRef
   * undefined). Used by the LLM AI so its decision to skip a meeple is not
   * overridden by the heuristic meeple chooser. When falsy, the meeple is decided
   * post-placement by the per-mode chooser.
   */
  meepleResolved?: boolean;
}

export interface AI {
  readonly name: string;
  /**
   * Given the current game state, decide on the next move.
   * Returns null if no move is possible (should be handled by game controller).
   */
  decide(state: GameState): Promise<AIDecision>;
}