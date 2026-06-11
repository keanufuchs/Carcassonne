# Design: Organic variance for roads and city walls (3D tiles)

**Date:** 2026-06-11
**Branch:** `feature/tile-lab-3d`
**Builds on:** TL-08 (`layoutRegions` — 3D regions derived from TS topology, commit `31ae82e`)

## Goal

Roads and city walls in the topology-derived 3D tiles currently follow mathematically
straight lines and perfect arcs. They should look hand-made instead: roads sway
gently off the ideal line, city boundaries bow and waver, and the wall meshes gain
structure (towers, crenellation) — without breaking cross-tile connectivity or any
layout invariant.

Decisions confirmed with the user:

1. **Wall scope:** curved outlines *and* 3D wall detail (towers + merlons).
2. **Road feel:** subtle, hand-drawn curvature — not pronounced winding.
3. **Seeding:** per prototype (all copies of a tile type look identical), like the
   existing house/tree scatter.

## Central configuration

The variance is not hard-wired. A single exported config object lives in
`src/three/palette.ts` (the existing central styling/constants module):

```ts
export const VARIANCE = {
  /** Max perpendicular road sway, as a fraction of the tile edge (0.15 → 15 SVG units). */
  roadVariance: 0.15,
  /** Max perpendicular city-boundary sway, as a fraction of the tile edge. */
  cityVariance: 0.10,
  /** Chaikin smoothing passes applied to displaced city boundary chains. */
  smoothingIterations: 1,
};
```

- `layoutRegions.ts` reads all amplitudes/passes from this object — no magic numbers
  in the algorithm. Setting both variances to `0` reproduces today's exact shapes.
- The unit tests derive their tolerance bounds from the same config, so tuning the
  values never breaks the suite.

## Part 1 — Curved outlines in `src/three/layoutRegions.ts`

Applies to the TS-topology path only; the SVG reference panel stays untouched.

### Core helper: windowed-noise displacement

Subdivide a path into ~8–16 segments and displace each point perpendicular to the
local path direction by

```
offset(t) = A · sin²(πt) · n(t),   n(t) = normalized Σᵢ sin(2πi·t + φᵢ)  (2 modes, |n| ≤ 1)
```

- `A = VARIANCE.roadVariance · 100` for roads, `VARIANCE.cityVariance · 100` for city
  chains (see Central configuration); phases/mode weights seeded per
  `proto.id : kind : localId` via the existing `makeRng` (`src/three/generators/util.ts`).
- The `sin²(πt)` window is zero **and has zero derivative** at both endpoints:
  endpoints stay mathematically exact and the path leaves them in its original
  direction. Roads therefore still hit their edge-slot midpoints precisely and meet
  the tile border perpendicular — neighbouring tiles keep connecting seamlessly.

### Application

| Element | Treatment |
|---|---|
| Straight road (2 opposite slots) | Subdivide, displace → gentle S-curve. |
| Arc road (2 adjacent slots) | Displace radially: radius 50 ± ~3, windowed the same way. |
| Dead-end road | Displace with window zero at both ends; the centre endpoint stays exactly (50,50) so W/X/L junctions remain closed. City-trimming (S/T) runs on the final curved polyline. |
| City cap (1 edge) | Interior chain corner→apex→corner: displace + one Chaikin smoothing pass (rounds the apex and noise kinks; endpoints preserved). |
| City corner triangle (2 adjacent edges) | Hypotenuse chain corner→corner: same treatment. |
| City band (2 opposite edges) | Both pinch chains: same treatment. |
| City 3-edge (two overlapping triangles) | Both hypotenuses: same treatment (see risk below). |
| City 4-edge (TILE-C) | All edges on the tile border → unchanged. |
| Tile-border edges generally | Never displaced; they stay exact for wall suppression (`onTileBoundary`) and neighbour continuity. |

**Free win:** `partitionFields` runs *after* cities and roads and blocks cells from the
final geometry, so fields automatically respect the curved shapes — road/field
clearance holds by construction.

## Part 2 — Wall structure in `src/three/generators/city.ts`

Generator-level, so it benefits both the SVG-derived and TS-derived panels.

- **Towers:** small cylinders with cone roofs at wall-run endpoints and every
  ~0.25 world units along runs. Rendered as instanced meshes (bodies + roofs),
  1–2 draw calls per city.
- **Merlons:** crenellation rhythm — small instanced blocks spaced ~0.04 along the
  top of each wall run, one InstancedMesh per city.
- Both use the `rng` already passed to `generateCity` (deterministic per prototype).

## Tests (`src/three/layoutRegions.test.ts`)

- All existing invariants stay and must keep passing: slot coverage, edge sweep,
  polygon validity, road-out-of-city, road/field separation, determinism.
- Loosen shape spot-checks: cap apex at depth 25 ± noise margin; TILE-V arc radius
  50 ± 4; vertex-count equality checks become structural checks.
- New: straight roads deviate from the ideal line by more than 0 but at most
  `roadVariance · 100` units (bounds derived from `VARIANCE`, so tuning the config
  never breaks the suite); a road's first segment leaves the tile border
  perpendicular (angle tolerance ~5°). Short paths (e.g. trimmed dead-end stubs)
  scale their amplitude down with path length.
- Wall towers/merlons are mesh-level (three.js) and verified visually in the lab,
  consistent with how walls/houses are verified today.

## Known risk

On 3-edge cities (Q/R/S/T) the two overlapping triangle hypotenuses are partially
internal seams. Curving them independently could create small spurious wall slivers
near their crossing point. The TL-07 seam-sampling (`exteriorIsCity`) should absorb
this; if the visual check disagrees, fallback: keep those hypotenuses straight.

## Out of scope

- Per-instance variation on a future 3D board (seed stays per prototype).
- Any change to `svgRegions.ts` or the SVG assets.
- Field/monastery visual changes.
