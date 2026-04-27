# 4. Feature System

The feature system is the **core complexity** of the project. This file specifies segment identity, the feature object, the merge algorithm, completion detection, and meeple placement legality.

## 4.1 Concepts

- **Segment** — a connected blob of one terrain type within a single tile. Defined declaratively by `SegmentBlueprint` ([tile-system.md §3.3](./tile-system.md)).
- **Segment instance** — a segment of a *placed* tile, identified by `SegmentRef = { tileId, localId }`.
- **Feature** — the union of all segment instances that are connected across the placed tiles, treated as a single game-rule entity (a city, road, monastery, or field). A feature's identity is `FeatureId`.

Every placed segment belongs to **exactly one** feature.

## 4.2 Feature object

```ts
// core/feature/Feature.ts

export type FeatureKind = 'CITY' | 'ROAD' | 'MONASTERY' | 'FIELD';

export interface Feature {
  id: FeatureId;
  kind: FeatureKind;

  segments: Set<string>;                   // segmentKey(SegmentRef) — every segment in this feature
  openEdges: number;                        // count of unmatched outward edge-slot connections
  meeples: MeeplePlacement[];               // placed by players; ≥0
  shieldCount: number;                      // CITY only; 0 otherwise
  completed: boolean;                       // true once openEdges === 0 (or monastery is fully surrounded)

  // Monastery-only:
  monasteryTileId?: TileId;
  monasterySurroundCount?: number;          // 0..8 — how many of the 8 neighbors have been placed

  // Field-only, populated at end-game:
  closedCitiesAdjacent?: Set<FeatureId>;
}

export interface MeeplePlacement {
  playerId: PlayerId;
  segmentRef: SegmentRef;                   // the segment the meeple sits on (frozen at placement time)
}
```

### 4.2.1 `openEdges` semantics

`openEdges` counts the number of **outward edge-slot connections that are not yet abutted to a placed tile** across all segments of this feature.

- Each `SegmentBlueprint.edgeSlots` entry represents one outward connection point.
- When placed in isolation, a segment contributes `edgeSlots.length` to `openEdges`.
- When the tile on the other side of one of those slots is placed, that connection point is consumed (subtracts 1 from `openEdges`).
- A feature with `openEdges === 0` is **closed**: no edge-slot can ever recruit a new neighbor.

For monasteries, `openEdges` is unused (always 0); completion is governed by `monasterySurroundCount === 8`.

### 4.2.2 Why segment-level edge-slot counting works

A segment is a connected blob — internal connectivity within a tile is encoded in its `edgeSlots` list. Once two segments are unified into one feature, the combined feature's `openEdges` is the sum of each contributor's open-slot count, minus any newly closed slots from the placement that triggered the merge. The merge algorithm (§4.4) maintains this invariant.

## 4.3 Feature registry

```ts
// core/feature/segments.ts

export interface FeatureRegistry {
  features: Map<FeatureId, Feature>;
  segmentToFeature: Map<string, FeatureId>;   // segmentKey -> owning feature
  nextId: number;                              // monotonic
}

export function createFeature(reg: FeatureRegistry, kind: FeatureKind): Feature;
export function lookupBySegment(reg: FeatureRegistry, ref: SegmentRef): Feature;
export function attachSegment(reg: FeatureRegistry, feature: Feature, ref: SegmentRef): void;
export function retireFeature(reg: FeatureRegistry, id: FeatureId): void;     // post-merge
```

## 4.4 Merge algorithm

This is the central algorithm. It runs once per `placeTile` call.

### 4.4.1 Preconditions

- `placement.canPlace(prototype, coord, rotation)` already returned `true`.
- The new tile has not yet been added to the board.

### 4.4.2 Steps

