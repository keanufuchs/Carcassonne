# Carcassonne MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully playable browser-based Carcassonne (base game) with real tile placement, feature merging, meeple placement, mid-game and end-game scoring for 2–5 players.

**Architecture:** Strict 4-layer stack (Core → Controller → UI); no Electron for MVP. Core is pure TypeScript with zero framework dependencies. Controller wraps core, exposes synchronous commands + pub/sub. React UI reads state snapshots via `useGameState` and dispatches commands via `useController`.

**Tech Stack:** TypeScript (strict), React 19, Vite 8, plain CSS (2.5D), Vitest (unit tests)

---

## File Map

### To create
```
src/core/types.ts                        ← all shared primitives (re-exports tile.ts types)
src/core/tile/Tile.ts                    ← PlacedTile, SegmentInstance, makePlacedTile
src/core/tile/rotation.ts               ← flipPos, rotateSide, rotateSlot, rotatedEdges
src/core/board/Board.ts                 ← Board data type + createEmptyBoard (replaces stub)
src/core/board/placement.ts             ← canPlace, hasAnyLegalPlacement, placeTileInternal
src/core/feature/Feature.ts             ← Feature, MeeplePlacement interfaces
src/core/feature/segments.ts            ← FeatureRegistry + CRUD helpers
src/core/feature/merge.ts               ← unify
src/core/feature/completion.ts          ← detectCompletions
src/core/scoring/majority.ts            ← majorityWinners
src/core/scoring/midGame.ts             ← scoreCompletedMidGame
src/core/scoring/endGame.ts             ← scoreIncompleteEndGame, applyEndGameScoring
src/core/scoring/farmers.ts             ← scoreFarmers, computeAdjacentCompletedCities
src/core/game/Game.ts                   ← startGame, drawTile, rotatePending, placeTile, placeMeeple, skipMeeple
src/core/game/turnFsm.ts               ← resolveScoring, advanceTurn (internal helpers)
src/controller/pubsub.ts               ← PubSub<T>
src/controller/GameController.ts       ← createGameController
src/ui/hooks/useController.ts          ← ControllerContext + useController
src/ui/hooks/useGameState.ts           ← useGameState
src/ui/board/TileView.tsx              ← single tile + meeple dots
src/ui/board/GhostTile.tsx             ← hover placement preview
src/ui/board/BoardView.tsx             ← full board grid + ghost
src/ui/board/board.css
src/ui/hud/PlayerPanel.tsx             ← scores + meeple supply
src/ui/hud/TilePreview.tsx             ← drawn tile + rotate buttons
src/ui/hud/Controls.tsx               ← skip-meeple, draw, labels
src/ui/hud/EndGameScreen.tsx          ← final scores overlay
src/ui/styles/game.css                ← global layout
src/App.tsx                           ← wiring (replaces default Vite template)
```

### To modify
```
src/core/deck/Deck.ts                  ← update drawPlaceable signature (takes check fn, not Board method)
package.json                           ← add vitest + @vitest/ui
vite.config.ts                        ← add test config
```

### Unchanged
```
src/core/types/tile.ts                 ← all 24 tile prototypes import from here; do NOT touch
src/core/deck/tiles/tile-*.ts          ← 24 prototype files; do NOT touch
src/core/deck/baseGameTiles.ts        ← distribution; do NOT touch
```

---

## Task 1: Add Vitest + update Deck.ts signature

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/core/deck/Deck.ts`

- [ ] **Step 1.1: Install Vitest**

```bash
npm install --save-dev vitest @vitest/ui
```

Expected: `package.json` devDependencies now includes `"vitest"`.

- [ ] **Step 1.2: Add test block to vite.config.ts**

Read `vite.config.ts` first, then add:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 1.3: Update Deck.ts — change drawPlaceable to take a check function**

Replace `src/core/deck/Deck.ts` entirely:

```ts
import type { TilePrototype } from '../types/tile';

export interface Deck {
  startTile: TilePrototype;
  remaining: TilePrototype[];
}

export function shuffle(deck: Deck, rng: () => number): void {
  const arr = deck.remaining;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function hasRemaining(deck: Deck): boolean {
  return deck.remaining.length > 0;
}

export function drawNext(deck: Deck): TilePrototype | null {
  return deck.remaining.shift() ?? null;
}

export function drawPlaceable(
  deck: Deck,
  isPlaceable: (t: TilePrototype) => boolean,
): TilePrototype | null {
  while (hasRemaining(deck)) {
    const tile = drawNext(deck)!;
    if (isPlaceable(tile)) return tile;
  }
  return null;
}
```

- [ ] **Step 1.4: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/core/deck/Deck.ts
git commit -m "chore: add vitest; update drawPlaceable to accept check fn"
```

---

## Task 2: Core shared types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 2.1: Write `src/core/types.ts`**

```ts
// Re-export tile-system primitives so consumers import from one place.
export type {
  Terrain, EdgeSide, SlotPos, Rotation,
  SegmentKind, SegmentLocalId, EdgeSlot,
  SegmentBlueprint, TilePrototype,
} from './types/tile';

// ── Coordinates ────────────────────────────────────────────────────────────
export type Coord = { x: number; y: number };
export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const parseCoordKey = (k: string): Coord => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};

// ── Identity ────────────────────────────────────────────────────────────────
export type PlayerId  = string;
export type FeatureId = string;
export type TileId    = string;

export type SegmentRef = { tileId: TileId; localId: SegmentLocalId };
export const segmentKey   = (s: SegmentRef): string => `${s.tileId}#${s.localId}`;
export const parseSegmentKey = (k: string): SegmentRef => {
  const hash = k.lastIndexOf('#');
  return { tileId: k.slice(0, hash), localId: Number(k.slice(hash + 1)) };
};

// ── Result / Errors ─────────────────────────────────────────────────────────
export type ErrorCode =
  | 'CELL_OCCUPIED'
  | 'EDGE_MISMATCH'
  | 'NOT_ADJACENT'
  | 'WRONG_PHASE'
  | 'NO_PENDING_TILE'
  | 'MEEPLE_FEATURE_OCCUPIED'
  | 'MEEPLE_NOT_ON_PLACED_TILE'
  | 'MEEPLE_FEATURE_COMPLETED'
  | 'NO_MEEPLES_AVAILABLE'
  | 'GAME_OVER';

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: ErrorCode; message: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const okVoid = (): Result<void> => ({ ok: true, value: undefined });
export const err = (error: ErrorCode, message: string): Result<never> =>
  ({ ok: false, error, message });

// ── Player ──────────────────────────────────────────────────────────────────
export const MEEPLES_PER_PLAYER = 7;
export const PLAYER_COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#457b9d', '#6a0572'] as const;

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  score: number;
  meeplesAvailable: number;
}

// ── Game phase ───────────────────────────────────────────────────────────────
export type GamePhase =
  | 'NOT_STARTED'
  | 'PLACING_TILE'
  | 'PLACING_MEEPLE'
  | 'GAME_OVER';
```

- [ ] **Step 2.2: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add shared primitive types"
```

---

## Task 3: Tile rotation helpers

**Files:**
- Create: `src/core/tile/rotation.ts`

- [ ] **Step 3.1: Write `src/core/tile/rotation.ts`**

```ts
import type { EdgeSide, SlotPos, Rotation, EdgeSlot, TilePrototype } from '../types/tile';

const SIDES: EdgeSide[] = ['N', 'E', 'S', 'W'];

export function flipPos(p: SlotPos): SlotPos {
  return p === 'L' ? 'R' : p === 'R' ? 'L' : 'C';
}

export function opposite(side: EdgeSide): EdgeSide {
  return SIDES[(SIDES.indexOf(side) + 2) % 4];
}

export function stepCoord(coord: { x: number; y: number }, side: EdgeSide): { x: number; y: number } {
  switch (side) {
    case 'N': return { x: coord.x,     y: coord.y - 1 };
    case 'S': return { x: coord.x,     y: coord.y + 1 };
    case 'E': return { x: coord.x + 1, y: coord.y };
    case 'W': return { x: coord.x - 1, y: coord.y };
  }
}

export function rotateSide(side: EdgeSide, r: Rotation): EdgeSide {
  return SIDES[(SIDES.indexOf(side) + r / 90) % 4];
}

// Slot pos is preserved under rotation (outward-relative convention).
export function rotateSlot(slot: EdgeSlot, r: Rotation): EdgeSlot {
  return { side: rotateSide(slot.side, r), pos: slot.pos };
}

export function rotatedEdge(
  proto: TilePrototype,
  side: EdgeSide,
  r: Rotation,
): [import('../types/tile').Terrain, import('../types/tile').Terrain, import('../types/tile').Terrain] {
  // When we rotate a tile CW by r, what was the N edge becomes the E edge, etc.
  // To get what's now at `side` after rotation, look up what was at rotate(side, -r) before.
  const srcSide = SIDES[(SIDES.indexOf(side) + (4 - r / 90)) % 4] as EdgeSide;
  return proto.edges[srcSide];
}

export const ALL_SIDES: readonly EdgeSide[] = SIDES;
export const ALL_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
```

- [ ] **Step 3.2: Write a quick sanity test**

Create `src/core/tile/rotation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rotateSide, flipPos, opposite, stepCoord, rotateSlot } from './rotation';

describe('flipPos', () => {
  it('flips L↔R, keeps C', () => {
    expect(flipPos('L')).toBe('R');
    expect(flipPos('R')).toBe('L');
    expect(flipPos('C')).toBe('C');
  });
});

describe('opposite', () => {
  it('maps each side to its opposite', () => {
    expect(opposite('N')).toBe('S');
    expect(opposite('S')).toBe('N');
    expect(opposite('E')).toBe('W');
    expect(opposite('W')).toBe('E');
  });
});

describe('rotateSide', () => {
  it('rotates N CW by 90 → E', () => expect(rotateSide('N', 90)).toBe('E'));
  it('rotates N CW by 180 → S', () => expect(rotateSide('N', 180)).toBe('S'));
  it('rotates N CW by 270 → W', () => expect(rotateSide('N', 270)).toBe('W'));
  it('rotation 0 is identity', () => expect(rotateSide('W', 0)).toBe('W'));
});

describe('rotateSlot', () => {
  it('preserves pos, rotates side', () => {
    expect(rotateSlot({ side: 'N', pos: 'L' }, 90)).toEqual({ side: 'E', pos: 'L' });
  });
});

describe('stepCoord', () => {
  it('steps north decreases y', () => expect(stepCoord({ x: 0, y: 0 }, 'N')).toEqual({ x: 0, y: -1 }));
  it('steps east increases x',  () => expect(stepCoord({ x: 0, y: 0 }, 'E')).toEqual({ x: 1, y:  0 }));
});
```

