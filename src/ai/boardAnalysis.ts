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

export const MOVE_DISPLAY_CAP = 30;

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

/**
 * Generates a short, factual one-liner describing what a move actually does,
 * derived entirely from ground-truth connection data — never from LLM free text.
 */
export function generateMoveReasoning(connections: MoveConnection[], playerId: string): string {
  if (connections.length === 0) return 'Start new feature';

  const own = connections.filter(c => c.meeples.includes(playerId));
  const opponent = connections.filter(c => c.meeples.length > 0 && !c.meeples.includes(playerId));

  const completing = own.find(c => c.openEdges === 1);
  if (completing) {
    const shield = completing.shieldCount > 0 ? ` (${completing.shieldCount} shield)` : '';
    return `Complete own ${completing.kind}${shield}`;
  }

  const blocking = opponent.find(c => c.openEdges === 1);
  if (blocking) return `Block opponent ${blocking.kind} (1 edge left)`;

  if (own.length > 0) {
    const best = [...own].sort((a, b) =>
      (b.kind === 'CITY' ? 1 : 0) - (a.kind === 'CITY' ? 1 : 0) ||
      b.shieldCount - a.shieldCount,
    )[0];
    const shield = best.shieldCount > 0 ? ` +${best.shieldCount} shield` : '';
    return `Extend own ${best.kind} (${best.openEdges} open)${shield}`;
  }

  return `Join ${connections[0].kind} (${connections[0].openEdges} open)`;
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

export function applyMoveCap<T>(allMoves: T[]): { moves: T[]; totalMoves: number } {
  return { moves: allMoves.slice(0, MOVE_DISPLAY_CAP), totalMoves: allMoves.length };
}

/** `list_legal_moves` payload: every legal move annotated with the features it would join. */
export function legalMovesView(state: GameState): {
  moves: { coord: { x: number; y: number }; rotation: number; connectsTo: MoveConnection[] }[];
  totalMoves: number;
  tileId: string | null;
  hasMonastery?: boolean;
  hasShield?: boolean;
  boardTileCount: number;
} {
  if (!state.pendingTile) return { moves: [], totalMoves: 0, tileId: null, boardTileCount: state.board.tiles.size };

  const moves: { coord: { x: number; y: number }; rotation: number; connectsTo: MoveConnection[] }[] = [];
  for (const coord of candidatePlacements(state.board))
    for (const rot of ALL_ROTATIONS)
      if (canPlace(state.board, state.pendingTile, coord, rot))
        moves.push({
          coord: { x: coord.x, y: coord.y },
          rotation: rot,
          connectsTo: connectionsForMove(state, coord, rot),
        });

  const { moves: cappedMoves, totalMoves } = applyMoveCap(moves);
  return {
    moves: cappedMoves,
    totalMoves,
    tileId: state.pendingTile.id,
    hasMonastery: state.pendingTile.hasMonastery,
    hasShield: state.pendingTile.hasShield,
    boardTileCount: state.board.tiles.size,
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

export interface MeepleTargetInfo {
  segmentLocalId: number;
  kind: string;
  claimable: boolean;
  openEdges?: number;
  shieldCount?: number;
}

/** `get_meeple_targets` payload: which segments on the pending tile are legally claimable. */
export function meeplesView(state: GameState, coord: Coord, rotation: Rotation): {
  meeplesAvailable: number;
  targets: MeepleTargetInfo[];
} {
  const proto = state.pendingTile;
  const player = state.players[state.currentPlayerIndex];
  if (!proto) return { meeplesAvailable: player.meeplesAvailable, targets: [] };

  const targets: MeepleTargetInfo[] = proto.segments.map(seg => {
    let claimable = true;
    let openEdges: number | undefined;
    let shieldCount: number | undefined;

    for (const slot of seg.edgeSlots) {
      const boardSide = rotateSide(slot.side, rotation);
      const n = stepCoord(coord, boardSide);
      const neighbor = state.board.tiles.get(`${n.x},${n.y}`);
      if (!neighbor) continue;
      const ref = segmentRefAt(neighbor, opposite(boardSide), flipPos(slot.pos));
      if (!ref) continue;
      try {
        const feature = lookupBySegment(state.board.registry, ref);
        if (feature.meeples.length > 0) claimable = false;
        openEdges = feature.openEdges;
        shieldCount = feature.shieldCount;
      } catch { /* no feature at this slot */ }
    }

    return { segmentLocalId: seg.localId, kind: seg.kind, claimable, openEdges, shieldCount };
  });

  return { meeplesAvailable: player.meeplesAvailable, targets };
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
