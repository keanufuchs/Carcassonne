import type { Rotation, SegmentRef } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import type { AIDecision } from './AI';

const ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270];

/**
 * Random AI — picks a random legal placement and optionally places a meeple.
 * Used as a baseline opponent and E2E test driver.
 */
export async function computeRandomMove(state: GameState): Promise<AIDecision> {
  const candidates = candidatePlacements(state.board);
  const legalMoves: Array<{ coord: { x: number; y: number }; rotation: Rotation }> = [];

  // Shuffle candidates and rotations for randomness
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const shuffledRots = [...ALL_ROTATIONS].sort(() => Math.random() - 0.5);

  for (const coord of shuffled) {
    for (const rot of shuffledRots) {
      if (state.pendingTile && canPlace(state.board, state.pendingTile, coord, rot)) {
        legalMoves.push({ coord, rotation: rot });
      }
    }
  }

  if (legalMoves.length === 0) {
    // No legal move — this shouldn't happen normally
    return { coord: { x: 0, y: 1 }, rotation: 0 };
  }

  const chosen = legalMoves[Math.floor(Math.random() * legalMoves.length)];

  // Meeple decision happens after placement (see chooseRandomMeeple), when the
  // real tile id and legal targets are known.
  return { coord: chosen.coord, rotation: chosen.rotation };
}

/**
 * Random meeple decision for the just-placed tile. Called after placement, so
 * `targets` are the real, legal `SegmentRef`s. Claims a random target most of
 * the time, occasionally skipping to vary play (and conserve meeples).
 */
export function chooseRandomMeeple(
  state: GameState,
  targets: SegmentRef[],
): SegmentRef | null {
  const player = state.players[state.currentPlayerIndex];
  if (player.meeplesAvailable <= 0 || targets.length === 0) return null;
  if (Math.random() < 0.25) return null;
  return targets[Math.floor(Math.random() * targets.length)];
}
