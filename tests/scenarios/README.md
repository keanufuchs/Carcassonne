# YAML game-logic scenarios

Each `*.yaml` file in this directory is one deterministic browser scenario. Playwright drives the real 2D UI via DOM clicks; the dev-only `window.__carcTest` bridge (see `src/test-bridge/scenarioBridge.ts`) supplies a fixed deck and returns a JSON-safe state summary for assertions.

## Run

```bash
# Full suite
npm run test:scenarios

# Single scenario by name
npx playwright test -g "monastery-completion"

# Open HTML report (expect recap + full-game screenshot per scenario)
npx playwright show-report
```

After CI, open the workflow run:

1. **Summary** tab — scenario table with pass/fail and YAML descriptions
2. **Artifacts** (bottom of run page) — download **`playwright-report`**, open `index.html`

Each scenario includes `scenario-report` (HTML), `expect-recap` (text), and `final-game` (PNG) attachments.

Each test attaches a **`scenario-report`** HTML file (main artifact): scenario description, expect table with ✓/✗ per field, full-game screenshot, and placement steps folded in a `<details>` block. A plain-text **`expect-recap`** is also attached. End-game scenarios dismiss the Game Over overlay via **View Map** before the screenshot.

## Scenario catalogue

| YAML | Regel |
|------|--------|
| `monastery-completion` | Kloster erst nach 8 Nachbarn abgeschlossen |
| `city-shield-scoring` | Stadt geschlossen inkl. Schildbonus |
| `road-closed-endpoints` | Straße mit beiden Enden geschlossen |
| `edge-matching-legality` | Kanten passen nur regelkonform |
| `meeple-occupied-feature-rejects` | Kein zweiter Meeple auf besetztem Feature |
| `incomplete-features-endgame` | Unvollständige Straße + Kloster in Endwertung |
| `road-incomplete-endgame` | Offene Straße in Endwertung |
| `farmer-endgame-scoring` | Farmer nur bei Spielende |
| `deck-distribution` | Vollständige Basisspiel-Kachelverteilung |
| `full-game-playthrough` | Komplette Partie deterministisch bis Spielende (kein Regelbruch, kein Absturz, korrekte Endabrechnung) |

> **Mehrheitswertung (2:1):** Pro Feature ist nur ein Meeple vor dem Zusammenwachsen erlaubt; ein 2-gegen-1-Mehrheitsszenario braucht getrennte Feature-Fragmente. Das ist in `tests/core/scoring.test.ts` abgedeckt. `city-shield-scoring` zeigt den Einzelbesetzer-Fall (alle Punkte an einen Spieler).

## Schema

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique test id (Playwright test title) |
| `description` | no | Human-readable summary |
| `players` | yes | 2–5 player names (hot-seat order) |
| `steps` | yes* | One entry per turn, in deck order (*leer bei `deckFrom`) |
| `deckFrom` | no | `base-game` — kanonischer 71-Kachel-Nachziehstapel |
| `padding` | no | Extra deck tiles after the last step so the game stays mid-game |
| `autoPlay` | no | `{ seed }` — deterministischer Komplettdurchlauf bis `GAME_OVER` nach den `steps` (für Vollpartie-Tests; `steps` darf leer sein) |
| `endGame` | no | If `true`, runner calls `endGame()` before asserting |
| `expect` | yes | Final state to verify |

### Step fields

| Field | Required | Description |
|-------|----------|-------------|
| `tile` | yes | Tile dealt this turn (`TILE-A` … `TILE-X`); must match deck order |
| `at` | yes | Board coordinate `{ x, y }` (start tile is at `0,0`) |
| `rotation` | no | `0`, `90`, `180`, or `270` — applied via `rotate-cw-btn` clicks |
| `meeple` | no | `{ segment: <localId> }` on the just-placed tile |
| `skip` | no | Skip the meeple step |
| `placementChecks` | no | `{ at, rotation?, legal }[]` — legality probe before placing at `at` |
| `rejectMeeple` | no | Expect engine to reject `meeple` (requires `meeple.segment`) |

The deck dealt to the engine is `steps[].tile` followed by `padding`, unless `deckFrom: base-game` is set.

### Expect fields

| Field | Description |
|-------|-------------|
| `phase` | Expected game phase (z. B. `GAME_OVER` für Vollpartien) |
| `scores` | Player name → final score |
| `meeplesAvailable` | Player name → meeples in hand (proves return on completion) |
| `completedFeatures` | Multiset of `{ kind, points?, tiles?, shieldCount? }` |
| `placedTiles` | Total tiles on the board including the start tile |
| `deckRemaining` | Tiles left in the draw pile |
| `deckTotalTiles` | Draw pile + pending tile (distribution sanity) |
| `deckCounts` | Per-type counts in draw pile + pending tile |

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

### Vollpartie (Auto-Play)

```yaml
name: full-game-playthrough
players: [Alice, Bob]
deckFrom: base-game     # 71-Kachel-Stapel, ungemischt → deterministisch
steps: []               # alle Züge erzeugt der geseedete Auto-Play
autoPlay: { seed: 1 }   # gleicher Seed → exakt gleiche Partie
expect:
  phase: GAME_OVER
  placedTiles: 72
  deckRemaining: 0
  scores: { Alice: 25, Bob: 17 }
```

> Der Auto-Play routet jeden Zug durch die echte Engine; eine abgelehnte Aktion
> bricht den Lauf ab (Regelbruch/Absturz → Test rot). Endpunktstände sind bei
> festem Seed reproduzierbar — neue Werte einmalig per Testlauf ermitteln.

## Adding a scenario

1. Pick tile ids from `src/core/deck/tiles/` so adjacent edges match at the chosen rotations.
2. Add `padding: [TILE-B]` (or any legal filler) when asserting mid-game completion — an empty deck triggers end-game scoring in `_advanceTurn`.
3. Author the YAML here and run `npx playwright test -g "<name>"` until green.
4. On failure, the Playwright report includes a `final-game` screenshot and a diagnostic block with expected vs actual summary.
