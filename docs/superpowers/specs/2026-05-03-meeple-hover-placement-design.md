# Meeple Hover Placement Design

**Date:** 2026-05-03  
**Branch:** feature/board-ux

## Goal

Replace floating meeple-target circles with SVG region hover-highlight + click-to-place interaction on the last placed tile during `PLACING_MEEPLE` phase.

## SVG File Conventions

All 24 SVG files use a unified ID scheme:

- **Background:** `<rect width="100" height="100" fill="#7fbf6a"/>` — no `id`, no `data-kind`, purely visual
- **Every interactive segment:** `id="segment-{KIND}-{localId}"` + `data-kind="{KIND}"`
  - `<polygon id="segment-CITY-0" data-kind="CITY" ...>`
  - `<rect id="segment-ROAD-1" data-kind="ROAD" ...>`
  - `<polygon id="segment-FIELD-2" data-kind="FIELD" fill="#7fbf6a" ...>`
  - `<polygon id="segment-FIELD-3" data-kind="FIELD" fill="#7fbf6a" ...>`
  - `<circle id="segment-MONASTERY-0" data-kind="MONASTERY" ...>`

localId in SVG ID matches `SegmentBlueprint.localId` exactly. Extraction: `parseInt(id.split('-')[2])`.

Tiles with multiple FIELD segments get one polygon per segment covering its geographic area. Tiles with a single FIELD segment get an explicit polygon (full tile minus road/city areas).

## New Components

### `useSvgCache(url: string): string | null`
- Module-level `Map<string, Promise<string>>` cache
- Fetches SVG text once per URL, returns cached result on subsequent calls
- Returns `null` while loading

### `InteractiveTileView`
Props: `placed`, `meepleTargets: SegmentRef[]`, `onPlace: (ref) => void`, `players`, `registry`, `size`

- Fetches SVG via `useSvgCache`
- Renders via `dangerouslySetInnerHTML` in a sized container div
- `useEffect` on `[svgText, meepleTargets]`: queries `[data-kind]` elements, for each:
  - Parses `localId = parseInt(element.id.split('-')[2])`
  - If `meepleTargets.some(t => t.localId === localId)`: adds hover/click handlers
  - `mouseenter`: `element.style.filter = 'brightness(1.35) saturate(1.4)'`, `cursor: pointer`
  - `mouseleave`: clears filter
  - `click`: calls `onPlace(meepleTargets.find(t => t.localId === localId)!)`
- Container div: `transform: rotate(${rotation}deg)` so hit areas rotate correctly
- Also renders placed meeple overlays (same logic as `TileView`)

## BoardView Changes

- During `PLACING_MEEPLE`, render `InteractiveTileView` for tiles that have `meepleTargets.length > 0`
- All other tiles: continue using `TileView`
- Remove existing circle-based meeple target rendering

## File Changes

| File | Change |
|------|--------|
| `public/tiles/tile-*.svg` (all 24) | Standardize IDs, add per-segment FIELD polygons |
| `src/ui/board/useSvgCache.ts` | New hook |
| `src/ui/board/InteractiveTileView.tsx` | New component |
| `src/ui/board/BoardView.tsx` | Use InteractiveTileView, remove circles |
