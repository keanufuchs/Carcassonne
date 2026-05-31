# Deck

Das Deck verwaltet den Vorrat an Kacheln, die im Spielverlauf gezogen werden. Es besteht aus einem festen Starttile (das immer bei `{0,0}` liegt) und 72 zufällig gemischten Spielkacheln (A–X nach offiziellem Carcassonne-Standard).

## Datenstruktur

```ts
interface Deck {
  startTile: TilePrototype;    // Die Startkachel — wird nicht gezogen
  remaining:  TilePrototype[]; // Stapel der noch verfügbaren Kacheln
}
```

`remaining` ist ein Array, das wie ein Stapel behandelt wird: `shift()` zieht von vorne.

## Kachelverteilung (`baseGameTiles.ts`)

Das offizielle Grundspiel enthält 72 Ziehkacheln (ohne Startkachel):

| Kachel | Anzahl | Kachel | Anzahl |
|--------|--------|--------|--------|
| A      | 2      | M      | 2      |
| B      | 4      | N      | 3      |
| C      | 1      | O      | 2      |
| D      | 4      | P      | 3      |
| E      | 5      | Q      | 1      |
| F      | 2      | R      | 3      |
| G      | 1      | S      | 2      |
| H      | 3      | T      | 1      |
| I      | 2      | U      | 8      |
| J      | 3      | V      | 9      |
| K      | 3      | W      | 4      |
| L      | 3      | X      | 1      |

## Wichtige Funktionen

### `shuffle(deck, rng)`
Fisher-Yates-Mischung von `deck.remaining`. Akzeptiert eine `rng`-Funktion (Standard: `Math.random`), damit Tests mit deterministischem RNG arbeiten können.

### `drawPlaceable(deck, isPlaceable)`
Zieht so lange Kacheln vom Stapel, bis eine gefunden wird, die auf dem aktuellen Board irgendwo legal platziert werden kann (`hasAnyLegalPlacement`). Nicht platzierbare Kacheln werden dabei dauerhaft aus dem Stapel entfernt (entspricht der Spielregel).

Gibt `null` zurück, wenn der Stapel leer ist → löst `_applyEndGame()` aus.

### `drawNext(deck)`
Zieht die oberste Kachel ohne Validierung. Intern von `drawPlaceable` verwendet.

### `hasRemaining(deck)`
Gibt `true` zurück, solange noch Kacheln vorhanden sind.

## Ablauf beim Spielzug

```
drawTile() in Game.ts
  └─ drawPlaceable(deck, t => hasAnyLegalPlacement(board, t))
       ├─ platzierbare Kachel gefunden → state.pendingTile = tile
       └─ Stapel leer oder keine Kachel platzierbar → _applyEndGame()
```

## Kachel-Prototypen

Jede Kachel im Deck ist ein `TilePrototype` — eine unveränderliche Beschreibung des Layouts (Kanten, Segmente). Mehrere Exemplare derselben Kachel teilen sich denselben Prototyp-Objekt-Zeiger.

Beim Platzieren wird aus dem Prototyp eine `PlacedTile`-Instanz erzeugt, die eine eindeutige `TileId` erhält (→ siehe `../tile/`).