- [ ] **Step 3.3: Run tests**

```bash
npx vitest run src/core/tile/rotation.test.ts
```

Expected: all pass.

- [ ] **Step 3.4: Commit**

```bash
git add src/core/tile/rotation.ts src/core/tile/rotation.test.ts
git commit -m "feat(core): tile rotation helpers"
```

---

## Task 4: PlacedTile + SegmentInstance types

**Files:**
- Create: `src/core/tile/Tile.ts`

- [ ] **Step 4.1: Write `src/core/tile/Tile.ts`**

```ts
import type { TilePrototype, SegmentKind, Rotation } from '../types/tile';
import type { TileId, SegmentRef, Coord } from '../types';

export interface SegmentInstance {
  ref: SegmentRef;
  kind: SegmentKind;
}

export interface PlacedTile {
  tileId: TileId;
  prototypeId: string;
  coord: Coord;
  rotation: Rotation;
  segmentInstances: SegmentInstance[];
}

let _nextTileSeq = 1;
export function makePlacedTile(
  proto: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): PlacedTile {
  const tileId = `T${_nextTileSeq++}`;
  return {
    tileId,
    prototypeId: proto.id,
    coord,
    rotation,
    segmentInstances: proto.segments.map(s => ({
      ref: { tileId, localId: s.localId },
      kind: s.kind,
    })),
  };
}

// For tests only — resets the sequence counter.
export function _resetTileSeq(): void { _nextTileSeq = 1; }
```

- [ ] **Step 4.2: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/core/tile/Tile.ts
git commit -m "feat(core): PlacedTile + makePlacedTile"
```

---

## Task 5: Feature types + registry

**Files:**
- Create: `src/core/feature/Feature.ts`
- Create: `src/core/feature/segments.ts`

- [ ] **Step 5.1: Write `src/core/feature/Feature.ts`**

```ts
import type { FeatureId, PlayerId, SegmentRef, TileId } from '../types';

export type FeatureKind = 'CITY' | 'ROAD' | 'MONASTERY' | 'FIELD';

export interface MeeplePlacement {
  playerId: PlayerId;
  segmentRef: SegmentRef;
}

export interface Feature {
  id: FeatureId;
  kind: FeatureKind;
  segments: Set<string>;       // segmentKey()
  openEdges: number;
  meeples: MeeplePlacement[];
  shieldCount: number;
  completed: boolean;
  monasteryTileId?: TileId;
  monasterySurroundCount?: number;
  closedCitiesAdjacent?: Set<FeatureId>;
}
```

- [ ] **Step 5.2: Write `src/core/feature/segments.ts`**

```ts
import type { FeatureId, SegmentRef } from '../types';
import { segmentKey } from '../types';
import type { Feature, FeatureKind } from './Feature';

export interface FeatureRegistry {
  features: Map<FeatureId, Feature>;
  segmentToFeature: Map<string, FeatureId>;
  nextId: number;
}

export function createRegistry(): FeatureRegistry {
  return { features: new Map(), segmentToFeature: new Map(), nextId: 1 };
}

export function createFeature(reg: FeatureRegistry, kind: FeatureKind): Feature {
  const id = `F${reg.nextId++}`;
  const f: Feature = {
    id, kind,
    segments: new Set(),
    openEdges: 0,
    meeples: [],
    shieldCount: 0,
    completed: false,
  };
  reg.features.set(id, f);
  return f;
}

export function attachSegment(reg: FeatureRegistry, feature: Feature, ref: SegmentRef): void {
  const k = segmentKey(ref);
  feature.segments.add(k);
  reg.segmentToFeature.set(k, feature.id);
}

export function lookupBySegment(reg: FeatureRegistry, ref: SegmentRef): Feature {
  const key = segmentKey(ref);
  const fid = reg.segmentToFeature.get(key);
  if (!fid) throw new Error(`No feature for segment ${key}`);
  const f = reg.features.get(fid);
  if (!f) throw new Error(`Feature ${fid} not found in registry`);
  return f;
}

export function retireFeature(reg: FeatureRegistry, id: FeatureId): void {
  reg.features.delete(id);
}
```

- [ ] **Step 5.3: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/core/feature/Feature.ts src/core/feature/segments.ts
git commit -m "feat(core): Feature type + FeatureRegistry"
```

---

## Task 6: Feature merge + completion detection

**Files:**
- Create: `src/core/feature/merge.ts`
- Create: `src/core/feature/completion.ts`

- [ ] **Step 6.1: Write `src/core/feature/merge.ts`**

```ts
import type { FeatureRegistry } from './segments';
import type { Feature } from './Feature';
import { retireFeature } from './segments';

export function unify(reg: FeatureRegistry, a: Feature, b: Feature): Feature {
  if (a.id === b.id) return a;
  // Smaller string id wins (stable across runs).
  const [winner, loser] = a.id < b.id ? [a, b] : [b, a];

  for (const k of loser.segments) {
    winner.segments.add(k);
    reg.segmentToFeature.set(k, winner.id);
  }

  winner.openEdges   += loser.openEdges;
  winner.shieldCount += loser.shieldCount;
  winner.meeples      = [...winner.meeples, ...loser.meeples];

  // Monastery counters: keep the winner's (features never merge across monasteries).
  retireFeature(reg, loser.id);
  return winner;
}
```

- [ ] **Step 6.2: Write `src/core/feature/completion.ts`**

```ts
import type { FeatureRegistry } from './segments';
import type { Feature } from './Feature';
import type { FeatureId } from '../types';

export function detectCompletions(
  reg: FeatureRegistry,
  touched: Iterable<FeatureId>,
): Feature[] {
  const out: Feature[] = [];
  for (const id of touched) {
    const f = reg.features.get(id);
    if (!f || f.completed) continue;

    if (f.kind === 'MONASTERY') {
      if ((f.monasterySurroundCount ?? 0) === 8) { f.completed = true; out.push(f); }
    } else if (f.kind !== 'FIELD') {
      if (f.openEdges === 0) { f.completed = true; out.push(f); }
    }
  }
  return out;
}
```

- [ ] **Step 6.3: Commit**

```bash
git add src/core/feature/merge.ts src/core/feature/completion.ts
git commit -m "feat(core): feature merge (union-find) + completion detection"
```

---

## Task 7: Board data type + full Board.ts

**Files:**
- Modify: `src/core/board/Board.ts` (replace MVP stub entirely)

- [ ] **Step 7.1: Replace `src/core/board/Board.ts`**

```ts
import type { Coord } from '../types';
import { coordKey } from '../types';
import type { PlacedTile } from '../tile/Tile';
import type { FeatureRegistry } from '../feature/segments';
import { createRegistry } from '../feature/segments';
import type { EdgeSide } from '../types/tile';
import { stepCoord } from '../tile/rotation';

export interface Board {
  tiles: Map<string, PlacedTile>;
  registry: FeatureRegistry;
}

export function createEmptyBoard(): Board {
  return { tiles: new Map(), registry: createRegistry() };
}

export function getTileAt(board: Board, coord: Coord): PlacedTile | undefined {
  return board.tiles.get(coordKey(coord));
}

export function getNeighbor(board: Board, coord: Coord, side: EdgeSide): PlacedTile | undefined {
  return getTileAt(board, stepCoord(coord, side));
}

export function allEightNeighborCoords(coord: Coord): Coord[] {
  const { x, y } = coord;
  return [
    { x: x - 1, y: y - 1 }, { x, y: y - 1 }, { x: x + 1, y: y - 1 },
    { x: x - 1, y },                           { x: x + 1, y },
    { x: x - 1, y: y + 1 }, { x, y: y + 1 }, { x: x + 1, y: y + 1 },
  ];
}

export function countPlacedNeighbors(board: Board, coord: Coord): number {
  return allEightNeighborCoords(coord).filter(c => board.tiles.has(coordKey(c))).length;
}

// Returns coords of all empty cells adjacent (4-directional) to any placed tile.
export function candidatePlacements(board: Board): Coord[] {
  const seen = new Set<string>();
  const result: Coord[] = [];
  for (const key of board.tiles.keys()) {
    const [x, y] = key.split(',').map(Number);
    for (const side of (['N', 'E', 'S', 'W'] as EdgeSide[])) {
      const n = stepCoord({ x, y }, side);
      const nk = coordKey(n);
      if (!board.tiles.has(nk) && !seen.has(nk)) {
        seen.add(nk);
        result.push(n);
      }
    }
  }
  return result;
}
```

- [ ] **Step 7.2: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
git add src/core/board/Board.ts
git commit -m "feat(core): Board data type + grid helpers"
```

---

## Task 8: Placement logic (canPlace + placeTileInternal)

**Files:**
- Create: `src/core/board/placement.ts`

This is the core algorithm. It implements §4.4.2 of the spec.

- [ ] **Step 8.1: Write placement tests first**

Create `src/core/board/placement.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../tile/Tile';
import { createEmptyBoard } from './Board';
import { canPlace, placeTileInternal, hasAnyLegalPlacement } from './placement';
import { TILE_D } from '../deck/tiles/tile-D'; // city-N + road E-W
import { TILE_U } from '../deck/tiles/tile-U'; // road N-S straight
import { TILE_B } from '../deck/tiles/tile-B'; // all-field, no roads

