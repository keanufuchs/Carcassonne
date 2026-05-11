# Game

Das `game`-Modul ist der zentrale Spielsteuerungs-Layer. Es orchestriert alle anderen Core-Module (Board, Deck, Feature, Scoring) und definiert den vollständigen Ablauf eines Carcassonne-Zuges.

## GameState (`GameState.ts`)

Der einzige Zustandscontainer des Spiels. Er wird in `startGame()` erstellt und danach **direkt mutiert** (kein Immutability-Pattern).

```ts
interface GameState {
  version:               number;               // inkrementiert bei jeder Änderung (für React useMemo)
  board:                 Board;                // Spielplan + Feature-Registry
  deck:                  Deck;                 // verbleibende Kacheln
  players:               Player[];             // Score + Meeples pro Spieler
  currentPlayerIndex:    number;               // Index in players[]
  phase:                 GamePhase;            // aktueller Spielzustand
  pendingTile:           TilePrototype | null; // gezogene, noch nicht platzierte Kachel
  pendingRotation:       Rotation;             // aktuelle Rotation der pendingTile
  lastPlacedTileId:      TileId | null;        // zuletzt gelegte Kachel (für Meeple-Phase)
  lastCompletedFeatures: FeatureId[];          // in diesem Zug abgeschlossene Features
}
```

`version` ist entscheidend für die UI: React-Hooks vergleichen `state.version`, um unnötige Re-Renders zu vermeiden, da das State-Objekt selbst seine Referenz nicht wechselt.

## Spielphasen

```
NOT_STARTED → PLACING_TILE → PLACING_MEEPLE → PLACING_TILE → ...
                                                          ↓
                                                      GAME_OVER
```

| Phase | Bedeutung |
|---|---|
| `NOT_STARTED` | Vor `startGame()` |
| `PLACING_TILE` | Spieler zieht und legt eine Kachel |
| `PLACING_MEEPLE` | Spieler setzt optional einen Meeple |
| `GAME_OVER` | Endwertung abgeschlossen |

## Spielzug-API (`Game.ts`)

Alle Funktionen akzeptieren `GameState` und geben `Result<T>` zurück (niemals `throw`).

### `startGame(playerNames, rng?)`

Initialisiert den Zustand:
1. Players mit je 7 Meeples anlegen
2. Deck aus 72 Kacheln aufbauen und mischen
3. Startfeld bei `{0,0}` platzieren (wird nicht gezogen)
4. Phase → `PLACING_TILE`, `currentPlayerIndex = 0`

### `drawTile(state)`

Zieht die nächste platzierbare Kachel:
- Überspringt unplatzierbare Kacheln (via `hasAnyLegalPlacement`)
- Legt Kachel in `state.pendingTile` ab
- Kein Deck mehr → `_applyEndGame()`

### `rotatePending(state, 'CW' | 'CCW')`

Dreht `state.pendingTile` um 90° in die angegebene Richtung. Nur in Phase `PLACING_TILE` möglich.

### `placeTile(state, coord)`

Platziert die pending-Kachel:
1. `canPlace()` validiert Zelle + Kanten
2. `placeTileInternal()` platziert, merged Features, erkennt Abschlüsse
3. Phase → `PLACING_MEEPLE`
4. Keine gültigen Meeple-Ziele → `_resolveScoring()` + `_advanceTurn()` sofort

### `getMeepleTargets(state)`

Gibt alle legalen Segmente der zuletzt gelegten Kachel zurück, auf die ein Meeple gesetzt werden darf:
- Feature muss leer sein (`meeples.length === 0`)
- Feature darf nicht abgeschlossen sein (`!completed`)
- Spieler muss noch Meeples haben

### `placeMeeple(state, ref)`

Setzt Meeple auf das angegebene Segment:
- Validiert: richtiger Spieler, richtiges Tile, Feature frei
- `feature.meeples.push(...)`, `player.meeplesAvailable -= 1`
- Dann `_resolveScoring()` + `_advanceTurn()`

### `skipMeeple(state)`

Überspringt die Meeple-Phase → `_resolveScoring()` + `_advanceTurn()`.

## Interne Hilfsfunktionen

### `_resolveScoring(state)`

Verarbeitet alle in diesem Zug abgeschlossenen Features:
1. `scoreCompletedMidGame(feature)` → Punkte berechnen
2. Punkte den Gewinnern gutschreiben
3. Alle Meeples des Features zurückgeben (`player.meeplesAvailable += 1`)
4. `feature.meeples = []`

### `_advanceTurn(state)`

- Deck leer → `_applyEndGame()`
- Sonst: `currentPlayerIndex = (currentPlayerIndex + 1) % players.length`
- Phase → `PLACING_TILE`

### `_applyEndGame(state)`

Endwertung in zwei Schritten:
1. Alle unvollständigen Features (außer Felder) mit halben Punkten werten (`scoreIncompleteEndGame`)
2. Bauern werten (`scoreFarmers`): 3 Punkte pro angrenzendem abgeschlossenem Stadt-Feature pro Mehrheitsbauer
3. Phase → `GAME_OVER`
