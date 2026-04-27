# 8. Testing

## 8.1 Strategy

- **All core logic gets unit tests.** This is non-negotiable; it's where almost all bugs hide.
- **Controller gets integration tests** that exercise full turn flows through the public API.
- **UI gets smoke tests only.** A React Testing Library test that renders `App` with a fresh game and confirms the start tile shows up. No heavy DOM coverage.
- **No E2E tests in MVP.** Adding Playwright/Spectron is deferred until the UI stabilizes.

Test runner: **Vitest**. Mirror `src/core/` under `tests/core/`.

## 8.2 Coverage targets

| Module | Target |
|---|---|
| `core/tile`, `core/feature`, `core/board`, `core/scoring` | ≥ 95% lines, ≥ 90% branches |
| `core/game`, `core/deck` | ≥ 90% lines |
| `controller/` | ≥ 80% lines via integration tests |
| `ui/` | smoke test only |

These are guidelines, not gates — meaningful tests beat coverage chasing.

## 8.3 Test categories with example cases

### 8.3.1 Tile rotation

```ts
test('rotating a side 4× returns to itself', () => {
  expect(rotateSide('N', 0)).toBe('N');
  expect(rotateSide(rotateSide(rotateSide(rotateSide('N', 90), 90), 90), 90)).toBe('N');
});

test('rotating an edge slot 90° preserves slot pos', () => {
  expect(rotateSlot({ side: 'N', pos: 'L' }, 90)).toEqual({ side: 'E', pos: 'L' });
  expect(rotateSlot({ side: 'N', pos: 'C' }, 180)).toEqual({ side: 'S', pos: 'C' });
});

test('TilePrototype invariants hold for every base-game prototype', () => {
  for (const proto of BASE_GAME_PROTOTYPES) {
    expect(proto.segments.every((s, i) => s.localId === i)).toBe(true);
    expectEdgeSlotsPartitionNonMonasterySlots(proto);
  }
});
```

### 8.3.2 Placement validation

```ts
test('canPlace requires at least one placed neighbor', () => {
  const board = boardWithStartTileAt({ x: 0, y: 0 });
  expect(canPlace(board, ROAD_STRAIGHT, { x: 5, y: 5 }, 0).legal).toBe(false);
});

test('canPlace rejects edge mismatch', () => {
  // Start tile has CITY on south; place a tile with FIELD on north below it.
  const board = boardWithStartTileAt({ x: 0, y: 0 });
  expect(canPlace(board, ROAD_STRAIGHT, { x: 0, y: 1 }, 0).legal).toBe(false);
});

test('canPlace accepts a matching abutment', () => {
  const board = boardWithStartTileAt({ x: 0, y: 0 });
  expect(canPlace(board, MATCHING_TILE, { x: 1, y: 0 }, 0).legal).toBe(true);
});

test('rotation can turn an invalid placement into a valid one', () => {
  const board = boardWithStartTileAt({ x: 0, y: 0 });
  expect(canPlace(board, ROAD_STRAIGHT, { x: 1, y: 0 }, 0).legal).toBe(false);
  expect(canPlace(board, ROAD_STRAIGHT, { x: 1, y: 0 }, 90).legal).toBe(true);
});
```

### 8.3.3 Feature merge

```ts
test('two adjacent road tiles merge into one road feature', () => {
  const state = freshGame();
  place(state, ROAD_STRAIGHT, { x: 1, y: 0 }, 0);
  place(state, ROAD_STRAIGHT, { x: 2, y: 0 }, 0);
  const refA = segmentRefOf(state, { x: 1, y: 0 }, /* road segment */ 0);
  const refB = segmentRefOf(state, { x: 2, y: 0 }, 0);
  expect(state.board.registry.lookupBySegment(refA).id)
    .toBe(state.board.registry.lookupBySegment(refB).id);
});

test('road feature openEdges drops by 2 per closed slot pair', () => {
  const state = freshGame();
  place(state, ROAD_STRAIGHT, { x: 1, y: 0 }, 0);     // road segment has 2 open edges
  expect(roadFeatureOpenEdges(state, { x: 1, y: 0 })).toBe(2);
  place(state, ROAD_END_AT_CITY, { x: 2, y: 0 }, 0);  // closes east end
  expect(roadFeatureOpenEdges(state, { x: 1, y: 0 })).toBe(1);
});

test('city merge accumulates shieldCount', () => {
  // Place two CITY-WITH-SHIELD tiles that share a city edge.
  const state = freshGame();
  place(state, CITY_WITH_SHIELD, { x: 1, y: 0 }, 0);
  place(state, CITY_WITH_SHIELD, { x: 2, y: 0 }, 0);
  expect(cityFeatureAt(state, { x: 1, y: 0 }).shieldCount).toBe(2);
});

test('unify is deterministic — smaller-id feature wins', () => {
  const state = freshGame();
  // ... arrange two features, capture ids, place a tile that merges them
  const beforeIds = [featureA.id, featureB.id].sort();
  // ... trigger merge
  expect(survivingFeature.id).toBe(beforeIds[0]);
});
```