describe('canPlace', () => {
  beforeEach(() => _resetTileSeq());

  it('allows placing the first tile adjacent to origin when board is empty', () => {
    const board = createEmptyBoard();
    // Place start tile at origin manually
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    // North of origin: TILE_D has city-N, so north neighbor needs city-S
    // TILE_D with rotation 180 has city-S
    expect(canPlace(board, TILE_D, { x: 0, y: -1 }, 180)).toBe(true);
  });

  it('rejects occupied cell', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(canPlace(board, TILE_D, { x: 0, y: 0 }, 0)).toBe(false);
  });

  it('rejects cell not adjacent to any placed tile', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(canPlace(board, TILE_D, { x: 5, y: 5 }, 0)).toBe(false);
  });

  it('rejects mismatched edge terrains', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    // TILE_D has city on North. South neighbor needs city-N edge; TILE_B has all-field.
    expect(canPlace(board, TILE_B, { x: 0, y: 1 }, 0)).toBe(false); // S of origin = y+1; TILE_D.S=road, TILE_B.N=field — mismatch? Actually TILE_D south has road; TILE_B north has all field — check
    // South edge of TILE_D (rotation 0) is ['FIELD','ROAD','FIELD'].
    // North edge of TILE_B (rotation 0) is ['FIELD','FIELD','FIELD'].
    // Slot matching: TILE_D.S.L ↔ TILE_B.N.R, TILE_D.S.C ↔ TILE_B.N.C, TILE_D.S.R ↔ TILE_B.N.L
    // TILE_D.S.C = ROAD, TILE_B.N.C = FIELD → mismatch
    expect(canPlace(board, TILE_B, { x: 0, y: 1 }, 0)).toBe(false);
  });
});

describe('hasAnyLegalPlacement', () => {
  it('returns true when a tile can be placed after start tile', () => {
    const board = createEmptyBoard();
    placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(hasAnyLegalPlacement(board, TILE_D)).toBe(true);
  });
});

describe('placeTileInternal — feature merging', () => {
  beforeEach(() => _resetTileSeq());

  it('places start tile and creates features', () => {
    const board = createEmptyBoard();
    const result = placeTileInternal(board, TILE_D, { x: 0, y: 0 }, 0);
    expect(result.placed.coord).toEqual({ x: 0, y: 0 });
    expect(board.tiles.size).toBe(1);
    // TILE_D has: city-N (1 segment), road E-W (1 segment), 2 field segments
    expect(board.registry.features.size).toBe(4);
  });

  it('merges road segments when placing two straight road tiles end-to-end', () => {
    const board = createEmptyBoard();
    // TILE_U: road N-S straight
    placeTileInternal(board, TILE_U, { x: 0, y: 0 }, 0);
    placeTileInternal(board, TILE_U, { x: 0, y: 1 }, 0);

    // The road segments on both tiles should be the same feature
    const placed0 = board.tiles.get('0,0')!;
    const placed1 = board.tiles.get('0,1')!;
    const roadSeg0 = placed0.segmentInstances.find(s => s.kind === 'ROAD')!;
    const roadSeg1 = placed1.segmentInstances.find(s => s.kind === 'ROAD')!;

    const f0 = board.registry.segmentToFeature.get(`${roadSeg0.ref.tileId}#${roadSeg0.ref.localId}`)!;
    const f1 = board.registry.segmentToFeature.get(`${roadSeg1.ref.tileId}#${roadSeg1.ref.localId}`)!;
    expect(f0).toBe(f1);
  });
});
```

- [ ] **Step 8.2: Run tests (expect failures)**

```bash
npx vitest run src/core/board/placement.test.ts
```

Expected: module not found — `placement.ts` doesn't exist yet.

- [ ] **Step 8.3: Write `src/core/board/placement.ts`**

```ts
import type { TilePrototype, EdgeSide, SlotPos, Rotation } from '../types/tile';
import type { Coord, SegmentRef } from '../types';
import { coordKey } from '../types';
import { rotateSlot, opposite, stepCoord, ALL_SIDES, ALL_ROTATIONS, rotatedEdge } from '../tile/rotation';
import { makePlacedTile } from '../tile/Tile';
import type { PlacedTile } from '../tile/Tile';
import type { Board } from './Board';
import { allEightNeighborCoords, countPlacedNeighbors } from './Board';
import {
  createFeature, attachSegment, lookupBySegment,
} from '../feature/segments';
import type { FeatureKind } from '../feature/Feature';
import { unify } from '../feature/merge';
import { detectCompletions } from '../feature/completion';
import type { Feature } from '../feature/Feature';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SLOT_POSITIONS: SlotPos[] = ['L', 'C', 'R'];

function segKindToFeatureKind(k: string): FeatureKind {
  return k as FeatureKind;
}

/** Find the SegmentRef on a placed tile that owns board-space slot {side, pos}. */
function findSegRefByBoardSlot(
  placed: PlacedTile,
  proto: TilePrototype,
  side: EdgeSide,
  pos: SlotPos,
): SegmentRef {
  // Convert board-space slot to prototype space by un-rotating.
  const unrotated = rotateSlot({ side, pos }, ((360 - placed.rotation) % 360) as Rotation);
  const seg = proto.segments.find(s =>
    s.edgeSlots.some(es => es.side === unrotated.side && es.pos === unrotated.pos),
  );
  if (!seg) throw new Error(`No segment for slot ${side}/${pos} on tile ${placed.tileId}`);
  return placed.segmentInstances[seg.localId].ref;
}

/** Fetch TilePrototype from a PlacedTile via a passed-in lookup map. */
function protoFor(protoMap: Map<string, TilePrototype>, placed: PlacedTile): TilePrototype {
  const p = protoMap.get(placed.prototypeId);
  if (!p) throw new Error(`Prototype ${placed.prototypeId} not in lookup`);
  return p;
}

// ── canPlace ──────────────────────────────────────────────────────────────────

/**
 * Returns true iff `prototype` can be placed at `coord` with `rotation`.
 * Rules: cell must be empty, adjacent to at least one placed tile,
 * and every touching edge must match terrain slot-by-slot.
 */
export function canPlace(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): boolean {
  const key = coordKey(coord);
  if (board.tiles.has(key)) return false;

  let hasAdjacent = false;
  for (const side of ALL_SIDES) {
    const neighborCoord = stepCoord(coord, side);
    const neighbor = board.tiles.get(coordKey(neighborCoord));
    if (!neighbor) continue;
    hasAdjacent = true;

    const oppSide = opposite(side);
    // Get the neighbor's prototype from the registry via prototypeId.
    // We need to fetch it — store proto lookup on board or pass separately.
    // Solution: we reconstruct the edge using the stored PlacedTile.rotation and
    // re-read the prototype from a module-level cache (populated on each placeTileInternal call).
    const neighborEdge = getRotatedEdgeFromPlaced(neighbor, oppSide);

    for (const pos of SLOT_POSITIONS) {
      const newTerrain   = rotatedEdge(prototype, side, rotation)[SLOT_POSITIONS.indexOf(pos)];
      // Edge-matching convention: A.side.pos ↔ B.opposite.flipPos(pos)
      // But since we read the neighbor's edge directly (already rotated), we compare directly:
      // new tile's (side, pos) aligns with neighbor's (oppSide, flipPos(pos))
      const { flipPos } = require('../tile/rotation') as typeof import('../tile/rotation');
      const neighborTerrain = getRotatedEdgeFromPlaced(neighbor, oppSide)[SLOT_POSITIONS.indexOf(flipPos(pos))];
      if (newTerrain !== neighborTerrain) return false;
    }
  }

  return hasAdjacent;
}
```

Wait — `require` is not allowed in ESM. Let me rewrite `canPlace` without it:

```ts
import type { TilePrototype, EdgeSide, SlotPos, Rotation } from '../types/tile';
import type { Coord, SegmentRef } from '../types';
import { coordKey } from '../types';
import {
  rotateSlot, opposite, stepCoord, ALL_SIDES, ALL_ROTATIONS,
  flipPos, rotatedEdge,
} from '../tile/rotation';
import { makePlacedTile } from '../tile/Tile';
import type { PlacedTile } from '../tile/Tile';
import type { Board } from './Board';
import { allEightNeighborCoords, countPlacedNeighbors } from './Board';
import {
  createFeature, attachSegment, lookupBySegment,
} from '../feature/segments';
import type { FeatureKind } from '../feature/Feature';
import { unify } from '../feature/merge';
import { detectCompletions } from '../feature/completion';
import type { Feature } from '../feature/Feature';

export interface PlacementResult {
  placed: PlacedTile;
  completedFeatures: Feature[];
}

// Module-level prototype cache, populated by placeTileInternal.
const _protoCache = new Map<string, TilePrototype>();

function registerProto(proto: TilePrototype): void {
  _protoCache.set(proto.id, proto);
}

function getProto(id: string): TilePrototype {
  const p = _protoCache.get(id);
  if (!p) throw new Error(`Prototype ${id} not registered. Call placeTileInternal to register.`);
  return p;
}

function getRotatedEdgeFromPlaced(placed: PlacedTile, boardSide: EdgeSide): readonly [string, string, string] {
  const proto = getProto(placed.prototypeId);
  return rotatedEdge(proto, boardSide, placed.rotation);
}

const SLOT_IDX: Record<SlotPos, 0 | 1 | 2> = { L: 0, C: 1, R: 2 };
const SLOT_POSITIONS: SlotPos[] = ['L', 'C', 'R'];

export function canPlace(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): boolean {
  registerProto(prototype);
  const key = coordKey(coord);
  if (board.tiles.has(key)) return false;

  let hasAdjacent = false;
  for (const side of ALL_SIDES) {
    const neighborCoord = stepCoord(coord, side);
    const neighbor = board.tiles.get(coordKey(neighborCoord));
    if (!neighbor) continue;
    hasAdjacent = true;

    const oppSide = opposite(side);
    const newEdge      = rotatedEdge(prototype, side, rotation);
    const neighborEdge = getRotatedEdgeFromPlaced(neighbor, oppSide);

    for (const pos of SLOT_POSITIONS) {
      const newTerrain      = newEdge[SLOT_IDX[pos]];
      const neighborTerrain = neighborEdge[SLOT_IDX[flipPos(pos)]];
      if (newTerrain !== neighborTerrain) return false;
    }
  }

  return hasAdjacent;
}

export function hasAnyLegalPlacement(board: Board, prototype: TilePrototype): boolean {
  for (const rotation of ALL_ROTATIONS) {
    for (const coord of candidatePlacements(board)) {
      if (canPlace(board, prototype, coord, rotation)) return true;
    }
  }
  return false;
}

