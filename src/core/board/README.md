# Board

Das Board ist der persistente Spielplan — eine unendliche 2D-Gitterkarte, auf der Kacheln platziert werden, zusammen mit dem Feature-Graph, der alle Städte, Straßen, Klöster und Felder über Kachelgrenzen hinweg verfolgt.

## Datenstruktur

```ts
interface Board {
  tiles:    Map<string, PlacedTile>;  // "x,y" → PlacedTile
  registry: FeatureRegistry;          // Feature-Graph aller Segmente
}
```

`tiles` ist eine flache Map. Der Key ist `coordKey(coord)` → `"0,0"`, `"1,0"`, usw. Es gibt keine feste Gittergröße — das Board wächst dynamisch.

`registry` enthält den vollständigen Feature-Graph (→ siehe `../feature/`).

## Koordinaten

```
x wächst nach rechts (Osten)
y wächst nach unten (Süden)
Startfeld: { x: 0, y: 0 }
```

## Wichtige Funktionen

### `createEmptyBoard()`
Erstellt ein leeres Board + leere Feature-Registry. Wird einmal in `startGame()` aufgerufen.

### `candidatePlacements(board)`
Gibt alle freien Felder zurück, die an mindestens eine bereits platzierte Kachel angrenzen (N/E/S/W). Diese Felder sind die einzigen legalen Ziele für `placeTile()`.

```
[ ][ ][ ]
[ ][X][ ]   X = platzierte Kachel
[ ][ ][ ]   alle umgebenden leeren Felder → candidatePlacements
```

### `countPlacedNeighbors(board, coord)`
Zählt alle 8 umliegenden Felder (inkl. Diagonale), die belegt sind. Wird ausschließlich für Klöster verwendet — ein Kloster ist abgeschlossen, wenn dieser Zähler 8 erreicht.

### `getNeighbor(board, coord, side)`
Hilfsfunktion: gibt die Kachel in Richtung `side` zurück oder `undefined`.

## Placement-Pipeline (`placement.ts`)

Das Platzieren einer Kachel läuft in 5 Schritten ab:

```
1. canPlace()          → Validierung (Zelle frei? Nachbar vorhanden? Kanten passen?)
2. makePlacedTile()    → Instanz mit TileId + SegmentInstances erstellen
3. Segment-Bootstrap   → für jedes Segment ein neues Feature anlegen
4. Kanten-Merge        → für jede angrenzende Kante: openEdges dekrementieren + unify()
5. detectCompletions() → alle berührten Features prüfen, ob openEdges == 0
```

### Kantenvalidierung

Jede Kante ist ein Triple `[L, C, R]` aus Terrain-Werten (`CITY | ROAD | FIELD`). Beim Anlegen muss jede der 3 Positionen mit der gespiegelten Position des Nachbarn übereinstimmen:

```
neue Kachel Seite N:  [L, C, R]
Nachbar Seite S:      [L, C, R]  → flipPos: L↔R, C bleibt C
Bedingung: newEdge[L] === neighborEdge[R]  (und C===C, R===L)
```

### Segment-Merge nach Platzierung

Wenn eine neue Kachel an eine bestehende angrenzt, werden die berührenden Segmente der beiden Kacheln zum selben Feature zusammengeführt (`unify()`). Pro Kante gibt es 3 Slot-Positionen (L/C/R), jede wird einzeln abgeglichen.

```
Neue Kachel     Nachbar
   N: [CITY, CITY, CITY]
         ↕     ↕    ↕
   S: [CITY, CITY, CITY]  → alle drei Slots → unify(stadtFeatureNeu, stadtFeatureNachbar)
```

## Feature-Completion

Nach jeder Platzierung prüft `detectCompletions()` alle berührten Features:
- Stadt/Straße: `openEdges === 0` → abgeschlossen
- Kloster: `monasterySurroundCount === 8` → abgeschlossen
- Feld: wird nie mid-game abgeschlossen
