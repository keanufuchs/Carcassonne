# 3. Tile System

This file defines the tile schema, the **3-slots-per-edge** model, **internal connectivity**, rotation, and the deck. The feature merging algorithm that consumes this is in [feature-system.md](./feature-system.md).

## 3.1 Edges and slots

Every tile edge is divided into **3 slots**, named by their position when looking *outward* from the tile center:

```
                      N
              ┌───L───C───R───┐
              │               │
            R │               │ L
            W C               C E
            L │               │ R
              │               │
              └───R───C───L───┘
                      S
```

Each slot is one of `Terrain = 'CITY' | 'ROAD' | 'FIELD'`.

**Slot naming convention (outward-relative):** `L`/`C`/`R` are read as if standing at the tile's center facing **outward** through the edge. From inside facing N, your left hand points west — so `N.L` is the western slot, `N.R` is the eastern slot. From inside facing W, your left hand points south — so `W.L` is the southern slot, `W.R` is the northern slot. (This is why the diagram looks asymmetric.)

| Side | Slot `L` (spatial) | Slot `C` | Slot `R` (spatial) |
|---|---|---|---|
| `N` | west | center | east |
| `E` | north | center | south |
| `S` | east | center | west |
| `W` | south | center | north |

**Edge-matching rule:** two tiles abut legally iff, on the shared edge, all three slot pairs have matching `Terrain`. **Important:** because the outward-relative convention is mirror-image across a shared edge, the slot pairs are:

> `A.side.L  ⇄  B.opposite(side).R`
> `A.side.C  ⇄  B.opposite(side).C`
> `A.side.R  ⇄  B.opposite(side).L`

A small helper, used in both validation and merging:

```ts
export function flipPos(p: SlotPos): SlotPos { return p === 'L' ? 'R' : p === 'R' ? 'L' : 'C'; }
```

> **Why three slots per edge?** A road typically occupies only the *center* slot of an edge while the outer slots are field. A city wall typically occupies all three. Some prototypes have a city occupying two slots while the third is field. The 3-slot model captures all base-game tiles correctly.

## 3.2 TilePrototype

A `TilePrototype` is a **frozen, declarative description** of a tile design. The 72 base-game prototypes live in `core/deck/baseGameTiles.ts`.

```ts
export interface TilePrototype {
  id: string;                                       // e.g. "ROAD-STRAIGHT", "CITY-3-SHIELD"
  edges: Record<EdgeSide, [Terrain, Terrain, Terrain]>;   // [L, C, R]
  segments: SegmentBlueprint[];                     // see 3.3
  hasMonastery: boolean;
  hasShield: boolean;                               // true ⇒ this tile's CITY segment carries a shield
}
```

Constraints (validated at module load):

1. `segments[i].localId === i` — local ids are dense indices.
2. The `segments` collectively partition all 12 edge slots whose terrain is **non-FIELD-or-FIELD** (every edge slot must belong to exactly one segment of the same `Terrain`).
3. If `hasMonastery`, exactly one segment has `kind: 'MONASTERY'` and `edgeSlots: []`.
4. If `hasShield`, exactly one segment has `kind: 'CITY'`.

## 3.3 SegmentBlueprint — internal connectivity

A **segment** is one *connected* terrain blob within a single tile. Two slot positions on the same tile belong to the same feature iff they're declared in the same segment.

```ts
export type SegmentKind = 'CITY' | 'ROAD' | 'FIELD' | 'MONASTERY';

export interface SegmentBlueprint {
  localId: SegmentLocalId;                 // 0, 1, 2, ...
  kind: SegmentKind;
  edgeSlots: EdgeSlot[];                   // which of the 12 slots this segment touches; [] for monastery
  isShielded?: true;                       // CITY-only; mirrors prototype.hasShield
}

export interface EdgeSlot {
  side: EdgeSide;
  pos: SlotPos;
}
```

### Example prototypes (canonical pre-rotation form)

**Straight road** (road through center, fields on each long side):

```ts
{
  id: 'ROAD-STRAIGHT',
  edges: {
    N: ['FIELD', 'ROAD', 'FIELD'],
    S: ['FIELD', 'ROAD', 'FIELD'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    W: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'ROAD',  edgeSlots: [{side:'N',pos:'C'},{side:'S',pos:'C'}] },
    { localId: 1, kind: 'FIELD', edgeSlots: [
        {side:'N',pos:'L'}, {side:'W',pos:'R'}, {side:'W',pos:'C'}, {side:'W',pos:'L'},
        {side:'S',pos:'R'},
    ]},
    { localId: 2, kind: 'FIELD', edgeSlots: [
        {side:'N',pos:'R'}, {side:'E',pos:'L'}, {side:'E',pos:'C'}, {side:'E',pos:'R'},
        {side:'S',pos:'L'},
    ]},
  ],
  hasMonastery: false,
  hasShield: false,
}
```

The `ROAD` segment connects `N-C` and `S-C` — meaning a road on the north neighbour and a road on the south neighbour become *the same road feature* via this tile.

The two field segments are **explicitly distinct**: walking east of the road is not the same field as walking west of it, even though both are on this tile. This is critical for farmer scoring.

**T-intersection** (3 road legs, all terminate at the central junction):

```ts
{
  id: 'ROAD-T',
  edges: {
    N: ['FIELD', 'ROAD',  'FIELD'],
    E: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
    S: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'ROAD',  edgeSlots: [{side:'N',pos:'C'}] },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{side:'E',pos:'C'}] },
    { localId: 2, kind: 'ROAD',  edgeSlots: [{side:'W',pos:'C'}] },
    { localId: 3, kind: 'FIELD', edgeSlots: [/* one connected field area covering S + corners */] },
  ],
  hasMonastery: false,
  hasShield: false,
}
```