// ── placeTileInternal ─────────────────────────────────────────────────────────

function segKindToFeatureKind(k: string): FeatureKind {
  return k as FeatureKind;
}

function findSegRefByBoardSlot(
  placed: PlacedTile,
  proto: TilePrototype,
  side: EdgeSide,
  pos: SlotPos,
): SegmentRef {
  const unrotated = rotateSlot({ side, pos }, ((360 - placed.rotation) % 360) as Rotation);
  const seg = proto.segments.find(s =>
    s.edgeSlots.some(es => es.side === unrotated.side && es.pos === unrotated.pos),
  );
  if (!seg) throw new Error(`No segment for slot ${side}/${pos} on tile ${placed.tileId}`);
  return placed.segmentInstances[seg.localId].ref;
}

export function placeTileInternal(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): PlacementResult {
  registerProto(prototype);

  // Step 1: construct PlacedTile.
  const placed = makePlacedTile(prototype, coord, rotation);

  // Step 2: create a fresh Feature for each new segment.
  const touchedFeatureIds = new Set<string>();
  for (const seg of prototype.segments) {
    const kind = segKindToFeatureKind(seg.kind);
    const feature = createFeature(board.registry, kind);
    if (seg.kind !== 'MONASTERY') {
      feature.openEdges = seg.edgeSlots.length;
    }
    if (seg.kind === 'CITY' && prototype.hasShield && seg.isShielded) {
      feature.shieldCount = 1;
    }
    if (seg.kind === 'MONASTERY') {
      feature.monasteryTileId = placed.tileId;
      feature.monasterySurroundCount = countPlacedNeighbors(board, coord);
    }
    const ref: SegmentRef = { tileId: placed.tileId, localId: seg.localId };
    attachSegment(board.registry, feature, ref);
    touchedFeatureIds.add(feature.id);
  }

  // Step 3: insert tile into board.
  board.tiles.set(coordKey(coord), placed);

  // Step 4: for each neighbor, walk 3 slots and close/merge features.
  for (const side of ALL_SIDES) {
    const neighborCoord = stepCoord(coord, side);
    const neighbor = board.tiles.get(coordKey(neighborCoord));
    if (!neighbor) continue;
    const neighborProto = getProto(neighbor.prototypeId);
    const oppSide = opposite(side);

    for (const pos of SLOT_POSITIONS) {
      const newRef      = findSegRefByBoardSlot(placed, prototype, side, pos);
      const neighborRef = findSegRefByBoardSlot(neighbor, neighborProto, oppSide, flipPos(pos));

      const newFeat      = lookupBySegment(board.registry, newRef);
      const neighborFeat = lookupBySegment(board.registry, neighborRef);

      newFeat.openEdges      -= 1;
      neighborFeat.openEdges -= 1;

      if (newFeat.id !== neighborFeat.id) {
        const winner = unify(board.registry, newFeat, neighborFeat);
        touchedFeatureIds.delete(newFeat.id === winner.id ? neighborFeat.id : newFeat.id);
        touchedFeatureIds.add(winner.id);
      }
    }
  }

  // Step 5: update monastery surround counts for neighbors of coord.
  for (const nc of allEightNeighborCoords(coord)) {
    const t = board.tiles.get(coordKey(nc));
    if (!t) continue;
    for (const seg of t.segmentInstances) {
      if (seg.kind === 'MONASTERY') {
        const f = lookupBySegment(board.registry, seg.ref);
        if (f.monasterySurroundCount !== undefined) {
          f.monasterySurroundCount += 1;
          touchedFeatureIds.add(f.id);
        }
      }
    }
  }

  // Step 6: detect completions.
  const completedFeatures = detectCompletions(board.registry, touchedFeatureIds);

  return { placed, completedFeatures };
}

// Need to import candidatePlacements — add it to Board.ts first.
import { candidatePlacements } from './Board';
```

Actually there's a circular import issue with importing `candidatePlacements` at the bottom. Let me rewrite cleanly:

```ts
import type { TilePrototype, EdgeSide, SlotPos, Rotation } from '../types/tile';
import type { Coord, SegmentRef } from '../types';
import { coordKey } from '../types';
import {
  rotateSlot, opposite, stepCoord, ALL_SIDES, ALL_ROTATIONS,
  flipPos, rotatedEdge,
} from '../tile/rotation';
import { makePlacedTile } from '../tile/Tile';
import type { PlacedTile } from '../tile/Tile';
import type { Board } from './Board';
import { allEightNeighborCoords, countPlacedNeighbors, candidatePlacements } from './Board';
import {
  createFeature, attachSegment, lookupBySegment,
} from '../feature/segments';
import type { FeatureKind } from '../feature/Feature';
import { unify } from '../feature/merge';
import { detectCompletions } from '../feature/completion';
import type { Feature } from '../feature/Feature';

export interface PlacementResult {
  placed: PlacedTile;
  completedFeatures: Feature[];
}

const _protoCache = new Map<string, TilePrototype>();

export function registerProto(proto: TilePrototype): void {
  _protoCache.set(proto.id, proto);
}

function getProto(id: string): TilePrototype {
  const p = _protoCache.get(id);
  if (!p) throw new Error(`Prototype ${id} not registered`);
  return p;
}

function getRotatedEdge(placed: PlacedTile, boardSide: EdgeSide): readonly [string, string, string] {
  return rotatedEdge(getProto(placed.prototypeId), boardSide, placed.rotation);
}

const SLOT_POSITIONS: SlotPos[] = ['L', 'C', 'R'];
const SLOT_IDX: Record<SlotPos, number> = { L: 0, C: 1, R: 2 };

function findSegRef(
  placed: PlacedTile,
  proto: TilePrototype,
  boardSide: EdgeSide,
  boardPos: SlotPos,
): SegmentRef {
  const unrotated = rotateSlot({ side: boardSide, pos: boardPos },
    ((360 - placed.rotation) % 360) as Rotation);
  const seg = proto.segments.find(s =>
    s.edgeSlots.some(es => es.side === unrotated.side && es.pos === unrotated.pos),
  );
  if (!seg) throw new Error(`No segment for ${boardSide}/${boardPos} on ${placed.tileId}`);
  return placed.segmentInstances[seg.localId].ref;
}

export function canPlace(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): boolean {
  registerProto(prototype);
  if (board.tiles.has(coordKey(coord))) return false;

  let hasAdjacent = false;
  for (const side of ALL_SIDES) {
    const neighbor = board.tiles.get(coordKey(stepCoord(coord, side)));
    if (!neighbor) continue;
    hasAdjacent = true;

    const newEdge      = rotatedEdge(prototype, side, rotation);
    const neighborEdge = getRotatedEdge(neighbor, opposite(side));

    for (const pos of SLOT_POSITIONS) {
      if (newEdge[SLOT_IDX[pos]] !== neighborEdge[SLOT_IDX[flipPos(pos)]]) return false;
    }
  }
  return hasAdjacent;
}

export function hasAnyLegalPlacement(board: Board, prototype: TilePrototype): boolean {
  registerProto(prototype);
  const candidates = candidatePlacements(board);
  for (const rotation of ALL_ROTATIONS) {
    for (const coord of candidates) {
      if (canPlace(board, prototype, coord, rotation)) return true;
    }
  }
  return false;
}

export function placeTileInternal(
  board: Board,
  prototype: TilePrototype,
  coord: Coord,
  rotation: Rotation,
): PlacementResult {
  registerProto(prototype);
  const placed = makePlacedTile(prototype, coord, rotation);

  const touchedIds = new Set<string>();

  for (const seg of prototype.segments) {
    const kind = seg.kind as FeatureKind;
    const feature = createFeature(board.registry, kind);
    if (seg.kind !== 'MONASTERY') feature.openEdges = seg.edgeSlots.length;
    if (seg.kind === 'CITY' && prototype.hasShield && seg.isShielded) feature.shieldCount = 1;
    if (seg.kind === 'MONASTERY') {
      feature.monasteryTileId = placed.tileId;
      feature.monasterySurroundCount = countPlacedNeighbors(board, coord);
    }
    attachSegment(board.registry, feature, { tileId: placed.tileId, localId: seg.localId });
    touchedIds.add(feature.id);
  }

  board.tiles.set(coordKey(coord), placed);

  for (const side of ALL_SIDES) {
    const neighbor = board.tiles.get(coordKey(stepCoord(coord, side)));
    if (!neighbor) continue;
    const neighborProto = getProto(neighbor.prototypeId);
    const oppSide = opposite(side);

    for (const pos of SLOT_POSITIONS) {
      const newRef  = findSegRef(placed, prototype, side, pos);
      const nRef    = findSegRef(neighbor, neighborProto, oppSide, flipPos(pos));

      let fNew = lookupBySegment(board.registry, newRef);
      let fNeighbor = lookupBySegment(board.registry, nRef);

      fNew.openEdges      -= 1;
      fNeighbor.openEdges -= 1;

      if (fNew.id !== fNeighbor.id) {
        const loserIdBeforeUnify = fNew.id < fNeighbor.id ? fNeighbor.id : fNew.id;
        const winner = unify(board.registry, fNew, fNeighbor);
        touchedIds.delete(loserIdBeforeUnify);
        touchedIds.add(winner.id);
      }
    }
  }

  for (const nc of allEightNeighborCoords(coord)) {
    const t = board.tiles.get(coordKey(nc));
    if (!t) continue;
    for (const seg of t.segmentInstances) {
      if (seg.kind === 'MONASTERY') {
        const f = lookupBySegment(board.registry, seg.ref);
        if (f.monasterySurroundCount !== undefined) {
          f.monasterySurroundCount += 1;
          touchedIds.add(f.id);
        }
      }
    }
  }

  const completedFeatures = detectCompletions(board.registry, touchedIds);
  return { placed, completedFeatures };
}
```

- [ ] **Step 8.4: Write placement.ts**

Write the final version from Step 8.3 (the last clean version) to `src/core/board/placement.ts`.

- [ ] **Step 8.5: Run placement tests**

```bash
npx vitest run src/core/board/placement.test.ts
```

Expected: all tests pass.

- [ ] **Step 8.6: Commit**

```bash
git add src/core/board/placement.ts src/core/board/placement.test.ts
git commit -m "feat(core): canPlace + placeTileInternal with feature merging"
```

---

## Task 9: Scoring

**Files:**
- Create: `src/core/scoring/majority.ts`
- Create: `src/core/scoring/midGame.ts`
- Create: `src/core/scoring/endGame.ts`
- Create: `src/core/scoring/farmers.ts`

- [ ] **Step 9.1: Write `src/core/scoring/majority.ts`**

```ts
import type { PlayerId } from '../types';
import type { Feature } from '../feature/Feature';

