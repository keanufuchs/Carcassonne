# 5. Scoring

All scoring functions are **pure**: they take a feature (and, for farmers, the full feature registry) and return point assignments per player. They do not mutate state. The `Game` aggregate consumes their output and applies the score deltas + meeple returns.

## 5.1 Majority rule (uniform — applies to ALL scored features)

```ts
// core/scoring/majority.ts

/**
 * Determine which players "control" a feature for scoring purposes.
 *
 * Rule (base game): the player(s) with the most meeples on the feature score.
 *   - If exactly one player has the most: that player scores.
 *   - If multiple players tie for the most: ALL TIED PLAYERS SCORE FULL POINTS.
 *     (No splitting, no rounding.)
 *   - If no player has any meeples: nobody scores.
 *
 * This rule is identical for mid-game scoring and end-game scoring.
 */
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

Every winning player gets the **full** point value of the feature.

## 5.2 Mid-game scoring

Triggered immediately after `placeTileInternal` reports completed features. A completed feature scores once and only once.

```ts
// core/scoring/midGame.ts

export function scoreCompletedMidGame(f: Feature): { winners: PlayerId[]; points: number } {
  const winners = majorityWinners(f);
  const points = pointsForCompletedFeature(f);
  return { winners, points };
}

function pointsForCompletedFeature(f: Feature): number {
  switch (f.kind) {
    case 'CITY':
      return 2 * (tileCount(f) + f.shieldCount);     // 2 per tile + 2 per shield
    case 'ROAD':
      return tileCount(f);                            // 1 per tile
    case 'MONASTERY':
      return 9;                                       // monastery tile + 8 neighbors
    case 'FIELD':
      throw new Error('fields do not complete; only end-game scoring');
  }
}

function tileCount(f: Feature): number {
  // Count distinct tileIds among feature.segments.
  const tiles = new Set<TileId>();
  for (const segKey of f.segments) {
    const ref = parseSegmentKey(segKey);
    tiles.add(ref.tileId);
  }
  return tiles.size;
}
```

### 5.2.1 Meeple return on mid-game completion

After awarding points, **all meeples on the completed feature are returned to their owners**:

```ts
function returnMeeples(state: GameState, f: Feature): void {
  for (const m of f.meeples) {
    const player = state.players.find(p => p.id === m.playerId)!;
    player.meeplesAvailable += 1;
  }
  f.meeples = [];
}
```

(The feature object is kept in the registry — its segments still occupy the board — but its meeple list is now empty. It is also `completed`, so it cannot receive new meeples.)

## 5.3 End-game scoring (incomplete features)

Triggered when the deck is exhausted **and** the current placement has been resolved (any meeple step finished). Iterates every feature with `completed === false`.

```ts
// core/scoring/endGame.ts

export function scoreIncompleteEndGame(f: Feature): { winners: PlayerId[]; points: number } {
  const winners = majorityWinners(f);
  let points: number;
  switch (f.kind) {
    case 'CITY':
      points = tileCount(f) + f.shieldCount;          // 1 per tile + 1 per shield
      break;
    case 'ROAD':
      points = tileCount(f);                           // 1 per tile
      break;
    case 'MONASTERY':
      // 1 for the monastery tile + 1 per surrounding tile placed
      points = 1 + (f.monasterySurroundCount ?? 0);
      break;
    case 'FIELD':
      // handled separately in farmers.ts
      points = 0;
      break;
  }
  return { winners, points };
}
```

End-game meeples are **not** returned to supply; they remain on the board for record-keeping.

## 5.4 Comparison: mid-game vs end-game point values

| Feature kind | Mid-game (completed) | End-game (incomplete) |
|---|---|---|
| City | 2 × (tiles + shields) | 1 × (tiles + shields) |
| Road | 1 × tiles | 1 × tiles |
| Monastery | 9 | 1 + surroundCount |
| Field | (does not complete) | see §5.5 |

## 5.5 Farmer (field) scoring — end-game only

Farmers never complete and never score mid-game. At end-game:

```ts
// core/scoring/farmers.ts

/**
 * For each FIELD feature with at least one meeple:
 *   majority winner(s) score 3 points per *completed* CITY adjacent to that field.
 */
