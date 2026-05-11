# Types

Das `types`-Modul definiert alle gemeinsam genutzten Primitive, Identifiers und Hilfstypen. Es hat keine Abhängigkeiten zu anderen Core-Modulen — alle anderen Module importieren von hier, nicht umgekehrt.

## Übersicht der Dateien

```
types.ts       ← Koordinaten, IDs, Player, GamePhase, Result<T>
types/tile.ts  ← Kachel-spezifische Typen (Terrain, Kanten, Segmente)
```

## Kachel-Typen (`types/tile.ts`)

```ts
type Terrain     = 'CITY' | 'ROAD' | 'FIELD'
type EdgeSide    = 'N' | 'E' | 'S' | 'W'
type SlotPos     = 'L' | 'C' | 'R'         // Position auf einer Kante (Links/Mitte/Rechts)
type Rotation    = 0 | 90 | 180 | 270
type SegmentKind = 'CITY' | 'ROAD' | 'FIELD' | 'MONASTERY'
```

### EdgeSlot

```ts
interface EdgeSlot { side: EdgeSide; pos: SlotPos }
```

Ein einzelner Kontaktpunkt einer Kachel zur Außenwelt. Jede Seite hat 3 Slots (L/C/R), also 12 Slots pro Kachel. Segmente deklarieren, welche Slots sie belegen.

### SegmentBlueprint

```ts
interface SegmentBlueprint {
  localId:     number;
  kind:        SegmentKind;
  edgeSlots:   EdgeSlot[];
  isShielded?: true;       // nur CITY-Segmente mit Wappen
}
```

Die statische Beschreibung eines Segments innerhalb eines `TilePrototype`.

### TilePrototype

```ts
interface TilePrototype {
  id:           string;
  edges:        Record<EdgeSide, [Terrain, Terrain, Terrain]>;
  segments:     SegmentBlueprint[];
  hasMonastery: boolean;
  hasShield:    boolean;
}
```

`edges` ist das schnelle Lookup für Kanten-Validierung. `segments` ist die vollständige Segmentbeschreibung für den Feature-Aufbau.

## Gemeinsame Primitive (`types.ts`)

### ID-Typen

```ts
type PlayerId  = string   // "P1", "P2", ...
type FeatureId = string   // "F1", "F2", ...
type TileId    = string   // "T1", "T2", ...
```

Alle IDs sind opake Strings. Die Präfixe (P/F/T) sind Konvention, kein enforced Format.

### Coord und SegmentRef

```ts
type Coord      = { x: number; y: number }
type SegmentRef = { tileId: TileId; localId: number }
```

`Coord` adressiert eine Position auf dem Board. `SegmentRef` adressiert ein konkretes Segment auf einer platzierten Kachel — die universelle Adresse im Feature-Graph.

Hilfsfunktionen für Map-Keys:
```ts
coordKey(c)     → "x,y"    // für board.tiles
segmentKey(ref) → "T3#1"   // für registry.segmentToFeature
```

### Result\<T\>

```ts
type Result<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ErrorCode; message: string }
```

Alle öffentlichen Game-Funktionen geben `Result` zurück statt zu werfen. Fehler werden explizit behandelt.

```ts
const ok     = <T>(value: T): Result<T> => ...
const okVoid = (): Result<void>          => ...
const err    = (error, message): Result<never> => ...
```

### ErrorCode

```ts
type ErrorCode =
  | 'CELL_OCCUPIED'             // Zelle belegt
  | 'EDGE_MISMATCH'             // Kanten passen nicht
  | 'NOT_ADJACENT'              // kein Nachbar
  | 'WRONG_PHASE'               // Aktion in falscher Spielphase
  | 'NO_PENDING_TILE'           // kein gezogenes Tile vorhanden
  | 'MEEPLE_FEATURE_OCCUPIED'   // Feature hat bereits Meeple
  | 'MEEPLE_NOT_ON_PLACED_TILE' // Meeple nicht auf der gerade gelegten Kachel
  | 'MEEPLE_FEATURE_COMPLETED'  // Feature bereits abgeschlossen
  | 'NO_MEEPLES_AVAILABLE'      // Spieler hat keine Meeples mehr
  | 'GAME_OVER'                 // Spiel ist beendet
```

### Player und GamePhase

```ts
interface Player {
  id:               PlayerId;
  name:             string;
  color:            string;  // Hex-Farbe aus PLAYER_COLORS
  score:            number;
  meeplesAvailable: number;  // startet bei MEEPLES_PER_PLAYER (7)
}

type GamePhase = 'NOT_STARTED' | 'PLACING_TILE' | 'PLACING_MEEPLE' | 'GAME_OVER'
```

### Konstanten

```ts
const MEEPLES_PER_PLAYER = 7
const PLAYER_COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#457b9d', '#6a0572']
```

Maximal 5 Spieler (durch `PLAYER_COLORS` begrenzt, enforced in `startGame()`).