export function majorityWinners(feature: Feature): PlayerId[] {
  if (feature.meeples.length === 0) return [];
  const counts = new Map<PlayerId, number>();
  for (const m of feature.meeples) {
    counts.set(m.playerId, (counts.get(m.playerId) ?? 0) + 1);
  }
  const max = Math.max(...counts.values());
  return [...counts.entries()].filter(([, c]) => c === max).map(([p]) => p);
}
```

- [ ] **Step 9.2: Write `src/core/scoring/midGame.ts`**

```ts
import type { PlayerId, TileId } from '../types';
import { parseSegmentKey } from '../types';
import type { Feature } from '../feature/Feature';
import { majorityWinners } from './majority';

export function scoreCompletedMidGame(f: Feature): { winners: PlayerId[]; points: number } {
  return { winners: majorityWinners(f), points: pointsForCompleted(f) };
}

function pointsForCompleted(f: Feature): number {
  switch (f.kind) {
    case 'CITY':       return 2 * (tileCount(f) + f.shieldCount);
    case 'ROAD':       return tileCount(f);
    case 'MONASTERY':  return 9;
    case 'FIELD':      throw new Error('Fields do not complete mid-game');
  }
}

export function tileCount(f: Feature): number {
  const tiles = new Set<TileId>();
  for (const k of f.segments) tiles.add(parseSegmentKey(k).tileId);
  return tiles.size;
}
```

- [ ] **Step 9.3: Write `src/core/scoring/endGame.ts`**

```ts
import type { PlayerId } from '../types';
import type { Feature } from '../feature/Feature';
import { majorityWinners } from './majority';
import { tileCount } from './midGame';

export function scoreIncompleteEndGame(f: Feature): { winners: PlayerId[]; points: number } {
  const winners = majorityWinners(f);
  let points: number;
  switch (f.kind) {
    case 'CITY':      points = tileCount(f) + f.shieldCount; break;
    case 'ROAD':      points = tileCount(f); break;
    case 'MONASTERY': points = 1 + (f.monasterySurroundCount ?? 0); break;
    case 'FIELD':     points = 0; break;
  }
  return { winners, points };
}
```

- [ ] **Step 9.4: Write `src/core/scoring/farmers.ts`**

```ts
import type { FeatureId, PlayerId } from '../types';
import { parseSegmentKey } from '../types';
import type { Feature } from '../feature/Feature';
import type { FeatureRegistry } from '../feature/segments';
import { majorityWinners } from './majority';
import type { PlacedTile } from '../tile/Tile';

export function scoreFarmers(
  reg: FeatureRegistry,
  tileById: Map<string, PlacedTile>,
): Array<{ winners: PlayerId[]; points: number; fieldId: FeatureId }> {
  const out: Array<{ winners: PlayerId[]; points: number; fieldId: FeatureId }> = [];
  for (const f of reg.features.values()) {
    if (f.kind !== 'FIELD') continue;
    if (f.meeples.length === 0) continue;
    const adjacent = computeAdjacentCompletedCities(reg, f, tileById);
    const winners = majorityWinners(f);
    out.push({ winners, points: adjacent.size * 3, fieldId: f.id });
  }
  return out;
}

function computeAdjacentCompletedCities(
  reg: FeatureRegistry,
  field: Feature,
  tileById: Map<string, PlacedTile>,
): Set<FeatureId> {
  const adjacent = new Set<FeatureId>();
  const fieldTiles = new Set<string>();
  for (const k of field.segments) fieldTiles.add(parseSegmentKey(k).tileId);

  for (const tileId of fieldTiles) {
    const placed = tileById.get(tileId);
    if (!placed) continue;
    for (const inst of placed.segmentInstances) {
      if (inst.kind !== 'CITY') continue;
      const fid = reg.segmentToFeature.get(`${inst.ref.tileId}#${inst.ref.localId}`);
      if (!fid) continue;
      const cityFeature = reg.features.get(fid);
      if (cityFeature?.completed) adjacent.add(fid);
    }
  }
  return adjacent;
}
```

- [ ] **Step 9.5: Write majority test**

Create `src/core/scoring/majority.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { majorityWinners } from './majority';
import type { Feature } from '../feature/Feature';

function makeFeature(meeples: Array<{ playerId: string }>): Feature {
  return {
    id: 'F1', kind: 'CITY',
    segments: new Set(), openEdges: 0,
    meeples: meeples.map(m => ({ playerId: m.playerId, segmentRef: { tileId: 'T1', localId: 0 } })),
    shieldCount: 0, completed: true,
  };
}

describe('majorityWinners', () => {
  it('returns [] for no meeples', () => {
    expect(majorityWinners(makeFeature([]))).toEqual([]);
  });
  it('returns sole winner', () => {
    expect(majorityWinners(makeFeature([{ playerId: 'P1' }, { playerId: 'P1' }]))).toEqual(['P1']);
  });
  it('returns both on tie', () => {
    const result = majorityWinners(makeFeature([{ playerId: 'P1' }, { playerId: 'P2' }]));
    expect(result.sort()).toEqual(['P1', 'P2']);
  });
  it('losers not included in tie', () => {
    const result = majorityWinners(makeFeature([
      { playerId: 'P1' }, { playerId: 'P1' },
      { playerId: 'P2' },
    ]));
    expect(result).toEqual(['P1']);
  });
});
```

- [ ] **Step 9.6: Run scoring tests**

```bash
npx vitest run src/core/scoring/majority.test.ts
```

Expected: all pass.

- [ ] **Step 9.7: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9.8: Commit**

```bash
git add src/core/scoring/
git commit -m "feat(core): scoring — majority, mid-game, end-game, farmers"
```

---

## Task 10: GameState + Game aggregate

**Files:**
- Create: `src/core/game/GameState.ts`
- Create: `src/core/game/Game.ts`

- [ ] **Step 10.1: Write `src/core/game/GameState.ts`**

```ts
import type {
  Player, GamePhase, Rotation,
  FeatureId, Result,
} from '../types';
import type { TilePrototype } from '../types/tile';
import type { Board } from '../board/Board';
import type { Deck } from '../deck/Deck';
import type { TileId } from '../types';

export interface GameState {
  version: number;
  board: Board;
  deck: Deck;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  pendingTile: TilePrototype | null;
  pendingRotation: Rotation;
  lastPlacedTileId: TileId | null;
  lastCompletedFeatures: FeatureId[];
}
```

- [ ] **Step 10.2: Write `src/core/game/Game.ts`**

```ts
import type { Coord, SegmentRef, Result, Rotation } from '../types';
import {
  ok, okVoid, err,
  MEEPLES_PER_PLAYER, PLAYER_COLORS,
} from '../types';
import { createEmptyBoard } from '../board/Board';
import { canPlace, placeTileInternal, hasAnyLegalPlacement } from '../board/placement';
import { buildRemainingTiles, START_TILE } from '../deck/baseGameTiles';
import { shuffle, drawPlaceable } from '../deck/Deck';
import { lookupBySegment } from '../feature/segments';
import { scoreCompletedMidGame } from '../scoring/midGame';
import { scoreIncompleteEndGame } from '../scoring/endGame';
import { scoreFarmers } from '../scoring/farmers';
import type { Feature } from '../feature/Feature';
import type { GameState } from './GameState';

export function startGame(
  playerNames: string[],
  rng: () => number = Math.random,
): GameState {
  if (playerNames.length < 2 || playerNames.length > 5) {
    throw new Error('playerCount must be 2..5');
  }

  const players = playerNames.map((name, i) => ({
    id: `P${i + 1}`,
    name,
    color: PLAYER_COLORS[i],
    score: 0,
    meeplesAvailable: MEEPLES_PER_PLAYER,
  }));

  const deck = {
    startTile: START_TILE,
    remaining: buildRemainingTiles(),
  };
  shuffle(deck, rng);

  const state: GameState = {
    version: 1,
    board: createEmptyBoard(),
    deck,
    players,
    currentPlayerIndex: 0,
    phase: 'PLACING_TILE',
    pendingTile: null,
    pendingRotation: 0,
    lastPlacedTileId: null,
    lastCompletedFeatures: [],
  };

  placeTileInternal(state.board, deck.startTile, { x: 0, y: 0 }, 0);
  return state;
}

export function drawTile(state: GameState): Result {
  if (state.phase !== 'PLACING_TILE') return err('WRONG_PHASE', 'Not in PLACING_TILE phase');
  if (state.pendingTile !== null) return okVoid(); // idempotent

  const tile = drawPlaceable(
    state.deck,
    (t) => hasAnyLegalPlacement(state.board, t),
  );

  if (!tile) {
    _applyEndGame(state);
    return okVoid();
  }

  state.pendingTile = tile;
  state.pendingRotation = 0;
  state.version++;
  return okVoid();
}

export function rotatePending(state: GameState, direction: 'CW' | 'CCW'): Result {
  if (state.phase !== 'PLACING_TILE') return err('WRONG_PHASE', 'Not in PLACING_TILE phase');
  if (!state.pendingTile) return err('NO_PENDING_TILE', 'No pending tile to rotate');
  const delta = direction === 'CW' ? 90 : 270;
  state.pendingRotation = ((state.pendingRotation + delta) % 360) as Rotation;
  state.version++;
  return okVoid();
}

