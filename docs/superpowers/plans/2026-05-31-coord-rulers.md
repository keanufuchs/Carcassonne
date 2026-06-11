# Coord Rulers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sticky X/Y coordinate rulers to the board viewport so the (x, y) coordinates shown in Move History correspond to visible axis labels on the board.

**Architecture:** A pure helper `rulerTicks.ts` computes which coordinate labels to render given a transform; a `CoordRulers` React component renders two SVG ruler strips absolutely positioned inside `.board-scroll`; `BoardView` mounts it and passes the existing `transform` state. The rulers overlay the board canvas with `pointer-events: none` so they never block tile interaction.

**Tech Stack:** React, TypeScript, SVG DOM manipulation, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/ui/board/rulerTicks.ts` | Create | Pure function: given transform + viewport size → tick array |
| `src/ui/board/rulerTicks.test.ts` | Create | Unit tests for tick math |
| `src/ui/board/CoordRulers.tsx` | Create | React component rendering X and Y SVG rulers |
| `src/ui/board/BoardView.tsx` | Modify | Mount `<CoordRulers>` inside `.board-scroll` |

`.board-scroll` already has `position: relative` in `board.css` — no CSS change needed.

---

## Task 1: Tick math helper

**Files:**
- Create: `src/ui/board/rulerTicks.ts`
- Create: `src/ui/board/rulerTicks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/board/rulerTicks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getVisibleTicks } from './rulerTicks';

const TILE = 80;
const OFFSET = 40;

