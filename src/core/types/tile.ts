export type Terrain = 'CITY' | 'ROAD' | 'FIELD';
export type EdgeSide = 'N' | 'E' | 'S' | 'W';
export type SlotPos = 'L' | 'C' | 'R';
export type Rotation = 0 | 90 | 180 | 270;
export type SegmentKind = 'CITY' | 'ROAD' | 'FIELD' | 'MONASTERY';
export type SegmentLocalId = number;

export interface EdgeSlot {
  side: EdgeSide;
  pos: SlotPos;
}

export interface SegmentBlueprint {
  localId: SegmentLocalId;
  kind: SegmentKind;
  edgeSlots: EdgeSlot[];
  isShielded?: true;
}

export interface TilePrototype {
  id: string;
  edges: Record<EdgeSide, [Terrain, Terrain, Terrain]>;
  segments: SegmentBlueprint[];
  hasMonastery: boolean;
  hasShield: boolean;
}
