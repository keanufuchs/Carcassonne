# Tile

Eine Kachel existiert in zwei Formen: als **Prototyp** (unveränderliche Schablone) und als **PlacedTile** (Instanz auf dem Board mit eigener ID, Position und Rotation).

## Zwei Ebenen: Prototyp vs. Instanz

```
TilePrototype          PlacedTile
──────────────         ──────────────────────────────
id: "TILE-D"           tileId: "T7"  (eindeutig pro Spielpartie)
edges: { N, E, S, W }  prototypeId: "TILE-D"
segments: [...]        coord: { x: 2, y: 0 }
hasMonastery: false    rotation: 90
hasShield: false       segmentInstances: [...]
```

Der Prototyp beschreibt *was* die Kachel ist. Die PlacedTile beschreibt *wo und wie* sie liegt.

## TilePrototype (`types/tile.ts`)

```ts
interface TilePrototype {
  id:            string;                             // z.B. "TILE-D"
  edges:         Record<EdgeSide, [Terrain, Terrain, Terrain]>;
  segments:      SegmentBlueprint[];
  hasMonastery:  boolean;
  hasShield:     boolean;
}
```

### Kanten (`edges`)

Jede der 4 Seiten (N/E/S/W) ist ein Triple `[L, C, R]` aus Terrain-Werten:

```
Terrain: 'CITY' | 'ROAD' | 'FIELD'
```

`L`, `C`, `R` stehen für Links, Mitte, Rechts — aus Sicht der Kante, wenn man von außen auf die Kachel schaut. Beim Anlegen einer neuen Kachel muss jede Position mit der gespiegelten Position des Nachbarn übereinstimmen (`L↔R`, `C↔C`).

Beispiel Tile-D (Stadt im Norden, Straße von West nach Ost):
```
N: [CITY,  CITY,  CITY ]   ← komplette Stadtmauer
E: [FIELD, ROAD,  FIELD]   ← Straße tritt mittig aus
S: [FIELD, FIELD, FIELD]   ← reines Feld
W: [FIELD, ROAD,  FIELD]   ← Straße tritt mittig ein
```

### Segmente (`SegmentBlueprint`)

```ts
interface SegmentBlueprint {
  localId:    number;        // Index im Segment-Array des Prototyps
  kind:       SegmentKind;   // 'CITY' | 'ROAD' | 'FIELD' | 'MONASTERY'
  edgeSlots:  EdgeSlot[];    // welche (Seite, Position)-Paare gehören dazu
  isShielded?: true;         // nur für Stadtsegmente mit Wappen
}
```

Ein Segment ist eine zusammenhängende Terrain-Fläche auf der Kachel. Tile-D hat 4 Segmente:
- `localId: 0` — Stadt (Norden, alle 3 Slots)
- `localId: 1` — Straße (W-Mitte bis E-Mitte)
- `localId: 2` — Feld (zwischen Straße und Stadt)
- `localId: 3` — Feld (südlich der Straße + Süden)

Klöster haben keine `edgeSlots` — sie berühren keine Kante.

## PlacedTile (`Tile.ts`)

```ts
interface PlacedTile {
  tileId:            TileId;             // "T1", "T2", ... (global eindeutig)
  prototypeId:       string;             // Rückverweis auf TilePrototype
  coord:             Coord;              // { x, y } auf dem Board
  rotation:          Rotation;           // 0 | 90 | 180 | 270
  segmentInstances:  SegmentInstance[];  // eine Instanz pro Blueprint-Segment
}
```

### SegmentInstance

```ts
interface SegmentInstance {
  ref:       SegmentRef;   // { tileId, localId } — globale Adresse des Segments
  kind:      SegmentKind;
  edgeSlots: EdgeSlot[];   // identisch mit Blueprint (noch nicht rotiert)
}
```

`SegmentRef` ist die universelle Adresse eines Segments über alle Kacheln hinweg. Sie wird überall verwendet: im Feature-Graph, beim Meeple-Platzieren, in der Registry.

### `makePlacedTile(proto, coord, rotation)`

Erzeugt eine neue PlacedTile-Instanz. Die `tileId` (`T1`, `T2`, ...) wird von einem modulweiten Zähler vergeben. Für Tests existiert `_resetTileSeq()`.

## Rotation (`rotation.ts`)

Kacheln können in 4 Ausrichtungen platziert werden: `0 | 90 | 180 | 270` Grad (Uhrzeigersinn).

Die Kanten-Validierung (`canPlace`) und die Segment-Suche (`findSegRef`) rechnen Board-Koordinaten automatisch in den Prototyp-Raum um — d.h. die `edges`-Daten im Prototyp sind immer in `rotation=0` definiert, und alle anderen Rotationen werden on-the-fly berechnet.

## Zusammenspiel mit dem Feature-Graph

Beim Platzieren (`placeTileInternal`) wird für jedes Segment der PlacedTile ein Feature-Eintrag in der Registry angelegt. Die Verbindung läuft immer über `SegmentRef`:

```
PlacedTile.segmentInstances[i].ref  ──→  FeatureRegistry.segmentToFeature  ──→  Feature
```

Meeples referenzieren ebenfalls ein `SegmentRef` — damit ist immer klar, in welchem Feature ein Meeple steckt, auch wenn Features nach einem Merge fusioniert wurden.
