# Coordination Grid — Viewport Rulers

**Date:** 2026-05-31  
**Status:** Approved

## Goal

Add sticky coordinate rulers along the top (X) and left (Y) edges of the board viewport so that the coordinates shown in the Move History sidebar (`(x, y)`) correspond to visible labels on the board.

## Context

The `TurnTimeline` component displays each move as `(x, y)` game coordinates. The board uses a coordinate system centred on the starting tile at `(0, 0)`. Without visible axis labels on the board, those numbers are meaningless to a player at a glance.

## Design

### Visual appearance

- Two 20 px ruler strips: one horizontal across the top of `.board-scroll` (X axis), one vertical down the left (Y axis).
- A 20×20 px corner square fills the top-left intersection.
- Background `#1a1a2e`, border `1px solid #2a2a4a` — matches the sidebar palette.
- Labels rendered as SVG `<text>` elements inside each ruler.
- Origin coordinate (0) drawn in `#ffd700` (gold) with a full-height/full-width tick; all other ticks grey (`#6b7280`), shorter.
- Label density adapts to zoom: `skipFactor = Math.max(1, Math.ceil(28 / (TILE_SIZE * scale)))` — labels appear every `skipFactor` tiles so they never crowd.

### Layout

```
┌──────────────────────────────────────┐
│ ◼  │        X ruler (top)            │  ← 20 px high
├────┼─────────────────────────────────┤
│    │                                 │
│ Y  │      board canvas               │
│    │      (tiles, pan/zoom)          │
│ r  │                                 │
│ u  │                                 │
│ l  │                                 │
│ e  │                                 │
│ r  │                                 │
└────┴─────────────────────────────────┘
```

The rulers are `position: absolute` overlays inside `.board-scroll`; the board canvas is unchanged (no padding shift). Rulers have `pointer-events: none` so they never block tile interaction.

### Coordinate math

The board canvas transform is `translate(offsetX, offsetY) scale(scale)` with origin `0 0`.

A game coordinate `g` maps to a screen position (relative to `.board-scroll` inner area) of:

```
screen = (g + COORD_OFFSET) * TILE_SIZE * scale + offset
```

Inverting: the first visible game coord along an axis is:

```
first = Math.floor(-offset / (TILE_SIZE * scale)) - COORD_OFFSET
last  = Math.ceil((viewportSize - offset) / (TILE_SIZE * scale)) - COORD_OFFSET
```

### Component structure

```
BoardView
  └── CoordRulers            ← new component (src/ui/board/CoordRulers.tsx)
        props: transform { offsetX, offsetY, scale }
        renders:
          <RulerX>  — horizontal SVG ruler
          <RulerY>  — vertical SVG ruler
          <Corner>  — 20×20 fill square
```

`CoordRulers` is positioned absolutely inside `.board-scroll` with `z-index` above the canvas but below all interactive overlays (meeple targets etc.).

`useBoardTransform` already returns `transform`; it is passed straight through to `CoordRulers`.

### Files changed

| File | Change |
|------|--------|
| `src/ui/board/CoordRulers.tsx` | New component |
| `src/ui/board/BoardView.tsx` | Mount `<CoordRulers transform={transform} />` |
| `src/ui/board/board.css` | Ensure `.board-scroll` has `position: relative` |

### Constants (shared with BoardView)

`TILE_SIZE = 80`, `COORD_OFFSET = 40` — referenced directly; no new exports needed.

## Out of scope

- Hover-to-highlight (history entry → board tile) — separate task if desired.
- Toggle button to show/hide rulers — always visible for now.
- Y axis label rotation — labels render horizontally rotated 90° for readability.
