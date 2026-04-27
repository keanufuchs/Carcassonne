# 6. Game Flow

Defines game initialization, turn FSM, the per-turn sequence, and end-of-game conditions.

## 6.1 Game initialization

```ts
// core/game/Game.ts

export function startGame(playerNames: string[], rng: () => number = Math.random): GameState {
  if (playerNames.length < 2 || playerNames.length > 5) {
    throw new Error('playerCount must be 2..5');
  }

  const players: Player[] = playerNames.map((name, i) => ({
    id: `P${i + 1}`,
    name,
    color: PLAYER_COLORS[i],                 // fixed palette of 5
    score: 0,
    meeplesAvailable: MEEPLES_PER_PLAYER,    // 7
  }));

  const deck = buildBaseGameDeck();
  shuffle(deck, rng);

  const state: GameState = {
    version: 1,
    board: createEmptyBoard(),
    deck,
    players,
    currentPlayerIndex: 0,
    phase: 'PLACING_TILE',
    pendingTile: null,                       // first turn calls drawTile() to populate
    pendingRotation: 0,
    lastPlacedTileId: null,
    lastCompletedFeatures: [],
  };

  // Place the start tile face-up at origin (0, 0) with rotation 0.
  // Uses the same internal placement path as a normal turn — but does not advance the FSM.
  placeTileInternal(state, deck.startTile, { x: 0, y: 0 }, 0);

  return state;
}
```

The start tile is placed by the system (not the first player). Per base-game rules it has a known prototype; the data file marks it as the designated start.

## 6.2 Turn finite-state machine

```
                          ┌──── startGame ────┐
                          ▼                    │
                    ┌──────────────┐           │
       ┌──────────  │ PLACING_TILE │ ◄─────────┘
       │ drawTile() └──────┬───────┘
       │                   │ placeTile(x,y) [ok]
       │                   ▼
       │            ┌──────────────────┐
       │            │ PLACING_MEEPLE   │
       │            └─────┬────────┬───┘
       │ placeMeeple()    │        │ skipMeeple()
       │  or skipMeeple() │        │
       │                  ▼        ▼
       │            ┌──────────────────┐
       │            │ (resolve scoring)│
       │            └─────┬────────────┘
       │                  │
       │ deck.hasRemaining │
       │ ◄────────────────┘
       │
       │ (else)
       ▼
┌────────────┐
│ GAME_OVER  │  ← apply end-game scoring on entry
└────────────┘
```

### 6.2.1 Phase invariants

| Phase | Required state |
|---|---|
| `NOT_STARTED` | `players.length === 0`, `board.tiles.size === 0` |
| `PLACING_TILE` | `pendingTile` may be `null` (call `drawTile`) or set (player must place) |
| `PLACING_MEEPLE` | `pendingTile === null`, last placed tile recorded for §4.6.1 rule (2) |
| `GAME_OVER` | end-game scoring applied; no further commands accepted |

Implementation detail: store `lastPlacedTileId: TileId | null` on `GameState` so the meeple-legality check (rule 4.6.1.2) doesn't have to scan the board.

## 6.3 Full per-turn sequence

```
1. drawTile()
   ├─ if deck empty before draw: transition to GAME_OVER (see §6.4)
   ├─ pop next prototype
   ├─ if no legal placement anywhere with any rotation:
   │     - discard
   │     - if deck now empty: transition to GAME_OVER
   │     - else: pop next, repeat
   └─ pendingTile = drawn prototype, pendingRotation = 0

2. rotatePending(direction)        — UI loop, may be called any number of times
   └─ pendingRotation = (pendingRotation ± 90) mod 360

3. placeTile(x, y)
   ├─ validate: canPlace(pendingTile, {x,y}, pendingRotation)
   │     └─ if invalid: return Result.error; remain in PLACING_TILE
   ├─ run placeTileInternal (§4.4)
   ├─ lastPlacedTileId = newly placed tile id
   ├─ pendingTile = null; pendingRotation = 0
   └─ phase = PLACING_MEEPLE

4. (optional) placeMeeple(segmentRef)
   ├─ validate per §4.6.1
   │     └─ if invalid: return Result.error; remain in PLACING_MEEPLE
   └─ apply per §4.6.2

5. skipMeeple()                     — only legal action if step 4 was skipped or is unavailable
   └─ no-op on state, signals end of meeple phase

6. resolveScoring()                 — internal, called automatically after step 4 or 5
   ├─ for each f in lastCompletedFeatures:
   │     ├─ score mid-game (§5.2)
   │     ├─ award points to winners
   │     └─ return their meeples (§5.2.1)
   └─ lastCompletedFeatures = []   (cleared after consumption by UI)

7. advanceTurn()                    — internal
   ├─ if !deck.hasRemaining: transition to GAME_OVER (apply end-game scoring per §5.6)
   ├─ else:
   │     ├─ currentPlayerIndex = (currentPlayerIndex + 1) mod players.length
   │     ├─ phase = PLACING_TILE
   │     └─ pendingTile = null  (next turn begins with another drawTile() command)
```

Steps 6 and 7 are **automatic** — they do not require a UI command. The only commands the UI ever issues per turn are: `drawTile`, `rotatePending`, `placeTile`, then exactly one of `placeMeeple` or `skipMeeple`. The controller ensures step 6 + 7 fire after the meeple decision and the resulting `GameState` snapshot reflects the next player's turn (or game-over).

### 6.3.1 Why explicit `drawTile` instead of auto-drawing on phase entry?

So the UI can present "your turn — click to draw" affordances and animate the draw. Logically equivalent to auto-draw; UX-clearer.

## 6.4 Game-over conditions

Exactly two conditions transition to `GAME_OVER`:

1. **Deck exhausted at the natural end of a turn.** After `resolveScoring` completes, if `deck.hasRemaining === false`, end the game.
2. **All remaining tiles unplaceable.** During step 1 (`drawTile`), if every remaining tile has no legal placement with any rotation, the game ends immediately.

> Note: it is technically possible (rare) for condition 2 to fire mid-turn, before any tile is placed that turn. Behavior is identical: the current player's turn ends with no placement, and end-game scoring runs.

On entering `GAME_OVER`, end-game scoring runs once ([scoring.md §5.6](./scoring.md)) and `phase` becomes terminal.

## 6.5 Determinism & RNG

The only source of randomness is the deck shuffle. `startGame` accepts an `rng` parameter (default `Math.random`). Tests pass a seeded PRNG so deck order is reproducible. No other randomness anywhere in core.

## 6.6 Error handling philosophy

Core functions never throw for *user-input errors* (illegal placement, illegal meeple). They return `Result<Ok, ErrorCode>`:

```ts
export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: ErrorCode; message: string };

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
```

Core *does* throw for **programmer errors** (impossible states reached): registry inconsistency, segment not found, etc. Tests assert these throw on injected corrupt state.
