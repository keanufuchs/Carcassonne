# Feature

Ein Feature ist eine zusammenhängende Terrain-Fläche, die sich über mehrere Kacheln erstrecken kann — z.B. eine Stadt, eine Straße, ein Kloster oder ein Feld. Der Feature-Graph ist das Herzstück der Spiellogik: er verwaltet Eigentümerschaft, Abschluss und Punkte.

## Datenstruktur (`Feature.ts`)

```ts
interface Feature {
  id:                      FeatureId;         // "F1", "F2", ...
  kind:                    FeatureKind;       // 'CITY' | 'ROAD' | 'MONASTERY' | 'FIELD'
  segments:                Set<string>;       // segmentKeys aller zugehörigen Segmente
  openEdges:               number;            // offene Kanten; 0 = abgeschlossen
  meeples:                 MeeplePlacement[]; // wer steht hier
  shieldCount:             number;            // Anzahl Wappen (nur CITY)
  completed:               boolean;
  monasteryTileId?:        TileId;            // nur MONASTERY
  monasterySurroundCount?: number;            // nur MONASTERY: 0–8
  closedCitiesAdjacent?:  Set<FeatureId>;    // nur FIELD: angrenzende abgeschl. Städte
}
```

`segments` enthält `segmentKey`s der Form `"T3#1"` (TileId + LocalId). Damit lässt sich jederzeit rekonstruieren, welche physischen Kachelsegmente zu diesem Feature gehören.

## Feature-Registry (`segments.ts`)

```ts
interface FeatureRegistry {
  features:         Map<FeatureId, Feature>; // alle aktiven Features
  segmentToFeature: Map<string, FeatureId>;  // segmentKey → FeatureId (Lookup)
  nextId:           number;
}
```

Zwei Maps für zwei Richtungen:
- `features` → von ID zum Feature-Objekt
- `segmentToFeature` → von Segment-Adresse zur Feature-ID

| Funktion | Zweck |
|---|---|
| `createFeature(reg, kind)` | Neues Feature anlegen, in Registry eintragen |
| `attachSegment(reg, feature, ref)` | Segment einem Feature zuordnen |
| `lookupBySegment(reg, ref)` | Feature anhand eines SegmentRef finden |
| `retireFeature(reg, id)` | Feature nach Merge aus Registry entfernen |

## Merge (`merge.ts`)

Wenn zwei Kacheln mit demselben Terrain-Typ aneinander gelegt werden, werden ihre Features zusammengeführt:

```ts
function unify(reg, a, b): Feature
```

- Die Feature mit der **lexikografisch kleineren ID** gewinnt (deterministisch).
- Der Verlierer übergibt `segments`, `openEdges`, `shieldCount` und `meeples`.
- Der Verlierer wird via `retireFeature()` aus der Registry gelöscht.

```
Kachel 1: [Stadt F1]   +   Kachel 2: [Stadt F2]
                 ↓
          unify(F1, F2) → F1 gewinnt
          F1.segments  = F1.segments ∪ F2.segments
          F1.openEdges += F2.openEdges
          F1.meeples   = [...F1.meeples, ...F2.meeples]
          F2 wird gelöscht
```

`openEdges` werden beim Merge **addiert**. Jede Slot-Verbindung zweier Kacheln dekrementiert beide Seiten um 1. Wenn alle Verbindungspunkte geschlossen sind, ist `openEdges === 0`.

## Completion (`completion.ts`)

Nach jeder Kachelplatzierung prüft `detectCompletions()` alle berührten Features:

| Kind | Abschluss-Bedingung |
|---|---|
| `CITY` | `openEdges === 0` |
| `ROAD` | `openEdges === 0` |
| `MONASTERY` | `monasterySurroundCount === 8` |
| `FIELD` | wird nie mid-game abgeschlossen |

Abgeschlossene Features erhalten `completed = true` und werden als Liste zurückgegeben — direkt verarbeitet von `_resolveScoring()` in `Game.ts`.

## Meeples

```ts
interface MeeplePlacement {
  playerId:   PlayerId;
  segmentRef: SegmentRef; // welches Segment auf welcher Kachel
}
```

Meeples leben im Feature (`feature.meeples`), nicht auf der Kachel. Wenn ein Feature nach einem Merge Meeples verschiedener Spieler enthält, gelten Mehrheitsregeln beim Scoring. Nach der Wertung werden alle Meeples zurückgegeben (`player.meeplesAvailable += 1`).