export function placeTile(state: GameState, coord: Coord): Result {
  if (state.phase !== 'PLACING_TILE') return err('WRONG_PHASE', 'Not in PLACING_TILE phase');
  if (!state.pendingTile) return err('NO_PENDING_TILE', 'No tile drawn yet');

  if (!canPlace(state.board, state.pendingTile, coord, state.pendingRotation)) {
    // Determine a more specific error.
    const key = `${coord.x},${coord.y}`;
    if (state.board.tiles.has(key)) return err('CELL_OCCUPIED', 'Cell is already occupied');
    // Check adjacency separately.
    return err('EDGE_MISMATCH', 'Tile does not fit here');
  }

  const { placed, completedFeatures } = placeTileInternal(
    state.board, state.pendingTile, coord, state.pendingRotation,
  );

  state.lastPlacedTileId = placed.tileId;
  state.lastCompletedFeatures = completedFeatures.map(f => f.id);
  state.pendingTile = null;
  state.pendingRotation = 0;
  state.phase = 'PLACING_MEEPLE';
  state.version++;
  return okVoid();
}

export function placeMeeple(state: GameState, ref: SegmentRef): Result {
  if (state.phase !== 'PLACING_MEEPLE') return err('WRONG_PHASE', 'Not in PLACING_MEEPLE phase');

  if (ref.tileId !== state.lastPlacedTileId) {
    return err('MEEPLE_NOT_ON_PLACED_TILE', 'Meeple must go on the tile just placed');
  }

  const player = state.players[state.currentPlayerIndex];
  if (player.meeplesAvailable <= 0) return err('NO_MEEPLES_AVAILABLE', 'No meeples left');

  const feature = lookupBySegment(state.board.registry, ref);
  if (feature.meeples.length > 0) return err('MEEPLE_FEATURE_OCCUPIED', 'Feature already has a meeple');
  if (feature.completed) return err('MEEPLE_FEATURE_COMPLETED', 'Feature is already completed');

  feature.meeples.push({ playerId: player.id, segmentRef: ref });
  player.meeplesAvailable -= 1;

  _resolveScoring(state);
  _advanceTurn(state);
  return okVoid();
}

export function skipMeeple(state: GameState): Result {
  if (state.phase !== 'PLACING_MEEPLE') return err('WRONG_PHASE', 'Not in PLACING_MEEPLE phase');
  _resolveScoring(state);
  _advanceTurn(state);
  return okVoid();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _resolveScoring(state: GameState): void {
  for (const fid of state.lastCompletedFeatures) {
    const feature = state.board.registry.features.get(fid);
    if (!feature) continue;
    const { winners, points } = scoreCompletedMidGame(feature);
    for (const pid of winners) {
      const p = state.players.find(p => p.id === pid);
      if (p) p.score += points;
    }
    for (const m of feature.meeples) {
      const p = state.players.find(p => p.id === m.playerId);
      if (p) p.meeplesAvailable += 1;
    }
    feature.meeples = [];
  }
  state.lastCompletedFeatures = [];
}

function _advanceTurn(state: GameState): void {
  if (!state.deck.remaining.length) {
    _applyEndGame(state);
    return;
  }
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.phase = 'PLACING_TILE';
  state.lastPlacedTileId = null;
  state.version++;
}

function _applyEndGame(state: GameState): void {
  // Incomplete features (non-field)
  for (const f of state.board.registry.features.values()) {
    if (f.completed) continue;
    if (f.kind === 'FIELD') continue;
    const { winners, points } = scoreIncompleteEndGame(f);
    for (const pid of winners) {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.score += points;
    }
  }

  // Farmers
  const tileById = new Map<string, import('../tile/Tile').PlacedTile>();
  for (const [, t] of state.board.tiles) tileById.set(t.tileId, t);

  for (const r of scoreFarmers(state.board.registry, tileById)) {
    for (const pid of r.winners) {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.score += r.points;
    }
  }

  state.phase = 'GAME_OVER';
  state.version++;
}

export function getMeepleTargets(state: GameState): SegmentRef[] {
  if (state.phase !== 'PLACING_MEEPLE' || !state.lastPlacedTileId) return [];
  const placed = [...state.board.tiles.values()].find(t => t.tileId === state.lastPlacedTileId);
  if (!placed) return [];

  const player = state.players[state.currentPlayerIndex];
  if (player.meeplesAvailable <= 0) return [];

  return placed.segmentInstances
    .filter(seg => {
      const feature = lookupBySegment(state.board.registry, seg.ref);
      return feature.meeples.length === 0 && !feature.completed;
    })
    .map(seg => seg.ref);
}
```

- [ ] **Step 10.3: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10.4: Write integration smoke test**

Create `src/core/game/Game.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { startGame, drawTile, placeTile, skipMeeple } from './Game';
import { _resetTileSeq } from '../tile/Tile';

describe('Game full turn cycle', () => {
  beforeEach(() => _resetTileSeq());

  it('starts in PLACING_TILE with one tile on the board', () => {
    const state = startGame(['Alice', 'Bob']);
    expect(state.phase).toBe('PLACING_TILE');
    expect(state.board.tiles.size).toBe(1);
    expect(state.players.length).toBe(2);
    expect(state.deck.remaining.length).toBe(71); // 72 - 1 (start tile already drawn from remaining)
  });

  it('completes a full turn: draw → place → skip meeple', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    drawTile(state);
    expect(state.pendingTile).not.toBeNull();
    expect(state.phase).toBe('PLACING_TILE');

    // Try placing until we find a valid spot (use canPlace via brute-force)
    const { canPlace } = await import('../board/placement');
    const { ALL_ROTATIONS } = await import('../tile/rotation');

    let placed = false;
    outer: for (const [key] of state.board.tiles) {
      const [x, y] = key.split(',').map(Number);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        if (dx === 0 && dy === 0) continue;
        for (const r of ALL_ROTATIONS) {
          const coord = { x: x + dx, y: y + dy };
          if (canPlace(state.board, state.pendingTile!, coord, r)) {
            state.pendingRotation = r;
            const result = placeTile(state, coord);
            expect(result.ok).toBe(true);
            placed = true;
            break outer;
          }
        }
      }
    }
    expect(placed).toBe(true);
    expect(state.phase).toBe('PLACING_MEEPLE');

    skipMeeple(state);
    expect(state.phase).toBe('PLACING_TILE');
    expect(state.currentPlayerIndex).toBe(1); // advanced to Bob
  });
});
```

- [ ] **Step 10.5: Run game tests**

```bash
npx vitest run src/core/game/Game.test.ts
```

Expected: all pass.

- [ ] **Step 10.6: Commit**

```bash
git add src/core/game/
git commit -m "feat(core): GameState + Game aggregate (startGame, drawTile, placeTile, meeple, endgame)"
```

---

## Task 11: Controller

**Files:**
- Create: `src/controller/pubsub.ts`
- Create: `src/controller/GameController.ts`

- [ ] **Step 11.1: Write `src/controller/pubsub.ts`**

```ts
export type Unsubscribe = () => void;

export interface PubSub<T> {
  subscribe(listener: (value: T) => void): Unsubscribe;
  publish(value: T): void;
}

export function createPubSub<T>(): PubSub<T> {
  const listeners = new Set<(v: T) => void>();
  return {
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    publish(v)   { for (const l of listeners) l(v); },
  };
}
```

- [ ] **Step 11.2: Write `src/controller/GameController.ts`**

```ts
import type { Coord, SegmentRef, Result, Rotation } from '../core/types';
import { err, okVoid } from '../core/types';
import type { GameState } from '../core/game/GameState';
import {
  startGame, drawTile, rotatePending,
  placeTile, placeMeeple, skipMeeple, getMeepleTargets,
} from '../core/game/Game';
import { canPlace } from '../core/board/placement';
import { createPubSub } from './pubsub';
import type { Unsubscribe } from './pubsub';
import type { ErrorCode } from '../core/types';

export interface GameController {
  startGame(playerNames: string[]): Result;
  drawTile(): Result;
  rotatePending(direction: 'CW' | 'CCW'): Result;
  placeTile(coord: Coord): Result;
  placeMeeple(ref: SegmentRef): Result;
  skipMeeple(): Result;
  getState(): Readonly<GameState>;
  previewPlacement(coord: Coord, rotation: Rotation): { legal: true } | { legal: false; reason: ErrorCode };
  getMeepleTargetsForLastTile(): SegmentRef[];
  subscribe(listener: (state: Readonly<GameState>) => void): Unsubscribe;
}

export function createGameController(): GameController {
  let state: GameState | null = null;
  const pubsub = createPubSub<Readonly<GameState>>();

  function requireState(): GameState {
    if (!state) throw new Error('Game not started');
    return state;
  }

  function publish(): void {
    pubsub.publish(requireState());
  }

  return {
    startGame(playerNames) {
      try {
        state = startGame(playerNames);
        publish();
        return okVoid();
      } catch (e) {
        return err('WRONG_PHASE', String(e));
      }
    },

    drawTile() {
      const s = requireState();
      const r = drawTile(s);
      if (r.ok) publish();
      return r;
    },

    rotatePending(direction) {
      const s = requireState();
      const r = rotatePending(s, direction);
      if (r.ok) publish();
      return r;
    },

    placeTile(coord) {
      const s = requireState();
      const r = placeTile(s, coord);
      if (r.ok) publish();
      return r;
    },

    placeMeeple(ref) {
      const s = requireState();
      const r = placeMeeple(s, ref);
      if (r.ok) publish();
      return r;
    },

    skipMeeple() {
      const s = requireState();
      const r = skipMeeple(s);
      if (r.ok) publish();
      return r;
    },

    getState() {
      return requireState();
    },

    previewPlacement(coord, rotation) {
      const s = requireState();
      if (s.phase !== 'PLACING_TILE' || !s.pendingTile) {
        return { legal: false, reason: 'WRONG_PHASE' as ErrorCode };
      }
      if (canPlace(s.board, s.pendingTile, coord, rotation)) {
        return { legal: true };
      }
      const key = `${coord.x},${coord.y}`;
      if (s.board.tiles.has(key)) return { legal: false, reason: 'CELL_OCCUPIED' as ErrorCode };
      return { legal: false, reason: 'EDGE_MISMATCH' as ErrorCode };
    },

    getMeepleTargetsForLastTile() {
      return getMeepleTargets(requireState());
    },

    subscribe(listener) {
      return pubsub.subscribe(listener);
    },
  };
}
```

- [ ] **Step 11.3: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11.4: Commit**

```bash
git add src/controller/
git commit -m "feat(controller): PubSub + GameController"
```

---

## Task 12: React hooks

**Files:**
- Create: `src/ui/hooks/useController.ts`
- Create: `src/ui/hooks/useGameState.ts`

- [ ] **Step 12.1: Write `src/ui/hooks/useController.ts`**

```ts
import { createContext, useContext } from 'react';
import type { GameController } from '../../controller/GameController';