### 8.3.4 Completion detection

```ts
test('placing the closing tile of a city completes that city', () => {
  const state = openCityNeedingOneTile();
  const result = place(state, CLOSING_CITY_TILE, /* coord */, /* rotation */);
  expect(result.completedFeatures.map(f => f.kind)).toContain('CITY');
});

test('monastery completes when 8 surrounding tiles are placed', () => {
  const state = freshGame();
  place(state, MONASTERY, { x: 0, y: 1 }, 0);
  for (const c of allEightNeighborsOf({ x: 0, y: 1 })) {
    place(state, ANY_LEGAL, c, /* rotation */);
  }
  const monasteryFeature = featureAt(state, { x: 0, y: 1 }, /* monastery localId */);
  expect(monasteryFeature.completed).toBe(true);
});

test('a single placement can complete multiple features at once', () => {
  // Hand-construct a board where one tile closes both a city and the 8th monastery neighbor.
  const result = place(state, MAGIC_TILE, /* coord */, 0);
  expect(result.completedFeatures.length).toBeGreaterThanOrEqual(2);
});
```

### 8.3.5 Meeple placement legality

```ts
test('cannot place a meeple on a feature that already has any meeple', () => {
  // After merging two features each with a meeple, the merged feature now has two.
  // Player 3 places a tile that connects to it; cannot then place their meeple on it.
  const r = controller.placeMeeple(targetSegmentRef);
  expect(r.ok).toBe(false);
  expect((r as any).error).toBe('MEEPLE_FEATURE_OCCUPIED');
});

test('meeple may only be placed on the tile just placed', () => {
  // Try to place on a segment of an older tile.
  const r = controller.placeMeeple(refOnPreviousTile);
  expect((r as any).error).toBe('MEEPLE_NOT_ON_PLACED_TILE');
});

test('cannot place when supply is 0', () => {
  exhaustMeeples(controller, 'P1');
  const r = controller.placeMeeple(legalTarget);
  expect((r as any).error).toBe('NO_MEEPLES_AVAILABLE');
});
```

### 8.3.6 Mid-game scoring

```ts
test('completed road scores 1 point per tile', () => {
  // 3-tile road, P1 has 1 meeple on it.
  const before = playerScore(state, 'P1');
  closeTheRoad(state);
  expect(playerScore(state, 'P1') - before).toBe(3);
});

test('completed 4-tile city with 2 shields scores 12', () => {
  // 4 tiles + 2 shields = 6, ×2 = 12.
  closeTheCity(state, /* with shields */);
  expect(playerScore(state, 'P1') - before).toBe(12);
});

test('majority tie awards full points to all tied players', () => {
  // P1 and P2 each have 1 meeple on the same completed road of 4 tiles.
  closeTheRoad(state);
  expect(playerScore(state, 'P1') - p1Before).toBe(4);
  expect(playerScore(state, 'P2') - p2Before).toBe(4);
});

test('meeples return on completion', () => {
  expect(player(state, 'P1').meeplesAvailable).toBe(6);
  closeTheRoadOwnedBy('P1');
  expect(player(state, 'P1').meeplesAvailable).toBe(7);
});
```

### 8.3.7 End-game scoring

