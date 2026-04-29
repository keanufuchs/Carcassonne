import type { TilePrototype, EdgeSide, SlotPos, Rotation } from '../types/tile';
import type { Coord, SegmentRef } from '../types';
import { coordKey } from '../types';
import {
  rotateSlot, opposite, stepCoord, ALL_SIDES, ALL_ROTATIONS,
  flipPos, rotatedEdge,
} from '../tile/rotation';
import { makePlacedTile } from '../tile/Tile';
import type { PlacedTile } from '../tile/Tile';
import type { Board } from './Board';
import { allEightNeighborCoords, countPlacedNeighbors, candidatePlacements } from './Board';
import {
  createFeature, attachSegment, lookupBySegment,
} from '../feature/segments';
import type { FeatureKind } from '../feature/Feature';
import { unify } from '../feature/merge';
import { detectCompletions } from '../feature/completion';
import type { Feature } from '../feature/Feature';

export interface PlacementResult {
  placed: PlacedTile;
  completedFeatures: Feature[];
}

// Module-level prototype cache populated on every placeTileInternal / canPlace call.
// Allows neighbor-edge lookups without threading prototype maps through every call site.
const _protoCache = new Map<string, TilePrototype>();

export function registerProto(proto: TilePrototype): void {
  _protoCache.set(proto.id, proto);
}

function getProto(id: string): TilePrototype {
  const p = _protoCache.get(id);
  if (!p) throw new Error(`Prototype ${id} not in cache — call registerProto or placeTileInternal first`);
  return p;
}

function getRotatedEdge(placed: PlacedTile, boardSide: EdgeSide): readonly [string, string, string] {
  return rotatedEdge(getProto(placed.prototypeId), boardSide, placed.rotation);
}

const SLOT_POSITIONS: SlotPos[] = ['L', 'C', 'R'];
const SLOT_IDX: Record<SlotPos, number> = { L: 0, C: 1, R: 2 };

function findSegRef(
  placed: PlacedTile,
  proto: TilePrototype,
  boardSide: EdgeSide,
  boardPos: SlotPos,
): SegmentRef {
  // Convert board-space (side, pos) to prototype space by un-rotating.
  const unrotated = rotateSlot(
    { side: boardSide, pos: boardPos },
    ((360 - placed.rotation) % 360) as Rotation,
  );
  const seg = proto.segments.find(s =>
    s.edgeSlots.some(es => es.side === unrotated.side && es.pos === unrotated.pos),
  );
  if (!seg) throw new Error(`No segment for ${boardSide}/${boardPos} on ${placed.tileId}`);
  return placed.segmentInstances[seg.localId].ref;
}

export function canPlace(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): boolean {
  registerProto(prototype);
  if (board.tiles.has(coordKey(coord))) return false;

  let hasAdjacent = false;
  for (const side of ALL_SIDES) {
    const neighbor = board.tiles.get(coordKey(stepCoord(coord, side)));
    if (!neighbor) continue;
    hasAdjacent = true;

    const newEdge      = rotatedEdge(prototype, side, rotation);
    const neighborEdge = getRotatedEdge(neighbor, opposite(side));

    for (const pos of SLOT_POSITIONS) {
      if (newEdge[SLOT_IDX[pos]] !== neighborEdge[SLOT_IDX[flipPos(pos)]]) return false;
    }
  }
  return hasAdjacent;
}

export function hasAnyLegalPlacement(board: Board, prototype: TilePrototype): boolean {
  registerProto(prototype);
  const candidates = candidatePlacements(board);
  for (const rotation of ALL_ROTATIONS) {
    for (const coord of candidates) {
      if (canPlace(board, prototype, coord, rotation)) return true;
    }
  }
  return false;
}

export function placeTileInternal(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): PlacementResult {
  registerProto(prototype);
  const placed = makePlacedTile(prototype, coord, rotation);
  const touchedIds = new Set<string>();

  // Create a fresh feature for each new segment.
  for (const seg of prototype.segments) {
    const kind = seg.kind as FeatureKind;
    const feature = createFeature(board.registry, kind);
    if (seg.kind !== 'MONASTERY') feature.openEdges = seg.edgeSlots.length;
    if (seg.kind === 'CITY' && prototype.hasShield && seg.isShielded) feature.shieldCount = 1;
    if (seg.kind === 'MONASTERY') {
      feature.monasteryTileId = placed.tileId;
      feature.monasterySurroundCount = countPlacedNeighbors(board, coord);
    }
    attachSegment(board.registry, feature, { tileId: placed.tileId, localId: seg.localId });
    touchedIds.add(feature.id);
  }

  board.tiles.set(coordKey(coord), placed);

  // Walk each neighboring tile; close and merge matching features.
  for (const side of ALL_SIDES) {
    const neighbor = board.tiles.get(coordKey(stepCoord(coord, side)));
    if (!neighbor) continue;
    const neighborProto = getProto(neighbor.prototypeId);
    const oppSide = opposite(side);

    for (const pos of SLOT_POSITIONS) {
      const newRef  = findSegRef(placed,   prototype,     side,    pos);
      const nRef    = findSegRef(neighbor, neighborProto, oppSide, flipPos(pos));

      const fNew      = lookupBySegment(board.registry, newRef);
      const fNeighbor = lookupBySegment(board.registry, nRef);

      fNew.openEdges      -= 1;
      fNeighbor.openEdges -= 1;

      if (fNew.id !== fNeighbor.id) {
        const loserId = fNew.id < fNeighbor.id ? fNeighbor.id : fNew.id;
        const winner  = unify(board.registry, fNew, fNeighbor);
        touchedIds.delete(loserId);
        touchedIds.add(winner.id);
      }
    }
  }

  // Update monastery surround counts for neighbors of the placed coord.
  for (const nc of allEightNeighborCoords(coord)) {
    const t = board.tiles.get(coordKey(nc));
    if (!t) continue;
    for (const seg of t.segmentInstances) {
      if (seg.kind === 'MONASTERY') {
        const f = lookupBySegment(board.registry, seg.ref);
        if (f.monasterySurroundCount !== undefined) {
          f.monasterySurroundCount += 1;
          touchedIds.add(f.id);
        }
      }
    }
  }

  return { placed, completedFeatures: detectCompletions(board.registry, touchedIds) };
}
