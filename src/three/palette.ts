import type { SegmentKind } from '../core/types/tile';

/** A Carcassonne tile occupies a 1×1 footprint centred on the world origin. */
export const TILE_SIZE = 1;

/** Default road stroke width in SVG units (viewBox is 0..100). */
export const ROAD_DEFAULT_WIDTH = 10;

/**
 * Organic variance for the topology-derived layout (`layoutRegions.ts`).
 * Variance values are the maximum perpendicular sway as a fraction of the tile
 * edge (0.15 → 15 SVG units). Setting both to 0 reproduces the exact
 * straight-line/perfect-arc shapes. Deterministic per tile prototype.
 */
export const VARIANCE = {
  /** Max perpendicular road sway. */
  roadVariance: 0.15,
  /** Max perpendicular sway of interior city boundaries. */
  cityVariance: 0.10,
  /** Chaikin smoothing passes applied to displaced city boundary chains. */
  smoothingIterations: 1,
};

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
 * Townscaper-inspired detailing config (2026-06-12). All tunables for the
 * richer procedural content live here — generators must not hard-wire magic
 * numbers. Sampled deterministically per tile via the seeded RNG.
 * See docs/superpowers/specs/2026-06-12-townscaper-tile-detailing-design.md.
 */
export const TOWN = {
  /** Roof archetype mix and trim. Weights are relative (normalised at use). */
  roof: {
    weights: { gable: 0.5, hip: 0.3, clip: 0.2 },
    /** Eave slab overhang beyond the body footprint, per side. */
    eaveOverhang: 0.012,
    eaveThickness: 0.012,
    /** Ridge cap cross-section on gabled roofs. */
    ridgeSize: 0.013,
  },
  /** Per-instance colour variation (HSL deltas, applied symmetrically ±). */
  colorJitter: { h: 0.02, s: 0.08, l: 0.07 },
  /** Window/door facade detail. */
  facade: {
    windowProbability: 0.75,
    window: { w: 0.016, h: 0.02, depth: 0.01, color: '#3b4658' },
    door: { w: 0.018, h: 0.032, depth: 0.01 },
  },
  chimney: { probability: 0.4, size: 0.014, height: 0.05, color: '#9c8c79' },
  foundation: { overhang: 0.01, height: 0.014, color: '#b9aa90' },
  /** Small handmade asymmetry on house yaw (radians, applied ±). */
  house: { yawJitter: 0.16 },
  tower: {
    baseRadius: 0.027,
    topRadius: 0.018,
    spireHeight: 0.07,
    finial: 0.011,
    bannerProbability: 0.4,
    /**
     * Setback of border-reaching wall ends: a tower caps the wall this far from
     * the tile edge — close enough to read as fortified, but its body never
     * crosses the seam, so adjacent tiles' towers don't overlap. Also the radius
     * within which corner-hugging wall stubs are culled.
     */
    borderMargin: 0.05,
  },
  /** Gatehouse where a road meets a city wall. `reach` = max road-to-wall gap. */
  gate: { width: 0.11, postWidth: 0.03, depth: 0.05, height: 0.2, roofHeight: 0.05, reach: 0.17 },
  vegetation: {
    /** Share of trees that are conifers (vs round broadleaf). */
    coniferWeight: 0.35,
    rockProbability: 0.16,
    rock: '#9b9488',
    haystackProbability: 0.08,
    haystack: '#d8b85a',
  },
  /** Barrels/crates tucked into the ring between the city wall and the houses. */
  props: { barrel: '#8a6a44', crate: '#9a7b4f', ringProbability: 0.22 },
  /** Curated soft accents (doors, shutters, banners, flags). */
  accents: ['#6b8fb0', '#7faa6b', '#c0894f', '#b0584a', '#8a6fa0', '#d4ad4a'],
} as const;

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