export const ControllerContext = createContext<GameController | null>(null);

export function useController(): GameController {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('ControllerContext not provided');
  return c;
}
```

- [ ] **Step 12.2: Write `src/ui/hooks/useGameState.ts`**

```ts
import { useState, useEffect } from 'react';
import type { GameState } from '../../core/game/GameState';
import { useController } from './useController';

export function useGameState(): Readonly<GameState> {
  const controller = useController();
  const [, setVersion] = useState(() => controller.getState().version);
  useEffect(() => controller.subscribe(s => setVersion(s.version)), [controller]);
  return controller.getState();
}
```

- [ ] **Step 12.3: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 12.4: Commit**

```bash
git add src/ui/hooks/
git commit -m "feat(ui): useController + useGameState hooks"
```

---

## Task 13: TileView component

**Files:**
- Create: `src/ui/board/TileView.tsx`

Renders a single tile at a given grid position. Shows the tile image rotated correctly and overlays meeple dots.

- [ ] **Step 13.1: Write `src/ui/board/TileView.tsx`**

```tsx
import type { PlacedTile } from '../../core/tile/Tile';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player } from '../../core/types';
import tileDistribution from '../../core/deck/tileDistribution.json';

const TILE_SIZE = 80; // px

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

interface Props {
  placed: PlacedTile;
  registry: FeatureRegistry;
  players: Player[];
  size?: number;
}