Three separate `ROAD` segments — each road terminates at the junction, so they never become the same feature.

**Monastery + road (out of south)**:

```ts
{
  id: 'MONASTERY-ROAD',
  edges: {
    N: ['FIELD', 'FIELD', 'FIELD'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    W: ['FIELD', 'FIELD', 'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'MONASTERY', edgeSlots: [] },
    { localId: 1, kind: 'ROAD',      edgeSlots: [{side:'S',pos:'C'}] },
    { localId: 2, kind: 'FIELD',     edgeSlots: [/* the connected field area surrounding the monastery */] },
  ],
  hasMonastery: true,
  hasShield: false,
}
```

**Internal connectivity rule (summary):** *Two slots on the same tile that share a terrain are connected within the feature graph **iff** they appear in the same `segment.edgeSlots` list.* If two same-terrain slots appear in **different** segments on the same tile, they are explicitly disconnected on that tile.

## 3.4 Rotation

Rotation is a property of `PlacedTile`, not the prototype. Rotation maps `EdgeSide` and `SlotPos` to new positions.

```ts
// rotation.ts

const SIDES: EdgeSide[] = ['N', 'E', 'S', 'W'];

export function rotateSide(side: EdgeSide, r: Rotation): EdgeSide {
  const i = SIDES.indexOf(side);
  return SIDES[(i + r / 90) % 4];
}

export function rotateSlot(slot: EdgeSlot, r: Rotation): EdgeSlot {
  // 90° clockwise: the previous L-position now reads as L from the new outward direction,
  // because the orientation of "outward" rotates with the tile. Concretely:
  //   N-L -> E-L,  N-C -> E-C,  N-R -> E-R   (and so on)
  // Slot pos is preserved; only the side rotates.
  return { side: rotateSide(slot.side, r), pos: slot.pos };
}

export function rotatedEdges(p: TilePrototype, r: Rotation): TilePrototype['edges'] {
  const out = {} as TilePrototype['edges'];
  for (const side of SIDES) {
    out[rotateSide(side, r)] = p.edges[side];
  }
  return out;
}
```

> **Slot-pos preservation:** because we define `L/C/R` relative to the tile's *outward* direction, rotating the tile rotates the side label but does not flip the L↔R order. (If we ever switch to a coordinate-system-relative convention, this becomes an axis-flip; sticking with outward-relative keeps rotation logic O(1) and obvious.)

## 3.5 PlacedTile

```ts
export interface PlacedTile {
  tileId: TileId;
  prototypeId: string;                     // ref to TilePrototype
  coord: Coord;
  rotation: Rotation;
  segmentInstances: SegmentInstance[];     // same length and order as prototype.segments
}

export interface SegmentInstance {
  ref: SegmentRef;                         // { tileId, localId }
  kind: SegmentKind;
}
```

To resolve a segment's edge slots in board-space:

```ts
getEdgeSlotsRotated(placed, localId): EdgeSlot[] {
  const proto = lookup(placed.prototypeId);
  return proto.segments[localId].edgeSlots.map(s => rotateSlot(s, placed.rotation));
}
```

## 3.6 Tile deck

```ts
export interface Deck {
  startTile: TilePrototype;                // placed face-up at game start; not in remaining[]
  remaining: TilePrototype[];              // shuffled draw pile
}
```

### 3.6.1 Distribution

The base-game distribution lives in `core/deck/baseGameTiles.ts` as a literal array of `(prototype, count)` pairs, expanded into 72 instances + 1 designated start tile. Each prototype is included `count` times (clones share the same prototype reference but yield distinct `TileId`s when placed).

> The exact prototype list and counts are an implementation detail of the data file, not the spec. They follow the standard published base-game distribution and **must total 72 land tiles plus 1 start tile**.

### 3.6.2 Operations

```ts
// core/deck/Deck.ts
export function shuffle(deck: Deck, rng: () => number): void;       // in-place; Fisher-Yates
export function drawNext(deck: Deck): TilePrototype | null;         // pops from front; null if empty
export function hasRemaining(deck: Deck): boolean;
```

The `rng` parameter is injectable so tests can pass a seeded PRNG. Production uses `Math.random`.

### 3.6.3 Unplaceable-tile handling

When the current player draws a tile that has **no legal placement at any rotation on any empty cell adjacent to a placed tile**, the tile is **discarded** (removed from play; not returned) and the next tile is drawn. This repeats until either:

- a placeable tile is drawn → continue normally, OR
- the deck is empty → the game ends immediately ([game-flow.md §6.4](./game-flow.md)).

A "currently unplaceable" tile is determined freshly for each draw — a tile that was unplaceable earlier could have been placeable now, but we don't reshuffle; the discard is permanent.

```ts
// core/deck/Deck.ts (composition with board)
export function drawPlaceable(deck: Deck, board: Board): TilePrototype | null {
  while (hasRemaining(deck)) {
    const t = drawNext(deck)!;
    if (board.hasAnyLegalPlacement(t)) return t;
    // else: discard and loop
  }
  return null;   // deck exhausted ⇒ game ends
}
```

`Board.hasAnyLegalPlacement(prototype)` iterates empty cells adjacent to placed tiles, trying all 4 rotations. With a board ≤72 tiles this is trivial.
