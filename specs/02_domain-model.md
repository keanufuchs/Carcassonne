# 2. Domain Model

## 2.1 Entity overview

```
GameState
 ├─ Board
 │   ├─ Map<Coord, PlacedTile>           (placed tiles, keyed by "x,y")
 │   └─ FeatureRegistry
 │       ├─ Map<FeatureId, Feature>      (live feature objects)
 │       └─ Map<SegmentRef, FeatureId>   (segment → feature index)
 ├─ Deck
 │   ├─ TilePrototype[]                  (remaining, draw order)
 │   └─ TilePrototype                    (designated start tile, drawn first)
 ├─ Player[]                             (2–5 in turn order)
 ├─ currentPlayerIndex
 ├─ phase                                (turn FSM state)
 ├─ pendingTile                          (drawn but not placed)
 ├─ pendingRotation
 ├─ lastCompletedFeatures: FeatureId[]   (resolved this turn — for UI hints)
 └─ version                              (bumped on every mutation)
```

## 2.2 Primitive types

```ts
// core/types.ts

export type Terrain = 'CITY' | 'ROAD' | 'FIELD';
export type EdgeSide = 'N' | 'E' | 'S' | 'W';
export type SlotPos  = 'L' | 'C' | 'R';        // looking outward from tile center
export type Rotation = 0 | 90 | 180 | 270;

export type Coord = { x: number; y: number };
export const coordKey = (c: Coord) => `${c.x},${c.y}`;

export type PlayerId  = string;                  // e.g. "P1"
export type FeatureId = string;                  // opaque, monotonically generated
export type TileId    = string;                  // identifies a PLACED tile (uuid)
export type SegmentLocalId = number;             // unique within a tile prototype

// A SegmentRef globally identifies one segment instance on the board.
export type SegmentRef = {
  tileId: TileId;
  localId: SegmentLocalId;
};
export const segmentKey = (s: SegmentRef) => `${s.tileId}#${s.localId}`;
```

## 2.3 Player

```ts
export const MEEPLES_PER_PLAYER = 7;   // base game, all player counts

export interface Player {
  id: PlayerId;
  name: string;
  color: string;                       // for UI; assigned at game start
  score: number;
  meeplesAvailable: number;            // 0..7
}
```

Meeple supply is decremented on placement, returned (incremented) when the feature completes mid-game. End-game scoring does **not** return meeples — they remain on the board for record-keeping but no further use.

## 2.4 Composite GameState

```ts
export type GamePhase =
  | 'NOT_STARTED'
  | 'PLACING_TILE'        // current player must place pendingTile
  | 'PLACING_MEEPLE'      // tile placed; player may place a meeple or skip
  | 'GAME_OVER';

export interface GameState {
  version: number;                          // strictly increasing
  board: Board;
  deck: Deck;
  players: Player[];                         // length 2..5
  currentPlayerIndex: number;                // index into players
  phase: GamePhase;
  pendingTile: TilePrototype | null;         // drawn, not yet placed
  pendingRotation: Rotation;                 // current rotation of pendingTile
  lastPlacedTileId: TileId | null;           // set in PLACING_MEEPLE; gates meeple legality (§4.6.1.2)
  lastCompletedFeatures: FeatureId[];        // populated after each placeTile/turn end
}
```

`GameState` is **plain data** — no methods, no class instances. All transitions live in `core/game/Game.ts` as pure-ish functions that mutate the singleton instance and bump `version`.

## 2.5 Relationships at a glance

| Relationship | Cardinality | Notes |
|---|---|---|
| GameState → Board | 1 : 1 | composition |
| Board → PlacedTile | 1 : N | keyed by coord |
| PlacedTile → Segment instances | 1 : N | derived from prototype + rotation |
| Segment → Feature | N : 1 | every placed segment belongs to exactly one Feature |
| Feature → Segment | 1 : N | a feature aggregates segments across tiles |
| Feature → Meeple placement | 1 : N | ≥0; placement legality governed by feature-system |
| Player → Meeple placement | 1 : N | one player may have meeples on multiple features |
| GameState → Player | 1 : 2..5 | fixed at game start |
| Deck → TilePrototype | 1 : N | ordered (post-shuffle); `drawNext()` pops |

## 2.6 Identity strategies

- **TileId**: a UUID (or monotonic counter) generated when a tile is placed. Two placed instances of the same prototype must have distinct `TileId`s.
- **FeatureId**: a monotonic counter scoped to the registry: `F1, F2, ...`. Stable across merges (the surviving feature keeps its id; the absorbed feature's id is retired).
- **SegmentLocalId**: assigned in the `TilePrototype` definition (e.g., `0..k-1`) and is invariant under rotation.
- **SegmentRef = (TileId, SegmentLocalId)** uniquely identifies any segment instance on the board.

## 2.7 Immutability / mutation policy

- **TilePrototypes** are deeply frozen at module load.
- **Player records** are mutated in place (score, meeplesAvailable).
- **GameState** is mutated in place; `version` is incremented after every committed change. The controller's snapshot is the same object — UI **must not** mutate it (enforced only by convention; React renders a new tree on `version` change).
- We chose mutation (not immutable replacement) because the project explicitly forgoes undo/save and explicitly prioritizes simplicity.

## 2.8 What a placed tile looks like at runtime

```ts
// after placing a "T-intersection road" prototype at (3, -1) with rotation 90°
{
  tileId: "T-7e2c",
  prototypeId: "ROAD-T-INTERSECTION",
  coord: { x: 3, y: -1 },
  rotation: 90,
  segmentInstances: [
    { ref: { tileId: "T-7e2c", localId: 0 }, kind: "ROAD" },
    { ref: { tileId: "T-7e2c", localId: 1 }, kind: "ROAD" },
    { ref: { tileId: "T-7e2c", localId: 2 }, kind: "ROAD" },
    { ref: { tileId: "T-7e2c", localId: 3 }, kind: "FIELD" },
    { ref: { tileId: "T-7e2c", localId: 4 }, kind: "FIELD" },
  ],
}
```

Each `localId` resolves back to the prototype's `SegmentBlueprint` to determine which edge slots and connectivity it has. See [tile-system.md](./tile-system.md).
