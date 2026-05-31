import type { Coord, SegmentRef, Rotation } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import { getMeepleTargets } from '../core/game/Game';
import { lookupBySegment } from '../core/feature/segments';
import type { AIDecision } from './AI';

const ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270];

interface ScoredMove {
  coord: Coord;
  rotation: Rotation;
  meepleRef?: SegmentRef;
  score: number;
}

/**
 * Heuristic-based fallback AI.
 *
 * Strategy (priority order):
 * 1. Complete own features (highest immediate point gain)
 * 2. Block opponent features (prevent opponent from scoring)
 * 3. Place on high-expansion-potential positions
 * 4. Always place a meeple if a good feature exists
 */
export function computeHeuristicMove(state: GameState): AIDecision {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const candidates = candidatePlacements(state.board);
  const moves: ScoredMove[] = [];

  for (const coord of candidates) {
    for (const rot of ALL_ROTATIONS) {
      if (!canPlace(state.board, state.pendingTile!, coord, rot)) continue;

      // Simulate placement to evaluate: this is a light heuristic based on
      // immediate scoring potential, not a full simulation
      let score = 0;

      // Bonus for adjacency count (more neighbors = more feature connections)
      const neighborCount = countAdjacentTiles(state, coord);
      score += neighborCount * 5;

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

  // Sort by score descending, pick best
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];

  // Decide meeple placement
  let meepleRef: SegmentRef | undefined;
  if (currentPlayer.meeplesAvailable > 0) {
    // We'll simulate placement to check meeple targets via the actual game API
    // For the heuristic, we evaluate during the AI decide cycle
    const targets = getMeepleTargetsForPlacement(state, best.coord);
    if (targets.length > 0) {
      // Prefer placing on features that can complete soon
      meepleRef = pickBestMeepleTarget(targets, state);
    }
  }

  return { coord: best.coord, rotation: best.rotation, meepleRef };
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

// These helpers are called from AI decide cycle (before actual placement)
function getMeepleTargetsForPlacement(state: GameState, coord: Coord): SegmentRef[] {
  // We can't call getMeepleTargets directly because it checks lastPlacedTileId.
  // Instead, we check all segments of the pending tile that would be placed.
  if (!state.pendingTile) return [];
  const tileId = state.pendingTile.id;
  return state.pendingTile.segments
    .filter(seg => {
      // Check if any adjacent features on this tile are already occupied
      // We approximate: skip monastery if player has few meeples (save for better features)
      return true; // Heuristic: all segments are valid targets
    })
    .map(seg => ({ tileId, localId: seg.localId }));
}

function pickBestMeepleTarget(targets: SegmentRef[], state: GameState): SegmentRef | undefined {
  // Prioritize: CITY > MONASTERY > ROAD > FIELD
  // This is a simplified heuristic
  if (!state.pendingTile) return targets[0];

  const scored = targets.map(ref => {
    const seg = state.pendingTile!.segments.find(s => s.localId === ref.localId);
    if (!seg) return { ref, score: 0 };
    const kindScores: Record<string, number> = { CITY: 40, MONASTERY: 30, ROAD: 20, FIELD: 10 };
    return { ref, score: kindScores[seg.kind] ?? 0 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].ref;
}