export function TileView({ placed, registry, players, size = TILE_SIZE }: Props) {
  const imgSrc = tileImageMap[placed.prototypeId] ?? '';
  const meeples = placed.segmentInstances.flatMap(seg => {
    const fid = registry.segmentToFeature.get(`${seg.ref.tileId}#${seg.ref.localId}`);
    const feature = fid ? registry.features.get(fid) : undefined;
    return (feature?.meeples ?? [])
      .filter(m => m.segmentRef.tileId === placed.tileId && m.segmentRef.localId === seg.ref.localId)
      .map(m => ({ playerId: m.playerId }));
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <img
        src={imgSrc}
        alt={placed.prototypeId}
        style={{
          width: '100%',
          height: '100%',
          transform: `rotate(${placed.rotation}deg)`,
          display: 'block',
        }}
      />
      {meeples.map((m, i) => {
        const player = players.find(p => p.id === m.playerId);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: `translate(-50%, -50%) translate(${(i - meeples.length / 2 + 0.5) * 12}px, 0)`,
              width: 12, height: 12,
              borderRadius: '50%',
              background: player?.color ?? '#888',
              border: '1.5px solid white',
              zIndex: 2,
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 13.2: Commit**

```bash
git add src/ui/board/TileView.tsx
git commit -m "feat(ui): TileView — tile image + meeple dots"
```

---

## Task 14: GhostTile + BoardView

**Files:**
- Create: `src/ui/board/GhostTile.tsx`
- Create: `src/ui/board/BoardView.tsx`
- Create: `src/ui/board/board.css`

- [ ] **Step 14.1: Write `src/ui/board/GhostTile.tsx`**

```tsx
interface Props {
  size: number;
  legal: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  imageSrc: string;
  rotation: number;
}

export function GhostTile({ size, legal, onClick, onHover, onLeave, imageSrc, rotation }: Props) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        width: size, height: size,
        position: 'relative',
        cursor: legal ? 'pointer' : 'not-allowed',
        border: `2px dashed ${legal ? '#4ade80' : '#f87171'}`,
        boxSizing: 'border-box',
        opacity: 0.6,
      }}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt="preview"
          style={{
            width: '100%', height: '100%',
            transform: `rotate(${rotation}deg)`,
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 14.2: Write `src/ui/board/board.css`**

```css
.board-scroll {
  overflow: auto;
  flex: 1;
  background: #2d5016;
  cursor: grab;
}

.board-scroll:active {
  cursor: grabbing;
}

.board-grid {
  display: grid;
  position: relative;
}

.board-cell {
  position: relative;
}
```

- [ ] **Step 14.3: Write `src/ui/board/BoardView.tsx`**

```tsx
import { useState, useMemo } from 'react';
import type { GameState } from '../../core/game/GameState';
import type { GameController } from '../../controller/GameController';
import { TileView } from './TileView';
import { GhostTile } from './GhostTile';
import { candidatePlacements } from '../../core/board/Board';
import tileDistribution from '../../core/deck/tileDistribution.json';
import './board.css';

const TILE_SIZE = 80;

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

interface Props {
  state: GameState;
  controller: GameController;
}

export function BoardView({ state, controller }: Props) {
  const [hoveredCoord, setHoveredCoord] = useState<{ x: number; y: number } | null>(null);

  const placedTiles = [...state.board.tiles.values()];
  const candidates = useMemo(() =>
    state.phase === 'PLACING_TILE' && state.pendingTile
      ? candidatePlacements(state.board)
      : [],
  [state.board, state.phase, state.pendingTile]);

  // Compute bounding box for grid sizing.
  const allCoords = [
    ...placedTiles.map(t => t.coord),
    ...candidates,
  ];
  if (allCoords.length === 0) return <div className="board-scroll" />;

  const minX = Math.min(...allCoords.map(c => c.x)) - 1;
  const maxX = Math.max(...allCoords.map(c => c.x)) + 1;
  const minY = Math.min(...allCoords.map(c => c.y)) - 1;
  const maxY = Math.max(...allCoords.map(c => c.y)) + 1;

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  function gridPos(x: number, y: number) {
    return { col: x - minX + 1, row: y - minY + 1 };
  }

  function handleCandidateClick(coord: { x: number; y: number }) {
    if (state.phase !== 'PLACING_TILE') return;
    controller.placeTile(coord);
  }

  const meepleTargets = state.phase === 'PLACING_MEEPLE'
    ? controller.getMeepleTargetsForLastTile()
    : [];

  function handleMeepleClick(tileId: string, localId: number) {
    controller.placeMeeple({ tileId, localId });
  }

  return (
    <div className="board-scroll">
      <div
        className="board-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`,
          width: cols * TILE_SIZE,
          height: rows * TILE_SIZE,
        }}
      >
        {placedTiles.map(tile => {
          const { col, row } = gridPos(tile.coord.x, tile.coord.y);
          const tileMeepleTargets = meepleTargets.filter(r => r.tileId === tile.tileId);
          return (
            <div
              key={tile.tileId}
              style={{
                gridColumn: col,
                gridRow: row,
                position: 'relative',
              }}
            >
              <TileView
                placed={tile}
                registry={state.board.registry}
                players={state.players}
                size={TILE_SIZE}
              />
              {tileMeepleTargets.map(ref => (
                <div
                  key={ref.localId}
                  onClick={() => handleMeepleClick(ref.tileId, ref.localId)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    cursor: 'pointer',
                    background: 'rgba(255,255,100,0.25)',
                    border: '2px solid gold',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#333',
                  }}
                  title="Place meeple here"
                >
                  🧑
                </div>
              ))}
            </div>
          );
        })}

        {state.phase === 'PLACING_TILE' && state.pendingTile && candidates.map(coord => {
          const { col, row } = gridPos(coord.x, coord.y);
          const preview = controller.previewPlacement(coord, state.pendingRotation);
          const isHovered = hoveredCoord?.x === coord.x && hoveredCoord?.y === coord.y;
          const imgSrc = isHovered ? (tileImageMap[state.pendingTile!.id] ?? '') : '';
          return (
            <div
              key={`${coord.x},${coord.y}`}
              style={{ gridColumn: col, gridRow: row }}
            >
              <GhostTile
                size={TILE_SIZE}
                legal={preview.legal}
                onClick={() => handleCandidateClick(coord)}
                onHover={() => setHoveredCoord(coord)}
                onLeave={() => setHoveredCoord(null)}
                imageSrc={imgSrc}
                rotation={state.pendingRotation}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 14.4: Commit**

```bash
git add src/ui/board/
git commit -m "feat(ui): BoardView + GhostTile placement preview"
```

---

## Task 15: HUD components

**Files:**
- Create: `src/ui/hud/PlayerPanel.tsx`
- Create: `src/ui/hud/TilePreview.tsx`
- Create: `src/ui/hud/Controls.tsx`
- Create: `src/ui/hud/EndGameScreen.tsx`

- [ ] **Step 15.1: Write `src/ui/hud/PlayerPanel.tsx`**

```tsx
import type { Player } from '../../core/types';

interface Props {
  players: Player[];
  currentPlayerIndex: number;
}

export function PlayerPanel({ players, currentPlayerIndex }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
      {players.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: i === currentPlayerIndex ? 'rgba(255,255,255,0.15)' : 'transparent',
            border: `2px solid ${i === currentPlayerIndex ? p.color : 'transparent'}`,
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: p.color, flexShrink: 0,
          }} />
          <span style={{ flex: 1, fontWeight: i === currentPlayerIndex ? 700 : 400, color: '#eee', fontSize: 14 }}>
            {p.name}
          </span>
          <span style={{ color: '#ffd700', fontWeight: 600, fontSize: 14 }}>{p.score}</span>
          <span style={{ color: '#aaa', fontSize: 12 }}>({p.meeplesAvailable})</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 15.2: Write `src/ui/hud/TilePreview.tsx`**

```tsx
import type { TilePrototype } from '../../core/types/tile';
import type { Rotation } from '../../core/types';
import type { GameController } from '../../controller/GameController';
import tileDistribution from '../../core/deck/tileDistribution.json';

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

interface Props {
  tile: TilePrototype | null;
  rotation: Rotation;
  controller: GameController;
  canDraw: boolean;
  deckSize: number;
}

export function TilePreview({ tile, rotation, controller, canDraw, deckSize }: Props) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ color: '#aaa', fontSize: 12 }}>Deck: {deckSize}</div>
      {tile ? (
        <>
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <img
              src={tileImageMap[tile.id] ?? ''}
              alt={tile.id}
              style={{ width: 80, height: 80, transform: `rotate(${rotation}deg)`, display: 'block' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => controller.rotatePending('CCW')} style={btnStyle}>↺</button>
            <button onClick={() => controller.rotatePending('CW')} style={btnStyle}>↻</button>
          </div>
        </>
      ) : (
        canDraw && (
          <button onClick={() => controller.drawTile()} style={{ ...btnStyle, padding: '8px 16px', fontSize: 13 }}>
            Draw Tile
          </button>
        )
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#444',
  color: '#eee',
  border: '1px solid #666',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 18,
};
```

- [ ] **Step 15.3: Write `src/ui/hud/Controls.tsx`**

```tsx
import type { GameController } from '../../controller/GameController';
import type { GamePhase } from '../../core/types';

interface Props {
  phase: GamePhase;
  currentPlayerName: string;
  controller: GameController;
}

export function Controls({ phase, currentPlayerName, controller }: Props) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center' }}>
        {phase === 'PLACING_TILE'   && `${currentPlayerName}'s turn — place tile`}
        {phase === 'PLACING_MEEPLE' && `${currentPlayerName} — place meeple or skip`}
      </div>
      {phase === 'PLACING_MEEPLE' && (
        <button
          onClick={() => controller.skipMeeple()}
          style={{
            background: '#555', color: '#eee',
            border: '1px solid #777', borderRadius: 4,
            padding: '6px 12px', cursor: 'pointer', fontSize: 13,
          }}
        >
          Skip Meeple
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 15.4: Write `src/ui/hud/EndGameScreen.tsx`**

```tsx
import type { Player } from '../../core/types';

interface Props {
  players: Player[];
  onRestart: () => void;
}

export function EndGameScreen({ players, onRestart }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#1a1a2e', borderRadius: 12,
        padding: '32px 48px', minWidth: 320,
        border: '2px solid #4a4a6a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <h2 style={{ color: '#ffd700', margin: 0 }}>Game Over</h2>
        <p style={{ color: '#ccc', margin: 0 }}>
          {winner.name} wins with {winner.score} points!
        </p>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: i === 0 ? '#ffd700' : '#ccc',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color }} />
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ fontWeight: 700 }}>{p.score}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onRestart}
          style={{
            marginTop: 8,
            background: '#4a4a8a', color: '#eee',
            border: 'none', borderRadius: 6,
            padding: '10px 24px', cursor: 'pointer', fontSize: 14,
          }}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 15.5: Commit**

```bash
git add src/ui/hud/
git commit -m "feat(ui): HUD — PlayerPanel, TilePreview, Controls, EndGameScreen"
```

---

## Task 16: Global CSS

**Files:**
- Create: `src/ui/styles/game.css`
- Modify: `src/index.css`

- [ ] **Step 16.1: Write `src/ui/styles/game.css`**

```css
.game-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #111;
  font-family: system-ui, sans-serif;
}

.game-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1a1a2e;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-section {
  border-bottom: 1px solid #333;
}
```

- [ ] **Step 16.2: Update `src/index.css` — replace with minimal reset**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #111; color: #eee; }
button { font-family: inherit; }
```

- [ ] **Step 16.3: Commit**

```bash
git add src/ui/styles/ src/index.css
git commit -m "feat(ui): global CSS layout"
```

---

## Task 17: Setup screen + App.tsx wiring

**Files:**
- Create: `src/ui/SetupScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 17.1: Write `src/ui/SetupScreen.tsx`**

```tsx
import { useState } from 'react';

interface Props {
  onStart: (names: string[]) => void;
}

export function SetupScreen({ onStart }: Props) {
  const [names, setNames] = useState(['', '']);

  function addPlayer() {
    if (names.length < 5) setNames([...names, '']);
  }

  function removePlayer(i: number) {
    if (names.length > 2) setNames(names.filter((_, idx) => idx !== i));
  }

  function update(i: number, v: string) {
    const next = [...names];
    next[i] = v;
    setNames(next);
  }

  function canStart() {
    return names.every(n => n.trim().length > 0);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#111',
    }}>
      <div style={{
        background: '#1a1a2e', borderRadius: 12,
        padding: '32px 40px', minWidth: 320,
        border: '2px solid #4a4a6a',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h1 style={{ color: '#ffd700', textAlign: 'center', fontSize: 24 }}>Carcassonne</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {names.map((name, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                value={name}
                onChange={e => update(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                style={{
                  flex: 1, background: '#252540', color: '#eee',
                  border: '1px solid #555', borderRadius: 4,
                  padding: '6px 10px', fontSize: 14,
                }}
              />
              {names.length > 2 && (
                <button
                  onClick={() => removePlayer(i)}
                  style={{ background: '#552', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '0 8px' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addPlayer}
          disabled={names.length >= 5}
          style={{
            background: '#333', color: '#aaa', border: '1px solid #555',
            borderRadius: 4, padding: '6px', cursor: 'pointer', fontSize: 13,
          }}
        >
          + Add Player
        </button>
        <button
          onClick={() => onStart(names.map(n => n.trim()))}
          disabled={!canStart()}
          style={{
            background: canStart() ? '#4a4a8a' : '#333',
            color: canStart() ? '#eee' : '#666',
            border: 'none', borderRadius: 6,
            padding: '10px', cursor: canStart() ? 'pointer' : 'not-allowed',
            fontSize: 15, fontWeight: 600,
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 17.2: Replace `src/App.tsx`**

```tsx
import { useState, useRef } from 'react';
import { ControllerContext } from './ui/hooks/useController';
import { useGameState } from './ui/hooks/useGameState';
import { createGameController } from './controller/GameController';
import { BoardView } from './ui/board/BoardView';
import { PlayerPanel } from './ui/hud/PlayerPanel';
import { TilePreview } from './ui/hud/TilePreview';
import { Controls } from './ui/hud/Controls';
import { EndGameScreen } from './ui/hud/EndGameScreen';
import { SetupScreen } from './ui/SetupScreen';
import type { GameController } from './controller/GameController';
import './ui/styles/game.css';

function GameApp({ controller }: { controller: GameController }) {
  const state = useGameState();
  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="game-layout">
      <div className="game-sidebar">
        <div className="sidebar-section">
          <PlayerPanel players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
        </div>
        <div className="sidebar-section">
          <TilePreview
            tile={state.pendingTile}
            rotation={state.pendingRotation}
            controller={controller}
            canDraw={state.phase === 'PLACING_TILE' && !state.pendingTile}
            deckSize={state.deck.remaining.length}
          />
        </div>
        <div className="sidebar-section">
          <Controls
            phase={state.phase}
            currentPlayerName={currentPlayer?.name ?? ''}
            controller={controller}
          />
        </div>
      </div>
      <BoardView state={state} controller={controller} />
      {state.phase === 'GAME_OVER' && (
        <EndGameScreen
          players={state.players}
          onRestart={() => window.location.reload()}
        />
      )}
    </div>
  );
}

export default function App() {
  const controllerRef = useRef<GameController | null>(null);
  const [started, setStarted] = useState(false);

  if (!controllerRef.current) {
    controllerRef.current = createGameController();
  }
  const controller = controllerRef.current;

  function handleStart(names: string[]) {
    controller.startGame(names);
    setStarted(true);
  }

  if (!started) {
    return <SetupScreen onStart={handleStart} />;
  }

  return (
    <ControllerContext.Provider value={controller}>
      <GameApp controller={controller} />
    </ControllerContext.Provider>
  );
}
```

- [ ] **Step 17.3: Update `src/main.tsx` — ensure it still works**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

(This file is already correct — verify it matches, no changes needed.)

- [ ] **Step 17.4: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 17.5: Run dev server and verify**

```bash
npm run dev
```

Open browser. Verify:
1. Setup screen renders with two player input fields
2. Enter two names, click Start Game
3. Board shows the start tile (TILE-D) at center
4. Click "Draw Tile" — a tile appears in the sidebar preview
5. Green/red ghost tiles appear on candidate cells
6. Click a green cell — tile is placed on board
7. Meeple placement overlay appears on the last tile
8. "Skip Meeple" advances to next player
9. Scoring shows in player panel

- [ ] **Step 17.6: Commit**

```bash
git add src/App.tsx src/ui/SetupScreen.tsx src/main.tsx
git commit -m "feat(ui): App wiring — setup screen, game layout, full turn flow"
```

---

## Task 18: Final integration check + run all tests

- [ ] **Step 18.1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 18.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 18.3: Manual end-to-end smoke test**

Run `npm run dev`, play through:
1. 2-player game setup
2. At least 10 tile placements
3. At least one meeple placement
4. Verify score increments when a road or city closes
5. Advance to game over (draw all tiles or verify end-game score screen)

- [ ] **Step 18.4: Final commit**

```bash
git add -A
git commit -m "feat: Carcassonne MVP — full playable base game"
```

---

## Self-Review Checklist

### Spec coverage

| Spec section | Implemented in task |
|---|---|
| §3.1 3-slot edge model | Tasks 3, 8 |
| §3.2 TilePrototype | Existing (types/tile.ts) |
| §3.3 SegmentBlueprint / connectivity | Existing (tile prototype files) |
| §3.4 Rotation | Task 3 |
| §3.5 PlacedTile | Task 4 |
| §3.6 Deck + drawPlaceable | Task 1 (updated), Task 10 |
| §4.2 Feature object | Task 5 |
| §4.3 Feature registry | Task 5 |
| §4.4 Merge algorithm | Task 8 |
| §4.5 Completion detection | Task 6 |
| §4.6 Meeple placement legality | Task 10 |
| §4.7 Field connectivity | Task 8 (via segment blueprints) |
| §5.1 Majority rule | Task 9 |
| §5.2 Mid-game scoring | Task 9, 10 |
| §5.3 End-game scoring | Task 9, 10 |
| §5.5 Farmer scoring | Task 9, 10 |
| §6.1 Game initialization | Task 10 |
| §6.2 Turn FSM | Task 10 |
| §6.3 Per-turn sequence | Task 10 |
| §6.4 Game-over conditions | Task 10 |
| §7.1 Controller interface | Task 11 |
| §7.2 State snapshot contract | Task 12 |
| §7.3 PubSub | Task 11 |
| UI layer | Tasks 13–17 |