```ts
function placeTileInternal(state, prototype, coord, rotation): PlacementResult {
  // 1. Construct the PlacedTile and its segment instances.
  const placed = makePlacedTile(prototype, coord, rotation);

  // 2. For each new segment, create a fresh Feature with openEdges = edgeSlots.length.
  for (const seg of prototype.segments) {
    const feature = createFeature(state.board.registry, mapSegKindToFeatureKind(seg.kind));
    if (seg.kind !== 'MONASTERY') {
      feature.openEdges = seg.edgeSlots.length;
    }
    if (seg.kind === 'CITY' && prototype.hasShield && seg.isShielded) {
      feature.shieldCount = 1;
    }
    if (seg.kind === 'MONASTERY') {
      feature.monasteryTileId = placed.tileId;
      feature.monasterySurroundCount = countPlacedNeighborsOf(state.board, coord);   // diagonal too
    }
    attachSegment(state.board.registry, feature, { tileId: placed.tileId, localId: seg.localId });
  }

  // 3. Insert the tile into the board.
  state.board.tiles.set(coordKey(coord), placed);

  // 4. For each of the 4 sides where a placed neighbor exists, walk the 3 slots:
  for (const side of SIDES) {
    const neighborCoord = stepCoord(coord, side);
    const neighbor = state.board.tiles.get(coordKey(neighborCoord));
    if (!neighbor) continue;

    const oppositeSide = opposite(side);
    for (const pos of (['L', 'C', 'R'] as SlotPos[])) {
      // The outward-relative convention mirrors L↔R across a shared edge — see tile-system §3.1.
      // So this tile's (side, pos) aligns spatially with neighbor's (opposite(side), flipPos(pos)).
      const newSeg      = findSegmentByEdgeSlot(placed,   { side: side,         pos });
      const neighborSeg = findSegmentByEdgeSlot(neighbor, { side: oppositeSide, pos: flipPos(pos) });

      const newFeature      = lookupBySegment(state.board.registry, newSeg.ref);
      const neighborFeature = lookupBySegment(state.board.registry, neighborSeg.ref);

      // (a) Each side of this slot pair was previously open. Both close now.
      newFeature.openEdges      -= 1;
      neighborFeature.openEdges -= 1;

      // (b) If they're not already the same feature, unify.
      if (newFeature.id !== neighborFeature.id) {
        unify(state.board.registry, newFeature, neighborFeature);
      }
    }
  }

  // 5. Update monastery surround counts for any monastery within the 8 neighbors of `coord`.
  for (const neighborCoord of allEightNeighbors(coord)) {
    const t = state.board.tiles.get(coordKey(neighborCoord));
    if (!t) continue;
    for (const seg of t.segmentInstances) {
      if (seg.kind === 'MONASTERY') {
        const f = lookupBySegment(state.board.registry, seg.ref);
        f.monasterySurroundCount! += 1;
      }
    }
  }
  // The newly-placed tile may itself be a monastery; its surroundCount was set in step 2.

  // 6. Detect completed features (see §4.5).
  const completed = detectCompletions(state.board.registry, /* features touched in steps 4–5 */);

  return { placed, completedFeatures: completed };
}
```

### 4.4.3 `unify(reg, A, B)` — union step

```ts
function unify(reg: FeatureRegistry, a: Feature, b: Feature): Feature {
  // Deterministic survivor: the smaller-id feature wins (stable across runs).
  const [winner, loser] = a.id < b.id ? [a, b] : [b, a];

  // Move all segments from loser to winner.
  for (const segKey of loser.segments) {
    winner.segments.add(segKey);
    reg.segmentToFeature.set(segKey, winner.id);
  }

  // Combine numeric/aggregate fields.
  winner.openEdges    += loser.openEdges;
  winner.shieldCount  += loser.shieldCount;
  winner.meeples       = [...winner.meeples, ...loser.meeples];

  retireFeature(reg, loser.id);
  return winner;
}
```

Notes:

- **Deterministic survivor** (smaller id wins) so test snapshots are stable.
- **Meeples concatenate.** Two features each carrying meeples, when merged, produce a feature with all those meeples on it. This is precisely how Carcassonne's "majority" rule produces interesting strategy.
- **No subtraction in unify** — the slot-closure subtractions happen in step 4(a) of `placeTileInternal`, before unify. Unify is a pure union of state.

### 4.4.4 Self-merge case