export function scoreFarmers(reg: FeatureRegistry):
    Array<{ winners: PlayerId[]; points: number; fieldId: FeatureId }> {
  const out = [];
  for (const f of reg.features.values()) {
    if (f.kind !== 'FIELD') continue;
    if (f.meeples.length === 0) continue;

    const adjacentCompletedCities = computeAdjacentCompletedCities(reg, f);
    const winners = majorityWinners(f);
    out.push({
      winners,
      points: adjacentCompletedCities.size * 3,
      fieldId: f.id,
    });
  }
  return out;
}
```

### 5.5.1 Computing adjacency between a field and a city

A FIELD segment is **adjacent** to a CITY feature iff some tile of that field touches some tile of that city *across an in-tile barrier* (city wall) — i.e., the field segment and the city segment **coexist on the same tile**.

```ts
function computeAdjacentCompletedCities(reg: FeatureRegistry, field: Feature): Set<FeatureId> {
  const adjacent = new Set<FeatureId>();
  const fieldTiles = new Set<TileId>();
  for (const segKey of field.segments) {
    fieldTiles.add(parseSegmentKey(segKey).tileId);
  }

  // For each tile that hosts a piece of this field, look at all CITY segments on the same tile.
  for (const tileId of fieldTiles) {
    const placed = lookupTileById(/* board */, tileId);
    for (const inst of placed.segmentInstances) {
      if (inst.kind !== 'CITY') continue;
      const cityFeature = lookupBySegment(reg, inst.ref);
      if (cityFeature.completed) {
        adjacent.add(cityFeature.id);
      }
    }
  }
  return adjacent;
}
```

> **Why "same tile"?** The base-game farmer rule: a farmer scores for each completed city that *touches* (shares a wall with) the field. Walls only exist within a tile (tile edges between two tiles match terrain, so they're never walls). Therefore "adjacent" = "co-occurs on at least one tile."

### 5.5.2 Worked example

- Field F covers tiles {T1, T3, T5}.
- T1 has CITY segment in feature C-α (completed).
- T3 has CITY segment in feature C-β (completed).
- T5 has no CITY segment.
- Field F has 2 meeples: P1 and P1 (same player, two farmers placed earlier and merged on field).

Result: P1 wins majority, scores `2 × 3 = 6 points` (2 completed cities × 3).

If a third farmer P2 had also been merged into F (so P1 has 2, P2 has 1), P1 still wins; P2 scores 0.

If F had P1: 2, P2: 2 → both score full 6.

## 5.6 End-game scoring orchestration

```ts
// core/scoring/endGame.ts (orchestrator)

export function applyEndGameScoring(state: GameState): EndGameSummary {
  const summary: EndGameSummary = { perPlayer: new Map(), perFeature: [] };

  // 5.6.1 Incomplete cities, roads, monasteries
  for (const f of state.board.registry.features.values()) {
    if (f.completed) continue;
    if (f.kind === 'FIELD') continue;
    const { winners, points } = scoreIncompleteEndGame(f);
    award(state, summary, f.id, winners, points);
  }

  // 5.6.2 Farmers
  for (const r of scoreFarmers(state.board.registry)) {
    award(state, summary, r.fieldId, r.winners, r.points);
  }

  state.phase = 'GAME_OVER';
  return summary;
}
```

`award(state, summary, featureId, winners, points)` adds `points` to each winner's `score` and records the line item for the UI's end-game screen.

## 5.7 Edge cases (explicit)

| Case | Resolution |
|---|---|
| Feature with no meeples completes mid-game | Score is computed but no player receives points; nothing returns to supply. |
| Same player has multiple meeples on one feature | Counts as that many "votes" for majority. Only the player gets points (still full points, just once). |
| Two players tie on a city with a shield | Both get full `2 × (tiles + shields)`. |
| Monastery completes on the same turn the closing tile completes a road | Both score; both meeples return; `lastCompletedFeatures` lists both. |
| Field with meeples but adjacent cities are all incomplete | 0 points awarded. |
| Field with meeples but no adjacent cities at all | 0 points awarded. |
| Player exhausts meeple supply | They cannot place a meeple this turn; tile placement still required. |