```ts
test('incomplete city scores 1 per tile + 1 per shield', () => {
  // Force end-game with a 3-tile city carrying 1 shield owned by P1.
  forceEndGame(state);
  expect(playerScore(state, 'P1') - before).toBe(4);
});

test('incomplete monastery scores 1 + surroundCount', () => {
  // Monastery with 5 of 8 neighbors placed.
  forceEndGame(state);
  expect(playerScore(state, monkOwner) - before).toBe(6);
});
```

### 8.3.8 Farmer scoring

```ts
test('farmer scores 3 per completed adjacent city', () => {
  // Field touches 2 completed cities; P1 has sole farmer.
  forceEndGame(state);
  expect(playerScore(state, 'P1') - before).toBe(6);
});

test('farmer ignores incomplete cities', () => {
  // Field touches 1 completed city + 1 incomplete city.
  forceEndGame(state);
  expect(playerScore(state, 'P1') - before).toBe(3);
});

test('farmer ties award both players full points', () => {
  // Field with P1: 1 farmer, P2: 1 farmer; 2 completed adjacent cities.
  forceEndGame(state);
  expect(playerScore(state, 'P1') - p1Before).toBe(6);
  expect(playerScore(state, 'P2') - p2Before).toBe(6);
});

test('field with no meeples scores nothing', () => {
  // Pre-populate a field with no farmers, surround with 3 completed cities.
  forceEndGame(state);
  // No score line item generated for this field.
});
```

### 8.3.9 Deck & unplaceable handling

```ts
test('drawPlaceable discards an unplaceable tile and returns the next one', () => {
  const deck = deckWith([UNPLACEABLE_GIVEN_BOARD, PLACEABLE]);
  const t = drawPlaceable(deck, board);
  expect(t).toBe(PLACEABLE);
  expect(deck.remaining).toEqual([]);
});

test('drawPlaceable returns null when all remaining tiles are unplaceable', () => {
  const deck = deckWith([UNPLACEABLE_1, UNPLACEABLE_2]);
  expect(drawPlaceable(deck, board)).toBeNull();
});
```

### 8.3.10 Game-end conditions

```ts
test('game ends when deck exhausts at end of turn', () => {
  exhaustDeck(controller);
  endLastTurnNormally(controller);
  expect(controller.getState().phase).toBe('GAME_OVER');
});

test('game ends immediately if all remaining tiles are unplaceable', () => {
  rigBoardSoNothingFits(controller);
  controller.drawTile();
  expect(controller.getState().phase).toBe('GAME_OVER');
});
```

### 8.3.11 Controller integration

```ts
test('full 2-player turn cycle through the public API', () => {
  controller.startGame(['Alice', 'Bob']);
  controller.drawTile();
  controller.rotatePending('CW');
  expect(controller.placeTile({ x: 1, y: 0 }).ok).toBe(true);
  expect(controller.skipMeeple().ok).toBe(true);
  expect(controller.getState().currentPlayerIndex).toBe(1);
});

test('subscribers receive exactly one notification per successful command', () => {
  const calls = [];
  controller.subscribe(s => calls.push(s.version));
  controller.drawTile();
  expect(calls.length).toBe(1);
  controller.rotatePending('CW');
  expect(calls.length).toBe(2);
});
```

### 8.3.12 UI smoke

```ts
test('App renders the start tile', () => {
  render(<App />);
  fireEvent.click(screen.getByText(/Start 2-player game/));
  expect(screen.getByTestId('placed-tile-0,0')).toBeInTheDocument();
});
```

## 8.4 Test fixtures & helpers

A small set of helpers in `tests/helpers/`:

- `freshGame(playerNames?: string[])` — returns a started `GameState` with a seeded RNG.
- `place(state, prototype, coord, rotation)` — wraps `placeTileInternal` and asserts success.
- `tileAt(state, coord)`, `featureAt(state, coord, localId)` — lookup helpers.
- `prototypes.ts` — minimal hand-crafted prototypes used in tests (decoupled from the full base-game distribution so tests stay readable).
- `forceEndGame(state)` — drains the deck and triggers end-game scoring.

Tests should prefer these helpers over re-implementing setup, both for readability and so that schema changes ripple through one place.

## 8.5 Continuous integration (post-MVP)

Out of scope for this spec. Local `npm test` and `npm run lint` are sufficient until the UI ships.
