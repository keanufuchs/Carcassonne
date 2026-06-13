# 3D Board Interaction: Feature Highlight, Per-Tile Banners, Billboarding & Illegal Slots

**Date:** 2026-06-13
**Branch:** feature/3d-migration
**Status:** Approved

## Problem

The migrated 3D board (`Board3DView` and friends) has four interaction gaps versus the
intended UX:

1. **Highlight is single-tile.** Hovering a segment lights up only the hovered tile's
   own region, not the whole connected feature (city/road/field) spanning multiple tiles.
2. **One banner per feature.** A claimed feature shows its ownership banner only on the
   single tile that physically holds the meeple. Every tile that is part of the feature
   should carry the owner's banner/lantern/shield.
3. **Markers do not face the camera.** Player banners keep a fixed world orientation, so
   from the locked isometric view some are seen edge-on.
4. **Only legal slots are shown.** During a player's turn only valid placements appear.
   Instead, every reachable slot should appear, turning **red** where the current rotation
   is illegal.

## Decisions (from brainstorming)

- **Reachable slots:** show a ghost only at cells that are legal at *some* rotation. A cell
  legal at the current rotation renders normally; one that needs a different rotation
  renders red. Cells unplaceable at every rotation show nothing.
- **Highlight scope:** during `PLACING_MEEPLE`, hovering a meeple target glows the whole
  feature in **gold**. Outside meeple placement, hovering any feature glows the whole
  feature in the **owning player's color** (neutral gold if unclaimed). No text label.
- **Billboarding:** only player-colored markers (gonfalon, shield, claimed-road pennant)
  face the camera. Neutral road lanterns keep their fixed orientation.

## Architecture

Logic lives in framework-free helpers (`src/ui/board/board3d.ts`); the R3F components
stay thin. `Feature.segments` is a `Set<"${tileId}#${localId}">`, so any feature maps back
to all its tiles/segments across the board — the backbone of cross-tile highlight and
per-tile banners.

### A. Cross-tile feature highlight + owner glow

- `Board3DView` owns `hover: { featureId: FeatureId; color: string } | null`.
- A `RegionInteractionLayer` mounts on **every** placed tile (today only the last during
  meeple placement). Pointer-over resolves the region's `localId` to a feature via
  `registry.segmentToFeature.get(segmentKey({ tileId, localId }))`, and reports
  `{ featureId, color }` up:
  - `PLACING_MEEPLE` → `SEGMENT_HIGHLIGHT.glowColor` (gold).
  - otherwise → owning player's color if claimed, else gold.
- Each `PlacedTile3D`, given `hover`, computes its own localIds in `hover.featureId`
  (`featureLocalIdsOnTile`) and highlights them in `hover.color`.
- `RegionInteractionLayer` becomes **controlled**: `highlightLocalIds: Set<number>`,
  `highlightColor: string`, optional `clickableLocalIds: Set<number>`. Clicks fire
  `placeMeeple` only for the last tile's valid targets during `PLACING_MEEPLE`; hover-only
  elsewhere. `setTileRegionHighlight`, the shell material, and `setMeshHighlight` gain a
  `color` parameter (currently hard-coded gold).

### B. One banner per tile of a feature

- New `tileClaims(placed, registry, players): ClaimMap`. For each segment instance on the
  tile, look up its feature; if `feature.meeples.length > 0`, emit a claim in the
  **controlling** player's color. Replaces the meeple-location-based `tileMeeples` →
  `toClaimMap` path inside `PlacedTile3D`.
- `controllingPlayerIndex(feature, players)`: player with the most meeples on the feature;
  tie → lowest player index (deterministic, documented).
- Result: an N-tile claimed city shows N gonfalons; a claimed road shows a colored lantern
  on each of its tiles; unclaimed roads keep the neutral lantern. The marker-rebuild
  signature is derived from the resolved claims, so banners rebuild only when ownership
  changes.

### C. Billboard player markers only

- `buildClaimMarkers` tags player markers (gonfalon, shield, claimed-road pennant) with
  `userData.billboard = true`; neutral lanterns stay untagged.
- `PlacedTile3D` runs a `useFrame` pass: for each flagged descendant set
  `rotation.y = atan2(camX − worldX, camZ − worldZ) − tileYaw` so its +Z face (where the
  cloth/emblem live) turns toward the camera. `tileYaw` is the tile group's constant Y
  rotation. Cheap; robust to panning.

### D. Reachable slots, red where current rotation illegal

- `Board3DView` builds slots from `candidatePlacements(board)`. `classifySlot(coord)`:
  - `legalNow = previewPlacement(coord, pendingRotation).legal`
  - `legalAny = [0,90,180,270].some(r => previewPlacement(coord, r).legal)`
  - keep iff `legalAny`; mark `illegal = !legalNow`.
- `GhostTile3D` gains `illegal?: boolean`. When set: red tint (`setGroupTint`), no
  hover-lift, click no-op, cursor `not-allowed`. Rotating the pending tile re-colors slots
  live (already reactive on `state.pendingRotation`).

## Testing

Pure helpers carry the logic and get unit tests in `src/ui/board/board3d.test.ts`:

- `controllingPlayerIndex` — majority and tie (lowest index) cases.
- `tileClaims` — emits a claim per segment whose feature is claimed; none for unclaimed.
- `featureLocalIdsOnTile` — returns only this tile's localIds in a feature.
- `classifySlot` — legalNow / legalAny / dropped combinations (stub `previewPlacement`).

R3F components stay thin. Existing `data-testid="meeple-target"` selectors and meeple-target
E2E behavior are preserved.

## Touched files

- `src/ui/board/Board3DView.tsx` — hover state, all-tile interaction, slot classification.
- `src/ui/board/PlacedTile3D.tsx` — controlled highlight, `tileClaims`, billboard frame.
- `src/ui/board/GhostTile3D.tsx` — `illegal` rendering.
- `src/ui/board/board3d.ts` — `tileClaims`, `controllingPlayerIndex`,
  `featureLocalIdsOnTile`, `classifySlot`, `setGroupTint`.
- `src/three/RegionInteractionLayer.tsx` — controlled props.
- `src/three/regionHighlight.ts` — color-parameterized highlight.
- `src/three/claimMarkers.ts` — billboard tags.
- `src/ui/board/board3d.test.ts` — new unit tests.

## Out of scope

- Text/tooltip ownership labels (explicitly declined).
- Showing slots that no rotation can fill.
- Re-introducing standalone meeple figures (ownership remains banner-based).
