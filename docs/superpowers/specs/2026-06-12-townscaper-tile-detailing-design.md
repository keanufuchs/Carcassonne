# Townscaper-Inspired Tile Detailing — Design Spec

**Date:** 2026-06-12
**Branch:** `feature/tile-lab-3d`
**Status:** Approved (Tiers 1 & 2 + lighting polish)

## Goal

Raise the visual quality, richness, and charm of the procedurally generated 3D
tiles toward a **Townscaper-inspired** aesthetic — stylized, soft, handcrafted,
toy-like, cohesive — while preserving **all** gameplay semantics, tile
connectivity, border alignment, and deterministic generation.

This is a pure **art / procedural-content** exercise. The 3D generator is
currently consumed only by the tile lab (`tile-lab/`), not by gameplay
(`src/ui` does not import `generateTile`), so there is no gameplay-semantics
risk.

## Hard Boundaries (must not change)

| Concern | Owner | Rule |
|---|---|---|
| Topology, connectivity, border slots | `src/three/layoutRegions.ts`, `svgRegions.ts` | **Do not touch.** Unit-tested; guarantees connectivity + exact border alignment. |
| Layout variance (`VARIANCE`) | `palette.ts` | Feeds the tested layout layer — leave semantics intact. |
| Determinism | `makeRng(seed)` in `util.ts` | Every new placement must draw from the existing seeded PRNG. |
| City-wall border alignment | `city.ts` (`onTileBoundary`, seam exclusion) | Keep boundary + internal-seam edges wall-free. |
| Performance | `instanced()` | Keep repeated families as a single `InstancedMesh`. |
| Config convention | `palette.ts` | **All new tunables live in central config**, never hard-wired in generators. |

## Safe Work Surface

- `src/three/generators/{city,road,field,monastery}.ts` — mesh content (untested).
- `src/three/generators/util.ts` — reusable geometry/mesh helpers.
- `src/three/palette.ts` — extend `DETAIL`; add a `TOWN` config block + accent palette.
- `src/three/generateTile.ts` — dispatch only (e.g. pass a per-tile palette seed).
- `tile-lab/components/Tile3DPanel.tsx` — lighting/material polish (lab host only).

## New Central Config (`palette.ts`)

Add a `TOWN` block holding all new tunables:

- **Roof:** archetype weights (`gable` / `hip` / `clip`), eave overhang, ridge size.
- **Facade:** window size/inset, door size, window probability, color jitter range (HSL).
- **Chimney:** probability, size.
- **Tower:** base/top radius (taper), spire height, finial size, banner probability.
- **Props:** per-family density caps (well, barrels, crates, stalls, lanterns, flower boxes, haystacks, fences, rocks).
- **Vegetation:** conifer vs broadleaf weight, scale/height spread.
- **Accent palette:** curated soft colors (doors, shutters, banners). A per-tile
  palette seed picks 1–2 accents so each town is internally cohesive but varies
  between tiles.

## Tier 1 — Quick Wins

1. **Roof archetypes** — `gable` (triangular prism), `hip` (existing pyramid),
   `clip` (clipped pyramid). New `unitGableRoof()` helper. Selected per house
   deterministically by weighted pick.
2. **Eaves + ridge** — thin overhang slab under each roof; ridge cap on gables.
   Instanced families.
3. **Chimneys** — small instanced boxes on a fraction of houses, offset to a roof corner.
4. **Per-instance color jitter** — subtle HSL nudge on wall/roof/foliage instance colors.
5. **Tree variety** — add conifer (stacked cones) alongside round broadleaf;
   wider scale/height spread; two-tone foliage; scattered rocks.
6. **Handmade asymmetry** — small ±rotation/offset jitter on houses + thin foundation lip.

## Tier 2 — Medium Complexity

7. **Facade details** — instanced windows (dark recessed quads) + a door per house
   on its front face (front-face derived from the house rotation). Density-capped.
8. **Gatehouses** — where a road endpoint meets a city-wall stretch, replace that
   span with a gate (posts + lintel + small gable roof). Strictly interior;
   boundary edges already excluded by wall logic.
9. **Tower silhouette** — tapered bodies (wider base), taller spire roofs with a
   finial, more height/girth variation, optional banner on some towers.
10. **Decorative props** — sparse instanced well / barrels / crates / market stalls /
    lanterns / flower boxes near city centers; haystacks / fences in fields. Capped.
11. **Monastery polish** — rooftop cross, arched door, small garden/cloister wall.

## Lighting / Material Polish (`Tile3DPanel`, `standard()`)

- Slightly warmer key light; gentle exposure/contact-shadow tuning.
- Optional flat-shaded facets on foliage/roofs for the low-poly Townscaper look.

## Implementation Order

1. Tier 1 (items 1–6) — one reviewable increment.
2. Tier 2 (items 7–11).
3. Lighting/material polish.

Reusable geometry/config helpers over one-off meshes throughout.

## Verification

- `npm test` stays green after every increment (topology tests = regression guard
  for connectivity + border alignment + determinism).
- Visual review against `npm run dev:lab`.
- No commits (per task constraint).

## Out of Scope

- Tier 3 advanced massing (terraced shared-wall clustering, stepped multi-block
  houses, dormers, full per-town palette systemization).
- Any change to gameplay UI, topology, or tile-prototype data.
