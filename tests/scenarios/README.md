# YAML game-logic scenarios

Each `*.yaml` file in this directory is one deterministic browser scenario. Playwright drives the real 2D UI via DOM clicks; the dev-only `window.__carcTest` bridge (see `src/test-bridge/scenarioBridge.ts`) supplies a fixed deck and returns a JSON-safe state summary for assertions.

## Run

```bash
# Full suite
npm run test:scenarios

# Single scenario by name
npx playwright test -g "monastery-completion"

# Open HTML report (expect recap + board screenshot per scenario)
npx playwright show-report
```

Each test attaches a **`scenario-report`** HTML file (main artifact): scenario description, expect table with ✓/✗ per field, final-board screenshot, and placement steps folded in a `<details>` block. A plain-text **`expect-recap`** is also attached for copy/paste. The YAML `description` also appears as an annotation in the Playwright HTML report when you expand a test.

## Schema

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique test id (Playwright test title) |
| `description` | no | Human-readable summary |
| `players` | yes | 2–5 player names (hot-seat order) |
| `steps` | yes | One entry per turn, in deck order |
| `padding` | no | Extra deck tiles after the last step so the game stays mid-game |
| `endGame` | no | If `true`, runner calls `endGame()` before asserting |
| `expect` | yes | Final state to verify |

### Step fields

| Field | Required | Description |
|-------|----------|-------------|
| `tile` | yes | Tile dealt this turn (`TILE-A` … `TILE-X`); must match deck order |
| `at` | yes | Board coordinate `{ x, y }` (start tile is at `0,0`) |
| `rotation` | no | `0`, `90`, `180`, or `270` — applied via `rotate-cw-btn` clicks |
| `meeple` | no | `{ segment: <localId> }` on the just-placed tile |
| `skip` | no | Click `skip-meeple-btn` when targets are shown |

The deck dealt to the engine is `steps[].tile` followed by `padding`. The runner fails fast if the auto-drawn tile does not match `step.tile`.

### Expect fields

| Field | Description |
|-------|-------------|
| `scores` | Player name → final score |
| `meeplesAvailable` | Player name → meeples in hand (proves return on completion) |
| `completedFeatures` | Multiset of `{ kind, points?, tiles?, shieldCount? }` |
| `placedTiles` | Total tiles on the board including the start tile |

## Example

```yaml
name: monastery-completion
players: [Alice, Bob]
steps:
  - { tile: TILE-B, at: { x: 0, y: 1 }, rotation: 0, skip: true }
  - { tile: TILE-B, at: { x: 0, y: 2 }, rotation: 0, meeple: { segment: 0 } }
  # …
padding: [TILE-B]
expect:
  scores: { Bob: 9 }
  meeplesAvailable: { Bob: 7 }
  completedFeatures:
    - { kind: MONASTERY, points: 9 }
```

## Adding a scenario

1. Pick tile ids from `src/core/deck/tiles/` so adjacent edges match at the chosen rotations.
2. Add `padding: [TILE-B]` (or any legal filler) when asserting mid-game completion — an empty deck triggers end-game scoring in `_advanceTurn`.
3. Author the YAML here and run `npx playwright test -g "<name>"` until green.
4. On failure, the Playwright report includes a `final-board` screenshot and a diagnostic block with expected vs actual summary.
