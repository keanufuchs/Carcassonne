# 3D Board Migration Design

**Date:** 2026-06-12  
**Branch:** feature/3d-board-migration (to be created from develop)  
**Status:** Approved for implementation

## Goal

Replace the entire 2D SVG/CSS board (`BoardView` + `TileView`) with a full 3D R3F scene that matches the Tile Lab's visual style. The 2D board is completely removed — no feature flags, no compatibility layer.

## Decisions

| Question | Decision |
|---|---|
| Approach | Full 3D scene (single R3F Canvas) |
| Interaction | Per-component R3F event handlers (onPointerEnter / onClick) |
| Camera | Fixed isometric angle, MapControls for pan + zoom only |
| Meeple rendering | 3D capsule geometry, player color material |
| Meeple vs. banner | Meeple shape on tile; banner (gonfalon) for ownership while feature is incomplete |
| Migration | Full cut-over, old 2D files deleted |

## Component Tree

```
App.tsx
  └ Board3DView.tsx          ← NEW, replaces BoardView.tsx
       └ <Canvas> + MapControls (locked polar ~55°, no free orbit)
           ├ PlacedTile3D.tsx   ×N   ← NEW, replaces TileView.tsx
           │    ├ generateTile()       REUSED from src/three/generateTile.ts
           │    ├ claimMarkers()       REUSED from src/three/claimMarkers.ts
           │    └ segment hit meshes   NEW (meeple placement phase only)
           ├ GhostTile3D.tsx    ×M   ← NEW, replaces GhostTile.tsx
           │    └ semitransparent tile mesh, onPointerEnter highlight + onClick
           └ Meeple3D.tsx       per placed meeple   ← NEW (no 2D equivalent)
```

## Files Deleted

| File | Replaced by |
|---|---|
| `src/ui/board/BoardView.tsx` | `Board3DView.tsx` |
| `src/ui/board/TileView.tsx` | `PlacedTile3D.tsx` |
| `src/ui/board/GhostTile.tsx` | `GhostTile3D.tsx` |
| `src/ui/board/InlineTile.tsx` | — (3D geometry replaces SVG) |
| `src/ui/board/SegmentHitZone.tsx` | segment hit meshes in PlacedTile3D |
| `src/ui/board/segmentPosition.ts` | — |
| `src/ui/board/useTileSvgPaths.ts` | — |
| `src/ui/board/MeepleIcon.tsx` | — (not used outside BoardView) |
| `src/ui/board/CoordRulers.tsx` | — (dropped; 3D grid provides orientation) |
| `src/ui/board/rulerTicks.ts` | — |
| `src/ui/hooks/useBoardTransform.ts` | MapControls built-in pan/zoom |
| `src/ui/board/board.css` | — |

## Files Reused Unchanged

- `src/three/generateTile.ts`
- `src/three/claimMarkers.ts`
- `src/three/generators/*` (city, road, field, monastery, banner, util)
- `src/three/palette.ts`
- `src/three/svgRegions.ts`
- `src/three/regionHighlight.ts`
- `src/three/claims.ts`
- `tile-lab/components/TileLabCanvas.tsx` — scene scaffold reference (not imported directly; settings copied into Board3DView)

## Camera

```ts
// MapControls configuration
maxPolarAngle = Math.PI / 3      // ~60° — locked, no orbit
minPolarAngle = Math.PI / 3
minAzimuthAngle = -Math.PI / 4   // fixed isometric diagonal
maxAzimuthAngle = -Math.PI / 4
minDistance = 2
maxDistance = 30
enableRotate = false
```

Initial camera position: `[12, 14, 12]`, target `[0, 0, 0]` (centers on start tile).

## Interaction: Tile Placement Phase

1. `candidatePlacements(state)` produces valid `{x, y}` coords (unchanged).
2. Each valid coord → `<GhostTile3D position={[x, 0, -y]}>` (note: game y maps to Three.js -z).
3. `GhostTile3D` renders current tile prototype via `generateTile()` at 35% opacity.
4. `onPointerEnter` → highlight (increase opacity to 60%).
5. `onClick` → `controller.placeTile(coord, rotation)`.
6. Rotation state lives in `Board3DView`, driven by keyboard `R` or HUD button (same as today).

## Interaction: Meeple Placement Phase

1. `getMeepleTargets(state)` returns valid `SegmentRef[]` (unchanged).
2. `PlacedTile3D` for the newly placed tile adds invisible `BoxGeometry` hit meshes at each segment centroid (derived from `svgRegions` centroids, same data `segmentPosition.ts` used).
3. `onPointerEnter` → calls `regionHighlight` to tint the segment.
4. `onClick` → `controller.placeMeeple(ref)`.
5. Skip button remains in HUD (unchanged).

## Meeple3D

- Geometry: `CapsuleGeometry(0.06, 0.08, 4, 8)` — low-poly, readable at game scale.
- Material: `MeshStandardMaterial({ color: playerColor })`.
- Position: segment centroid (x, 0.12, z) — floats slightly above tile surface.
- Rendered by `PlacedTile3D` (not a separate top-level component).
- Co-exists with banners: meeple shape = "I am here", banner = "I own this feature". Banners are removed when feature scores; meeple shape is removed simultaneously.

## Coordinate Mapping

Game board uses `(x, y)` integers. Three.js scene uses `(x * TILE_SIZE, 0, -y * TILE_SIZE)` where `TILE_SIZE = 1.0` (matching lab). No `COORD_OFFSET` needed — Three.js handles negative coordinates natively.

## Integration Point

`App.tsx:263` — only change needed outside new files:

```tsx
// Before
import { BoardView } from './ui/board/BoardView';
<BoardView state={state} controller={controller} isAiTurn={...} highlightedCoord={...} highlightKey={...} />

// After
import { Board3DView } from './ui/board/Board3DView';
<Board3DView state={state} controller={controller} isAiTurn={...} />
```

`highlightedCoord` and `highlightKey` props may be dropped or reimplemented as 3D highlight rings.

## Tests

- All `BoardView`-related unit tests are deleted.
- `src/three/` tests (`svgRegions.test.ts`, `claims.test.ts`, `claimMarkers.test.ts`, `layoutRegions.test.ts`) remain and must stay green.
- New interaction tests: E2E Playwright tests cover tile placement + meeple placement flows (no unit tests for R3F components — too hard to unit-test reliably).

## Out of Scope

- `tile-lab/` — remains as dev sandbox, not shipped.
- HUD, scoring, lobby, network — untouched.
- Mobile / touch optimization beyond MapControls built-in.
