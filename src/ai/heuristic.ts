import type { Coord, SegmentRef, Rotation } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import { lookupBySegment } from '../core/feature/segments';
import type { Feature } from '../core/feature/Feature';
import type { AIDecision } from './AI';

const ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270];

interface ScoredMove {
  coord: Coord;
  rotation: Rotation;
  score: number;
}

/**
 * Heuristic AI.
 *
 * Two independent, sequential steps (no joint search):
 * 1. `computeHeuristicMove` chooses the best tile placement by board position.
 * 2. After the tile is placed, `chooseHeuristicMeeple` picks a meeple on it.
 *
 * Placement strategy (priority order):
 * 1. Connect to / extend own features
 * 2. Avoid helping opponent features
 * 3. Place on high-expansion-potential positions
 */
export function computeHeuristicMove(state: GameState): AIDecision {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const candidates = candidatePlacements(state.board);
  const moves: ScoredMove[] = [];

  for (const coord of candidates) {
    for (const rot of ALL_ROTATIONS) {
      if (!canPlace(state.board, state.pendingTile!, coord, rot)) continue;

      let score = 0;
      // Bonus for adjacency count (more neighbors = more feature connections)
      score += countAdjacentTiles(state, coord) * 5;
      // Bonus for connecting to own features
      score += estimateOwnFeatureConnections(state, coord, currentPlayer.id) * 15;
      // Penalty for connecting to opponent features (may help them)
      score -= estimateOpponentFeatureConnections(state, coord, currentPlayer.id) * 10;

      moves.push({ coord, rotation: rot, score });
    }
  }

  if (moves.length === 0) {
    // Fallback: pick first candidate with first rotation
    return { coord: candidates[0] ?? { x: 0, y: 1 }, rotation: 0 };
  }

  // Pick the best tile placement. The meeple decision is made separately, after
  // the tile is placed (see chooseHeuristicMeeple).
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];
  return { coord: best.coord, rotation: best.rotation };
}

function countAdjacentTiles(state: GameState, coord: Coord): number {
  let count = 0;
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      if (state.board.tiles.has(`${coord.x + dx},${coord.y + dy}`)) count++;
    }
  }
  return count;
}

function estimateOwnFeatureConnections(state: GameState, coord: Coord, playerId: string): number {
  let score = 0;
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      const key = `${coord.x + dx},${coord.y + dy}`;
      const tile = state.board.tiles.get(key);
      if (!tile) continue;
      for (const seg of tile.segmentInstances) {
        try {
          const f = lookupBySegment(state.board.registry, seg.ref);
          if (f.meeples.some(m => m.playerId === playerId)) score++;
        } catch { /* ignore */ }
      }
    }
  }
  return score;
}

function estimateOpponentFeatureConnections(state: GameState, coord: Coord, playerId: string): number {
  let score = 0;
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      const key = `${coord.x + dx},${coord.y + dy}`;
      const tile = state.board.tiles.get(key);
      if (!tile) continue;
      for (const seg of tile.segmentInstances) {
        try {
          const f = lookupBySegment(state.board.registry, seg.ref);
          if (f.meeples.some(m => m.playerId !== playerId)) score++;
        } catch { /* ignore */ }
      }
    }
  }
  return score;
}

// ── Meeple choice (step 2, after the tile is placed) ──────────────────────────

// Base attractiveness by feature kind. Fields are never claimed by the heuristic
// (farms tie up a meeple until end-game for little reliable gain).
const MEEPLE_BASE: Record<string, number> = {
  CITY: 8, MONASTERY: 7, ROAD: 4, FIELD: -Infinity,
};

/**
 * Value of claiming the feature behind `ref` on the just-placed tile. Rewards
 * high-value kinds, larger features, and proximity to completion. Returns
 * -Infinity for fields so they are never chosen.
 */
function scoreMeepleTarget(state: GameState, ref: SegmentRef): number {
  let feature: Feature;
  try { feature = lookupBySegment(state.board.registry, ref); } catch { return -Infinity; }

  const base = MEEPLE_BASE[feature.kind] ?? -Infinity;
  if (base === -Infinity) return -Infinity;

  const tileCount = new Set(Array.from(feature.segments, s => s.split('#')[0])).size;
  if (feature.completed) return base + 12 + tileCount;
  if (feature.kind === 'MONASTERY') return base + (feature.monasterySurroundCount ?? 0);
  // Cities/roads: closer to closing (fewer open edges) = more reliable points.
  return base + Math.max(0, 6 - feature.openEdges * 2);
}

/**
 * Decide which (if any) legal meeple target on the just-placed tile to claim.
 * Called after placement, so `targets` are the real, legal `SegmentRef`s.
 * Claims the highest-value non-field feature, or none if only fields are open.
 */
export function chooseHeuristicMeeple(
  state: GameState,
  targets: SegmentRef[],
): SegmentRef | null {
  const player = state.players[state.currentPlayerIndex];
  if (player.meeplesAvailable <= 0 || targets.length === 0) return null;

  let best: SegmentRef | null = null;
  let bestScore = 0;
  for (const ref of targets) {
    const s = scoreMeepleTarget(state, ref);
    if (s > bestScore) { bestScore = s; best = ref; }
  }
  return best;
}
