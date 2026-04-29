import type { EdgeSide, SlotPos, Rotation, EdgeSlot, TilePrototype, Terrain } from '../types/tile';

const SIDES: EdgeSide[] = ['N', 'E', 'S', 'W'];

export function flipPos(p: SlotPos): SlotPos {
  return p === 'L' ? 'R' : p === 'R' ? 'L' : 'C';
}

export function opposite(side: EdgeSide): EdgeSide {
  return SIDES[(SIDES.indexOf(side) + 2) % 4];
}

export function stepCoord(coord: { x: number; y: number }, side: EdgeSide): { x: number; y: number } {
  switch (side) {
    case 'N': return { x: coord.x,     y: coord.y - 1 };
    case 'S': return { x: coord.x,     y: coord.y + 1 };
    case 'E': return { x: coord.x + 1, y: coord.y };
    case 'W': return { x: coord.x - 1, y: coord.y };
  }
}

export function rotateSide(side: EdgeSide, r: Rotation): EdgeSide {
  return SIDES[(SIDES.indexOf(side) + r / 90) % 4];
}

export function rotateSlot(slot: EdgeSlot, r: Rotation): EdgeSlot {
  return { side: rotateSide(slot.side, r), pos: slot.pos };
}

export function rotatedEdge(
  proto: TilePrototype,
  boardSide: EdgeSide,
  r: Rotation,
): readonly [Terrain, Terrain, Terrain] {
  // When a tile is rotated CW by r, what is now at boardSide was originally at rotate(boardSide, -r).
  const srcSide = SIDES[(SIDES.indexOf(boardSide) + (4 - r / 90)) % 4] as EdgeSide;
  return proto.edges[srcSide];
}

export const ALL_SIDES: readonly EdgeSide[] = SIDES;
export const ALL_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
