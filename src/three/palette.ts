import type { SegmentKind } from '../core/types/tile';

/** A Carcassonne tile occupies a 1×1 footprint centred on the world origin. */
export const TILE_SIZE = 1;

/** Default road stroke width in SVG units (viewBox is 0..100). */
export const ROAD_DEFAULT_WIDTH = 10;

/** Ground/base plate colour (slightly darker than fields). */
export const BASE_COLOR = '#5a8a4a';

export interface KindStyle {
  /** Fill colour of the extruded zone. */
  color: string;
  /** Extrusion height in world units (tile is 1×1). */
  height: number;
}

/**
 * Iteration-1 styling: each segment kind is rendered as a flat-extruded,
 * coloured zone. Heights are deliberately small so the tile reads as a relief
 * map that can be visually compared against the original PNG/SVG.
 */
export const PALETTE: Record<SegmentKind, KindStyle> = {
  FIELD: { color: '#7fbf6a', height: 0.02 },
  ROAD: { color: '#e8e2d0', height: 0.05 },
  CITY: { color: '#c9b07a', height: 0.18 },
  MONASTERY: { color: '#d6d6d6', height: 0.22 },
};
