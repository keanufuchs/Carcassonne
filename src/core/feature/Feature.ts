import type { FeatureId, PlayerId, SegmentRef, TileId } from '../types';

export type FeatureKind = 'CITY' | 'ROAD' | 'MONASTERY' | 'FIELD';

export interface MeeplePlacement {
  playerId: PlayerId;
  segmentRef: SegmentRef;
}

export interface Feature {
  id: FeatureId;
  kind: FeatureKind;
  segments: Set<string>;
  openEdges: number;
  meeples: MeeplePlacement[];
  shieldCount: number;
  completed: boolean;
  monasteryTileId?: TileId;
  monasterySurroundCount?: number;
  closedCitiesAdjacent?: Set<FeatureId>;
}
