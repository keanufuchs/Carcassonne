import type { SegmentKind } from '../core/types/tile';

/** A Carcassonne tile occupies a 1×1 footprint centred on the world origin. */
export const TILE_SIZE = 1;

/** Default road stroke width in SVG units (viewBox is 0..100). */
export const ROAD_DEFAULT_WIDTH = 10;

/** Ground/base plate colour (a touch darker than the fields). */
export const BASE_COLOR = '#6b9a55';

export interface KindStyle {
  /** Fill colour of the extruded zone. */
  color: string;
  /** Extrusion height in world units (tile is 1×1). */
  height: number;
}

/**
 * Iteration-2 styling: a softer, warmer "Townscaper-adjacent" palette with a
 * little more relief between kinds. Each segment is still a flat-extruded
 * coloured zone (procedural detail arrives in iteration 3); the materials and
 * lighting (see Tile3DPanel) now carry the look.
 */
export const PALETTE: Record<SegmentKind, KindStyle> = {
  FIELD: { color: '#8cc06b', height: 0.03 },
  ROAD: { color: '#efe7d3', height: 0.06 },
  CITY: { color: '#d9c191', height: 0.20 },
  MONASTERY: { color: '#e6e1d6', height: 0.26 },
};

/** Subtle bevel applied to extruded zones for softer, catch-the-light edges. */
export const BEVEL = { size: 0.006, segments: 2 };
