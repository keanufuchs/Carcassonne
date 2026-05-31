import type { Coord, Rotation, SegmentRef } from '../core/types';
import type { EdgeSide, SlotPos } from '../core/types/tile';
import type { GameState } from '../core/game/GameState';
import type { PlacedTile } from '../core/tile/Tile';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import { rotateSide, stepCoord, rotatedEdge, opposite, flipPos } from '../core/tile/rotation';
import { lookupBySegment } from '../core/feature/segments';

/**
 * Read-only board analysis shared by the in-process AI fallback (`intelligent.ts`)
 * and the MCP server (`server/mcp-ai.ts`). Both must return identical tool payloads
 * so the LLM gets the same spatial grounding whether or not the MCP server is online.
 *
 * Has no LLM/network/env dependencies — pure functions over GameState.
 */

const SIDES4: readonly EdgeSide[] = ['N', 'E', 'S', 'W'];
const SLOTS: readonly { pos: SlotPos; idx: 0 | 1 | 2 }[] = [
  { pos: 'L', idx: 0 }, { pos: 'C', idx: 1 }, { pos: 'R', idx: 2 },
];
const ALL_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

// ── Move consequence analysis ───────────────────────────────────────────────
// The LLM is poor at the tile geometry, so we precompute, for each legal move,
// which existing CITY/ROAD features it would actually connect to. This lets the
// model VERIFY claims like "extends my city" against real data instead of
// guessing — and never claim to extend a feature a move does not touch.

/** SegmentRef of the segment a placed tile exposes on board (side, pos), if any. */
function segmentRefAt(placed: PlacedTile, boardSide: EdgeSide, boardPos: SlotPos): SegmentRef | null {
  for (const si of placed.segmentInstances)
    for (const slot of si.edgeSlots)
      // A segment's edgeSlot.side rotates with the tile; pos is unchanged.
      if (rotateSide(slot.side, placed.rotation) === boardSide && slot.pos === boardPos)
        return si.ref;
  return null;
}

export interface MoveConnection {
  featureId: string;
  kind: string;
  openEdges: number;
  shieldCount: number;
  completed: boolean;
  meeples: string[];
}

/** Existing CITY/ROAD features that placing the pending tile at (coord, rotation) would join. */
export function connectionsForMove(state: GameState, coord: Coord, rotation: Rotation): MoveConnection[] {
  const proto = state.pendingTile;
  if (!proto) return [];
  const out = new Map<string, MoveConnection>();

  for (const side of SIDES4) {
    const n = stepCoord(coord, side);
    const neighbor = state.board.tiles.get(`${n.x},${n.y}`);
    if (!neighbor) continue;
    const edge = rotatedEdge(proto, side, rotation); // pending tile's terrain per slot on this side
    for (const { pos, idx } of SLOTS) {
      const terrain = edge[idx];
      if (terrain !== 'CITY' && terrain !== 'ROAD') continue;
      const ref = segmentRefAt(neighbor, opposite(side), flipPos(pos));
      if (!ref) continue;
      let f;
      try { f = lookupBySegment(state.board.registry, ref); } catch { continue; }
      if (f.kind !== 'CITY' && f.kind !== 'ROAD') continue;
      if (!out.has(f.id)) {
        out.set(f.id, {
          featureId: f.id, kind: f.kind, openEdges: f.openEdges,
          shieldCount: f.shieldCount, completed: f.completed,
          meeples: f.meeples.map(m => m.playerId),
        });
      }
    }
  }
  return [...out.values()];
}

// ── Tool views (shared payload shapes) ──────────────────────────────────────

/** `list_legal_moves` payload: every legal move annotated with the features it would join. */
export function legalMovesView(state: GameState): {
  moves: { coord: { x: number; y: number }; rotation: number; connectsTo: MoveConnection[] }[];
  totalMoves: number;
  tileId: string | null;
  hasMonastery?: boolean;
  hasShield?: boolean;
} {
  if (!state.pendingTile) return { moves: [], totalMoves: 0, tileId: null };

  const moves: { coord: { x: number; y: number }; rotation: number; connectsTo: MoveConnection[] }[] = [];
  for (const coord of candidatePlacements(state.board))
    for (const rot of ALL_ROTATIONS)
      if (canPlace(state.board, state.pendingTile, coord, rot))
        moves.push({
          coord: { x: coord.x, y: coord.y },
          rotation: rot,
          connectsTo: connectionsForMove(state, coord, rot),
        });

  return {
    moves: moves.slice(0, 30), // cap to keep token usage manageable
    totalMoves: moves.length,
    tileId: state.pendingTile.id,
    hasMonastery: state.pendingTile.hasMonastery,
    hasShield: state.pendingTile.hasShield,
  };
}

/** `get_board_features` payload: every feature with spatial coords for orientation. */
export function boardFeaturesView(state: GameState): {
  features: unknown[];
  boardTileCount: number;
} {
  // Reverse map: tileId → PlacedTile for O(1) lookups below.
  const tileById = new Map<string, PlacedTile>();
  for (const tile of state.board.tiles.values()) tileById.set(tile.tileId, tile);

  const features = [...state.board.registry.features.values()].map(f => {
    const tileIds = new Set([...f.segments].map(s => s.split('#')[0]));
    const tileCoords = [...tileIds]
      .map(id => tileById.get(id)?.coord)
      .filter((c): c is Coord => c !== undefined);

    // Empty cells adjacent to this feature's open edges so the LLM knows exactly
    // which board positions extend or close it.
    const openEdgeNeighborSet = new Set<string>();
    const openEdgeNeighborCoords: Coord[] = [];
    for (const segKey of f.segments) {
      const [tileId, localIdStr] = segKey.split('#');
      const placed = tileById.get(tileId);
      if (!placed) continue;
      const localId = Number(localIdStr);
      const si = placed.segmentInstances.find(s => s.ref.localId === localId);
      if (!si) continue;
      for (const slot of si.edgeSlots) {
        const boardSide = rotateSide(slot.side, placed.rotation);
        const neighbor = stepCoord(placed.coord, boardSide);
        const nk = `${neighbor.x},${neighbor.y}`;
        if (!state.board.tiles.has(nk) && !openEdgeNeighborSet.has(nk)) {
          openEdgeNeighborSet.add(nk);
          openEdgeNeighborCoords.push(neighbor);
        }
      }
    }

    return {
      id: f.id,
      kind: f.kind,
      tileCount: tileIds.size,
      tileCoords,
      openEdgeNeighborCoords,
      openEdges: f.openEdges,
      shieldCount: f.shieldCount,
      completed: f.completed,
      meeples: f.meeples.map(m => m.playerId),
    };
  });

  return { features, boardTileCount: state.board.tiles.size };
}

/** `get_player_status` payload. */
export function playerStatusView(state: GameState): unknown {
  const cur = state.players[state.currentPlayerIndex];
  return {
    players: state.players.map((p, i) => ({
      id: p.id, name: p.name, score: p.score,
      meeplesAvailable: p.meeplesAvailable,
      isCurrent: i === state.currentPlayerIndex,
    })),
    tilesRemaining: state.deck.remaining.length,
    currentPlayerId: cur.id,
    currentPlayerName: cur.name,
    pendingTileId: state.pendingTile?.id ?? null,
  };
}
