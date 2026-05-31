import type { Rotation } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import { getMeepleTargets } from '../core/game/Game';
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

  // For meeple decision, we need to actually place first, then check targets
  // We just return the placement; meeple decision happens after placement
  return { coord: chosen.coord, rotation: chosen.rotation };
}
