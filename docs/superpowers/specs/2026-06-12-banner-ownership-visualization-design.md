# Banner-based Ownership Visualization — Design

Date: 2026-06-12
Branch: `feature/tile-lab-region-highlighting`
Status: Approved (verbal), implementation in progress

## Goal

Replace visible meeple models with **world-integrated ownership markers** in the
3D tile system. Validate the claiming UX and banner-based visualization in the
Tile Lab before integrating into gameplay. **Scope: 3D / lab only** — the 2D
`BoardView` / `MeepleIcon` flow is untouched.

## Marker vocabulary

A claimed feature shows a marker in the owning **player's colour** with a
**white meeple silhouette** emblem.

| Feature | Marker | Anchor | Colour |
|---|---|---|---|
| City | Gonfalon, **large** (tall freestanding pole, cloth + swallowtail hem + meeple) | city parts' centroid; pole rises above houses (~0.5) | cloth = player colour |
| Field | Gonfalon, **small** (same geometry, scaled ~0.6) | field visual-center (max-inscribed point, always inside) | cloth = player colour |
| Monastery | Heraldic shield + meeple, at main-hall roof apex | `marker.pos`, height `bodyH + roofH` | shield face = player colour |
| Road | No marker — road ribbon **tinted** toward player colour (curb neutral) | n/a | road blends ~65% to player colour |

## Architecture

### `src/three/generators/banner.ts` (new)
Pure Three.js, follows `city.ts`/`monastery.ts` conventions.
- `meepleEmblem(color)` — small extruded white meeple silhouette, shared.
- `playerGonfalon(pos, baseTop, color, scale)` — pole + crossbar + swallowtail cloth + emblem.
- `playerShield(pos, baseTop, color)` — shield crest + emblem (generalizes `cityBanner`).
- Anchor helpers: `cityAnchor`, `fieldAnchor` (samples polygon for max-edge-distance point), `monasteryAnchor`.

### `palette.ts`
New `BANNER` config block (pole/cloth dims, large/small scales, road tint factor,
meeple white). No magic numbers in the generator (central-config rule).

### `src/three/claims.ts` (new) — framework-free
```ts
export interface FeatureClaim { localId: number; kind: SegmentKind; playerIndex: number; }
export type ClaimMap = ReadonlyMap<number, FeatureClaim>;
export function nextClaims(claims, ref, activePlayer): ClaimMap; // toggle reducer
```
Toggle semantics: unclaimed → claim for active player; claimed by active → remove;
claimed by other → reassign to active player.

### Rendering — overlay, not regeneration
Procedural tile is **not** rebuilt on claim change.
- `buildClaimMarkers(regions, claims)` → small `THREE.Group` of gonfalons/shields.
- `applyRoadClaimTints(tileGroup, regions, claims)` → tints/restores road materials,
  reusing the save/restore pattern from `regionHighlight.setMeshHighlight`. Requires
  tagging road meshes by `localId` in `generateTile` (same `tagSegmentMeshes` the
  monastery uses).

### Tile Lab — `ClaimTestPanel` (new), interaction model A (click-on-tile)
- Own panel added to `TileLabApp` grid; reference/topology panels untouched.
- Player swatch row (5 `PLAYER_COLORS`) selects the active player.
- Claims list with per-row remove + Clear all.
- `RegionInteractionLayer` gains optional `onClickLocalId(localId, kind)`.
- Scene renders the claim-markers group + runs `applyRoadClaimTints` in an effect
  keyed on the claim map.

## Tests (vitest, pure functions only)
- `cityAnchor` / `fieldAnchor` return points inside their polygons.
- `buildClaimMarkers` emits correct marker type/count per claim kind.
- `nextClaims` covers claim / remove / reassign.
No Three.js rendering assertions.
