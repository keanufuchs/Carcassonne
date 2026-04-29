import type { TilePrototype, SegmentKind, Rotation } from '../types/tile';
import type { TileId, SegmentRef, Coord } from '../types';

export interface SegmentInstance {
  ref: SegmentRef;
  kind: SegmentKind;
}

export interface PlacedTile {
  tileId: TileId;
  prototypeId: string;
  coord: Coord;
  rotation: Rotation;
  segmentInstances: SegmentInstance[];
}

let _nextTileSeq = 1;

export function makePlacedTile(
  proto: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): PlacedTile {
  const tileId = `T${_nextTileSeq++}`;
  return {
    tileId,
    prototypeId: proto.id,
    coord,
    rotation,
    segmentInstances: proto.segments.map(s => ({
      ref: { tileId, localId: s.localId },
      kind: s.kind,
    })),
  };
}

export function _resetTileSeq(): void { _nextTileSeq = 1; }