describe('getVisibleTicks', () => {
  it('places origin at the correct screen position', () => {
    // Game coord 0 → canvas pixel = (0 + 40) * 80 = 3200
    // We want it at screen position 100: offsetX = 100 - 3200 = -3100
    const ticks = getVisibleTicks(-3100, 1, 400, TILE, OFFSET);
    const origin = ticks.find(t => t.gameCoord === 0);
    expect(origin).toBeDefined();
    expect(origin!.screenPos).toBe(100);
  });

  it('includes negative coordinates when panned', () => {
    // Put game coord -2 at screen 40: offsetX = 40 - ((-2+40)*80) = 40 - 3040 = -3000
    const ticks = getVisibleTicks(-3000, 1, 400, TILE, OFFSET);
    expect(ticks.some(t => t.gameCoord === -2)).toBe(true);
  });

  it('skips every other coord when zoomed out (tileScreen < 28px)', () => {
    // scale 0.3 → tileScreen = 24 → skipFactor = ceil(28/24) = 2
    const ticks = getVisibleTicks(0, 0.3, 300, TILE, OFFSET);
    for (const t of ticks) {
      expect(t.gameCoord % 2).toBe(0);
    }
  });

  it('shows every coord when zoomed in (tileScreen >= 28px)', () => {
    // scale 1 → tileScreen = 80 → skipFactor = 1
    // Put coord 0 at screen 40, viewport 400 → visible coords 0..4
    const ticks = getVisibleTicks(-3200 + 40, 1, 400, TILE, OFFSET);
    const coords = ticks.map(t => t.gameCoord).sort((a, b) => a - b);
    for (let i = 1; i < coords.length; i++) {
      expect(coords[i] - coords[i - 1]).toBe(1);
    }
  });

  it('excludes ticks outside the viewport', () => {
    const ticks = getVisibleTicks(0, 1, 300, TILE, OFFSET);
    for (const t of ticks) {
      expect(t.screenPos).toBeGreaterThanOrEqual(-TILE);
      expect(t.screenPos).toBeLessThanOrEqual(300 + TILE);
    }
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/ui/board/rulerTicks.test.ts
```

Expected: all 5 tests FAIL with "Cannot find module './rulerTicks'".

- [ ] **Step 3: Implement `rulerTicks.ts`**

Create `src/ui/board/rulerTicks.ts`:

```typescript
export interface Tick {
  gameCoord: number;
  screenPos: number;
}

/**
 * Returns the coordinate ticks visible inside a ruler of `viewportSize` pixels,
 * given the board canvas transform (offset + scale) along one axis.
 *
 * offset   — translateX or translateY of the board canvas (pixels)
 * scale    — uniform scale of the board canvas
 * viewportSize — width (X ruler) or height (Y ruler) of the ruler in pixels
 */
export function getVisibleTicks(
  offset: number,
  scale: number,
  viewportSize: number,
  tileSize: number,
  coordOffset: number,
): Tick[] {
  const tileScreenSize = tileSize * scale;
  const first = Math.floor(-offset / tileScreenSize) - coordOffset;
  const last  = Math.ceil((viewportSize - offset) / tileScreenSize) - coordOffset;
  const skipFactor = Math.max(1, Math.ceil(28 / tileScreenSize));

  const ticks: Tick[] = [];
  for (let g = first; g <= last; g++) {
    if (g % skipFactor !== 0) continue;
    ticks.push({
      gameCoord: g,
      screenPos: (g + coordOffset) * tileScreenSize + offset,
    });
  }
  return ticks;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/ui/board/rulerTicks.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/rulerTicks.ts src/ui/board/rulerTicks.test.ts
git commit -m "feat(board): add rulerTicks helper with unit tests"
```

---

## Task 2: CoordRulers component

**Files:**
- Create: `src/ui/board/CoordRulers.tsx`

The vitest environment is `node` with no jsdom, so the component is verified visually in Task 3. No component-level unit tests here — the pure function in `rulerTicks.ts` is the testable unit.

- [ ] **Step 1: Implement `CoordRulers.tsx`**

Create `src/ui/board/CoordRulers.tsx`:

```typescript
import { useLayoutEffect, useRef } from 'react';
import type { BoardTransform } from '../hooks/useBoardTransform';
import { getVisibleTicks } from './rulerTicks';

const TILE_SIZE = 80;
const COORD_OFFSET = 40;
const RULER_SIZE = 20;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Props {
  transform: BoardTransform;
}

export function CoordRulers({ transform }: Props) {
  const xRef = useRef<SVGSVGElement>(null);
  const yRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    drawXRuler(xRef.current, transform);
    drawYRuler(yRef.current, transform);
  });

  return (
    <>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: RULER_SIZE, height: RULER_SIZE,
        background: '#1a1a2e',
        borderRight: '1px solid #2a2a4a',
        borderBottom: '1px solid #2a2a4a',
        zIndex: 20,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: RULER_SIZE, right: 0, height: RULER_SIZE,
        background: '#1a1a2e',
        borderBottom: '1px solid #2a2a4a',
        zIndex: 19,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <svg ref={xRef} width="100%" height={RULER_SIZE} style={{ display: 'block' }} />
      </div>
      <div style={{
        position: 'absolute', top: RULER_SIZE, left: 0, width: RULER_SIZE, bottom: 0,
        background: '#1a1a2e',
        borderRight: '1px solid #2a2a4a',
        zIndex: 19,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <svg ref={yRef} width={RULER_SIZE} height="100%" style={{ display: 'block' }} />
      </div>
    </>
  );
}

function drawXRuler(svg: SVGSVGElement | null, transform: BoardTransform): void {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const { offsetX, scale } = transform;
  const viewportW = svg.clientWidth;
  if (viewportW === 0) return;

  for (const { gameCoord: gx, screenPos: px } of getVisibleTicks(offsetX, scale, viewportW, TILE_SIZE, COORD_OFFSET)) {
    const isOrigin = gx === 0;
    svg.appendChild(makeLine(px, isOrigin ? 0 : 12, px, RULER_SIZE, isOrigin ? '#ffd700' : '#374151', isOrigin ? 1.5 : 1));
    svg.appendChild(makeXLabel(px + 2, 11, String(gx), isOrigin));
  }
}

function drawYRuler(svg: SVGSVGElement | null, transform: BoardTransform): void {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const { offsetY, scale } = transform;
  const viewportH = svg.clientHeight;
  if (viewportH === 0) return;

  for (const { gameCoord: gy, screenPos: py } of getVisibleTicks(offsetY, scale, viewportH, TILE_SIZE, COORD_OFFSET)) {
    const isOrigin = gy === 0;
    svg.appendChild(makeLine(isOrigin ? 0 : 12, py, RULER_SIZE, py, isOrigin ? '#ffd700' : '#374151', isOrigin ? 1.5 : 1));
    svg.appendChild(makeYLabel(10, py, String(gy), isOrigin));
  }
}

function makeLine(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number): SVGLineElement {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('x1', String(Math.round(x1)));
  el.setAttribute('y1', String(Math.round(y1)));
  el.setAttribute('x2', String(Math.round(x2)));
  el.setAttribute('y2', String(Math.round(y2)));
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', String(width));
  return el;
}

function makeXLabel(x: number, y: number, text: string, isOrigin: boolean): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', String(Math.round(x)));
  el.setAttribute('y', String(y));
  el.setAttribute('fill', isOrigin ? '#ffd700' : '#6b7280');
  el.setAttribute('font-size', '9');
  el.setAttribute('font-family', 'monospace');
  el.setAttribute('font-weight', isOrigin ? 'bold' : 'normal');
  el.textContent = text;
  return el;
}

function makeYLabel(cx: number, py: number, text: string, isOrigin: boolean): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', String(cx));
  el.setAttribute('y', String(Math.round(py)));
  el.setAttribute('fill', isOrigin ? '#ffd700' : '#6b7280');
  el.setAttribute('font-size', '9');
  el.setAttribute('font-family', 'monospace');
  el.setAttribute('font-weight', isOrigin ? 'bold' : 'normal');
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('dominant-baseline', 'central');
  el.setAttribute('transform', `rotate(-90, ${cx}, ${Math.round(py)})`);
  el.textContent = text;
  return el;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/board/CoordRulers.tsx
git commit -m "feat(board): add CoordRulers component"
```

---

## Task 3: Mount CoordRulers in BoardView

**Files:**
- Modify: `src/ui/board/BoardView.tsx`

- [ ] **Step 1: Add the import**

In `src/ui/board/BoardView.tsx`, add this import after the existing local imports (around line 10):

```typescript
import { CoordRulers } from './CoordRulers';
```

- [ ] **Step 2: Mount the component**

In `BoardView.tsx`, the `return` block opens with:

```tsx
  if (placedTiles.length === 0) return <div className="board-scroll" ref={containerRef} />;

  return (
    <div
      className="board-scroll"
      ref={containerRef}
      ...
    >
      <div className="board-stage" ...>
```

Add `<CoordRulers transform={transform} />` immediately inside `.board-scroll`, before `.board-stage`:

```tsx
  return (
    <div
      className="board-scroll"
      ref={containerRef}
      data-meeple-focus={showMeepleFocus ? 'true' : undefined}
      data-meeple-focus-phase={meepleFocusPhase}
      style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      <CoordRulers transform={transform} />
      <div
        className="board-stage"
        style={{
          transform: `translateY(${boardBounceOffset})`,
          transition: 'transform 240ms cubic-bezier(0.2, 0.85, 0.2, 1)',
          willChange: 'transform',
        }}
      >
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all existing tests still pass (no regressions).

- [ ] **Step 4: Start the dev server and verify visually**

```bash
npm run dev
```

Open the app, start a game. Check:
- Thin ruler strips appear along the top and left of the board
- X ruler shows numbers that update as you pan left/right
- Y ruler shows numbers that update as you pan up/down
- Origin (0) labels are gold; others are grey
- Rulers scale when zooming (label density adapts)
- Rulers don't block tile placement or meeple interaction

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/BoardView.tsx
git commit -m "feat(board): mount CoordRulers in BoardView"
```
