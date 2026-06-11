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

/**
 * Iteration-3 detail palette for the procedural content generators
 * (`src/three/generators/*`). Arrays are sampled deterministically per tile.
 */
export const DETAIL = {
  /** Stone plaza the city sits on (the city zone is lowered to host buildings). */
  cityBase: '#cdb583',
  cityBaseHeight: 0.05,
  wall: '#bdb5a6',
  wallHeight: 0.11,
  wallThickness: 0.028,
  houseWalls: ['#e7d6b8', '#dcc59a', '#cdae84', '#e0c9a6'],
  roof: ['#b15a3c', '#a85138', '#9c4a32', '#c06848'],
  treeTrunk: '#7a5a3a',
  treeFoliage: ['#5f9e4a', '#6cae54', '#558d42', '#74b65c'],
  roadCurb: '#cfc6b0',
  monasteryWall: '#e9e3d6',
  monasteryRoof: '#9c4a32',
} as const;