If two slot pairs along the same shared edge happen to point at the *same* segment on each side (e.g., a single CITY segment spanning all 3 slots of an edge meets a neighbor's single CITY segment spanning all 3 slots), step 4(a) will subtract 1 from each feature's `openEdges` *three times* (once per slot pair), and step 4(b) will be a no-op on the second and third iteration because the features are already unified. The math still works out: the city's `openEdges` is reduced by 3 on the new side and 3 on the old side, exactly the slots that closed.

A **single tile** can also cause a self-loop: imagine a tile whose two opposite edges are both ROAD-ROAD that the prototype declares as **the same** segment (a straight road). When we walk the slots on placement, we don't yet have neighbors on those edges (they're new), so step 4 doesn't fire on this tile's own segments. Self-loop handling is automatic.

## 4.5 Completion detection

```ts
function detectCompletions(reg: FeatureRegistry, touched: Iterable<FeatureId>): Feature[] {
  const out: Feature[] = [];
  for (const id of touched) {
    const f = reg.features.get(id);
    if (!f || f.completed) continue;

    if (f.kind === 'MONASTERY') {
      if (f.monasterySurroundCount === 8) { f.completed = true; out.push(f); }
    } else {
      if (f.openEdges === 0) { f.completed = true; out.push(f); }
    }
  }
  return out;
}
```

Multiple features can complete in a single placement (e.g., placing a tile that closes a city *and* completes the 8th neighbor of an adjacent monastery).

## 4.6 Meeple placement

### 4.6.1 Legality

A meeple may be placed on a `SegmentRef` iff **all** of these hold:

1. The phase is `PLACING_MEEPLE` for the current player.
2. `segmentRef.tileId` equals the tile just placed this turn (you may only place a meeple on the tile you just placed).
3. The owning feature has `meeples.length === 0` (no meeple — yours or anyone else's — currently on the feature).
4. The owning feature is not already `completed` (placing on a feature that's about to be scored would be pointless and is disallowed by rule).
5. `currentPlayer.meeplesAvailable > 0`.

> The "no existing meeple" rule (3) is what makes feature merging strategically interesting: by placing a tile that merges two of your opponent's features into one, you may *break* their lone occupancy by adding a city of your own that connects in.

### 4.6.2 Effect

```ts
function placeMeeple(state, ref: SegmentRef): void {
  const feature = lookupBySegment(state.board.registry, ref);
  feature.meeples.push({ playerId: state.players[state.currentPlayerIndex].id, segmentRef: ref });
  state.players[state.currentPlayerIndex].meeplesAvailable -= 1;
}
```

### 4.6.3 Roles by terrain

The meeple's *role* is implicit in the feature's `kind`:

| Feature kind | Role |
|---|---|
| `CITY` | knight |
| `ROAD` | thief / robber |
| `MONASTERY` | monk |
| `FIELD` | farmer |

The role affects only when (and how) the meeple scores; the placement legality rules above are uniform.

## 4.7 Field connectivity (cross-tile + critical detail)

Fields participate in the same merge algorithm as the other terrains, with one nuance: a field is bordered by roads and city walls *within a tile*. The `SegmentBlueprint.edgeSlots` lists for `FIELD` segments are pre-computed in the prototype to reflect this — the prototype author has already split fields by intra-tile road/city barriers. The runtime does **not** need to reason about road/wall geometry.

Concretely: a tile with a horizontal road has **two** field segments — one for the north half and one for the south half. They share **no** edge slots and are never merged on this tile. They may, of course, be merged separately with neighbors' fields.

For end-game farmer scoring, see [scoring.md §5.5](./scoring.md).

## 4.8 Invariants (assertable in tests)

| # | Invariant |
|---|---|
| I1 | Every placed segment is in `segmentToFeature` exactly once. |
| I2 | Every `Feature.segments` entry resolves to exactly one placed segment instance. |
| I3 | `feature.openEdges >= 0`. |
| I4 | A feature with `openEdges === 0` and `kind !== MONASTERY` has `completed === true` after the placement that closed it. |
| I5 | A monastery feature has exactly one segment of kind MONASTERY. |
| I6 | `feature.shieldCount` equals the number of shield-bearing CITY tiles whose CITY segments are in this feature. |
| I7 | After unify, the loser's `FeatureId` is absent from `features` and `segmentToFeature`. |
| I8 | `meeplesAvailable` for a player + (count of their meeples on uncompleted features) + (count of their meeples on completed-this-game features that have already returned) ≤ 7. |
