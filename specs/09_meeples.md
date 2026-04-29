# 9. Meeple System

Meeple placement, legality, state transitions, return mechanics, and UI behavior.

## 9.1 State model

Each player holds `meeplesAvailable: number` (starts at `MEEPLES_PER_PLAYER = 7`).

Meeples live on the **feature**, not the tile:

```ts
// core/feature/Feature.ts
interface MeeplePlacement {
  playerId: PlayerId;
  segmentRef: SegmentRef;   // tileId + localId that was clicked
}

interface Feature {
  meeples: MeeplePlacement[];   // 0 or 1 in a legal game state
  ...
}
```

`GameState` does **not** carry a top-level meeple list — query `board.registry.features`.

## 9.2 Legality (all must hold)

| # | Rule |
|---|------|
| 1 | `state.phase === 'PLACING_MEEPLE'` |
| 2 | `ref.tileId === state.lastPlacedTileId` |
| 3 | `feature.meeples.length === 0` (no meeple on that feature from any player) |
| 4 | `!feature.completed` |
| 5 | `player.meeplesAvailable > 0` |

Error codes on violation: `WRONG_PHASE`, `MEEPLE_NOT_ON_PLACED_TILE`, `MEEPLE_FEATURE_OCCUPIED`, `MEEPLE_FEATURE_COMPLETED`, `NO_MEEPLES_AVAILABLE`.

## 9.3 Turn flow

```
placeTile(coord)
  └─ phase = 'PLACING_MEEPLE'

getMeepleTargets() → SegmentRef[]      ← UI calls this to render targets

player action (exactly one):
  ├─ placeMeeple(ref)
  │     feature.meeples.push({ playerId, segmentRef: ref })
  │     player.meeplesAvailable -= 1
  └─ skipMeeple()   → no meeple state change

_resolveScoring()   ← auto, internal
_advanceTurn()      ← auto, internal
  └─ phase = 'PLACING_TILE'  (or 'GAME_OVER' if deck empty)
```

## 9.4 Meeple return

Triggered inside `_resolveScoring()` for every completed feature:

```
for each f in lastCompletedFeatures:
  { winners, points } = scoreCompletedMidGame(f)
  award points to winners
  for each m in f.meeples:
    player(m.playerId).meeplesAvailable += 1
  f.meeples = []
lastCompletedFeatures = []
```

End-game: meeples are **not** returned (game terminates).

## 9.5 UI behavior

### During `PLACING_MEEPLE`

- `getMeepleTargetsForLastTile()` returns valid `SegmentRef[]`.
- Each ref renders as a **26×26 px circle** on the last-placed tile, positioned with `meepleTargetPos(i, total)` (radial spread around tile center; single target stays at center-top).
- Circle color = `currentPlayer.color` at `cc` opacity, gold border, gold glow.
- Clicking calls `controller.placeMeeple(ref)`.
- "Skip Meeple" button always visible during this phase.
- After placement or skip, targets disappear (phase leaves `PLACING_MEEPLE`).

### Rendered meeples (placed)

`TileView` reads `feature.meeples` via `board.registry` and renders placed meeples as 14×14 px circles spread horizontally at tile center.

## 9.6 Test IDs

| Element | `data-testid` |
|---------|---------------|
| Each valid meeple segment target | `meeple-target` |
| Skip meeple button | `skip-meeple-btn` |

## 9.7 State transition diagram

```mermaid
stateDiagram-v2
  [*] --> PLACING_TILE : startGame()
  PLACING_TILE --> PLACING_MEEPLE : placeTile() ok
  PLACING_MEEPLE --> PLACING_TILE : placeMeeple() or skipMeeple() + deck remaining
  PLACING_MEEPLE --> GAME_OVER : placeMeeple() or skipMeeple() + deck empty
  PLACING_TILE --> GAME_OVER : drawTile() + no placeable tiles
```

## 9.8 Testable requirements

1. `placeMeeple` on an unoccupied, incomplete feature succeeds and decrements `meeplesAvailable`.
2. `placeMeeple` on an occupied feature returns `MEEPLE_FEATURE_OCCUPIED`.
3. `placeMeeple` on a completed feature returns `MEEPLE_FEATURE_COMPLETED`.
4. `skipMeeple` advances the turn without changing any meeple state.
5. Meeple is returned when the feature completes (mid-game scoring).
6. `getMeepleTargets` returns only segments on the last placed tile.
7. `getMeepleTargets` excludes segments on features that already have a meeple.
8. UI renders one `[data-testid="meeple-target"]` per valid segment during `PLACING_MEEPLE`.
9. Clicking a target advances phase to `PLACING_TILE` (turn ends).
