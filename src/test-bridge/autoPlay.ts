// ── Deterministic full-game auto-play driver ─────────────────────────────────
//
// DEV/test-only helper that plays a complete game to its natural end through the
// public GameController API, using a *seeded* PRNG so the entire playthrough is
// reproducible. Every move is routed through the real engine, which validates
// legality — so the driver can only ever make rule-compliant moves and throws
// on the first rejected action. This is the engine-level counterpart to the
// random AI used as an E2E test driver (see src/ai/random.ts).

import type { GameController } from '../controller/GameController';
import type { Rotation, SegmentRef } from '../core/types';
import { candidatePlacements } from '../core/board/Board';
import { canPlace } from '../core/board/placement';

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Mulberry32 — small, fast, deterministic PRNG. Same seed → same sequence. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AutoPlayResult {
  /** Tiles actually placed by the driver (excludes the start tile). */
  placements: number;
  /** Meeples deployed across the whole game. */
  meeplesPlaced: number;
  /** Turn-loop iterations (diagnostic; bounded by maxIterations). */
  iterations: number;
}

/**
 * Play `ctrl`'s game to GAME_OVER with deterministic, rule-compliant moves.
 * Throws on any engine rejection (= rule break) or if it fails to terminate
 * within `maxIterations` (= guard against a non-terminating game loop).
 */
export function autoPlayToEnd(
  ctrl: GameController,
  seed = 1,
  maxIterations = 5000,
): AutoPlayResult {
  const rng = makeRng(seed);
  let placements = 0;
  let meeplesPlaced = 0;
  let iterations = 0;

  while (ctrl.getState().phase !== 'GAME_OVER') {
    if (iterations++ > maxIterations) {
      throw new Error('autoPlayToEnd: exceeded maxIterations — game did not terminate');
    }

    const phase = ctrl.getState().phase;
    if (phase === 'PLACING_TILE') {
      if (playTileTurn(ctrl, rng)) placements++;
    } else if (phase === 'PLACING_MEEPLE') {
      if (playMeepleTurn(ctrl, rng)) meeplesPlaced++;
    } else {
      throw new Error(`autoPlayToEnd: unexpected phase "${phase}"`);
    }
  }

  return { placements, meeplesPlaced, iterations };
}

/** Returns true if a tile was placed (false if the draw ended the game). */
function playTileTurn(ctrl: GameController, rng: () => number): boolean {
  const draw = ctrl.drawTile();
  if (!draw.ok) throw new Error(`drawTile rejected: ${draw.error} (${draw.message})`);

  const state = ctrl.getState();
  // drawTile triggers end-game when the deck is exhausted / no tile is placeable.
  if (state.phase !== 'PLACING_TILE' || !state.pendingTile) return false;

  const pending = state.pendingTile;
  const moves: Array<{ coord: { x: number; y: number }; rotation: Rotation }> = [];
  for (const coord of candidatePlacements(state.board)) {
    for (const rotation of ROTATIONS) {
      if (canPlace(state.board, pending, coord, rotation)) moves.push({ coord, rotation });
    }
  }
  if (moves.length === 0) {
    throw new Error('autoPlayToEnd: engine drew a placeable tile but no legal move was found');
  }

  // Sort for full determinism independent of candidate iteration order.
  moves.sort((a, b) => a.coord.x - b.coord.x || a.coord.y - b.coord.y || a.rotation - b.rotation);
  const move = moves[Math.floor(rng() * moves.length)];

  while (ctrl.getState().pendingRotation !== move.rotation) {
    const r = ctrl.rotatePending('CW');
    if (!r.ok) throw new Error(`rotatePending rejected: ${r.error} (${r.message})`);
  }

  const placed = ctrl.placeTile(move.coord);
  if (!placed.ok) {
    throw new Error(`placeTile rejected at (${move.coord.x},${move.coord.y}): ${placed.error} (${placed.message})`);
  }
  return true;
}

/** Returns true if a meeple was deployed (false if the turn was skipped). */
function playMeepleTurn(ctrl: GameController, rng: () => number): boolean {
  const targets = [...ctrl.getMeepleTargetsForLastTile()]
    .sort((a: SegmentRef, b: SegmentRef) => a.localId - b.localId);

  // Claim a feature ~60% of the time when a legal target exists; otherwise skip.
  if (targets.length > 0 && rng() < 0.6) {
    const ref = targets[Math.floor(rng() * targets.length)];
    const r = ctrl.placeMeeple(ref);
    if (!r.ok) throw new Error(`placeMeeple rejected: ${r.error} (${r.message})`);
    return true;
  }

  const r = ctrl.skipMeeple();
  if (!r.ok) throw new Error(`skipMeeple rejected: ${r.error} (${r.message})`);
  return false;
}
