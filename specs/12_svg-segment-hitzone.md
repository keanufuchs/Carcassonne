# 12 — SVG Segment Hit Zones (MH-03b)

Segment-aware Meeple-Positionierung auf Basis der SVG-Vektorstruktur.

---

## Ziel

Statt kleiner Kreise an berechneten Schwerpunkten sollen die **echten SVG-Segmentflächen**
(Straßenstreifen, Stadtpolygon, Feldbereich, Kloster) als klickbare Zonen dienen.
Der Spieler klickt direkt auf den sichtbaren Teil der Kachel, um einen Meeple zu platzieren.

---

## Ist-Zustand

```
TileView (<img> tag)
  └── BoardView overlay: <div> MeepleIcon-Kreise
        ├── Positionierung via segmentPosition() (Kantenmittelpunkt-Schwerpunkt)
        └── Kein Bezug zur SVG-Geometrie
```

Schwäche: Der Kreis liegt oft ungenau (z. B. bei großen Stadtflächen), und der Spieler
sieht nicht, **welcher Bereich** einem Segment entspricht.

---

## Soll-Zustand

```
TileView
  ├── <img>  —  Kachel-Grafik (bleibt unverändert)
  └── <SegmentHitZone>  —  transparentes SVG-Overlay (nur in Phase PLACING_MEEPLE)
        ├── Extrahiert Pfade aus dem Tile-SVG per fetch + DOM-Parsing
        ├── Rendert transparente Pfade pixel-genau über dem <img>
        └── Hover → Fläche leuchtet auf;  Click → placeMeeple(ref)
```

---

## SVG-Segment-ID-Konvention (Pflicht)

Jedes Segment-Element in `public/tiles/*.svg` muss tragen:

```
id="segment-{KIND}-{localId}"
data-kind="{KIND}"
```

`localId` muss exakt mit `TilePrototype.segments[n].localId` übereinstimmen.

Beispiele:

| SVG-Element | KIND | localId |
|---|---|---|
| `<rect id="segment-FIELD-2" …>` | FIELD | 2 |
| `<rect id="segment-ROAD-1" …>` | ROAD | 1 |
| `<polygon id="segment-CITY-0" …>` | CITY | 0 |
| `<rect id="segment-MONASTERY-3" …>` | MONASTERY | 3 |

### Nicht-konforme IDs (Audit-Pflicht vor Implementierung)

Vor der Implementierung müssen alle 48 SVG-Dateien geprüft und ggf. korrigiert werden:

| Datei | Problem | Fix |
|---|---|---|
| `tile-r.svg` | `id="segment-FIELD"` — fehlt localId | → `id="segment-FIELD-2"` (je nach Prototype) |
| `tile-r.svg` | `id="segment-CITY-0a"` / `id="segment-CITY-0b"` | → beide `id="segment-CITY-0"`, ergänzt um `data-part="a"` / `"b"` |

Split-Elemente (eine logische localId, mehrere SVG-Shapes): gleiche `localId`, alle
werden als Hit Zone gerendert — zusammen bilden sie die klickbare Fläche des Segments.

---

## Implementierung

### Schritt 0 — SVG-ID-Audit

Skript oder manuell: alle `public/tiles/*.svg` prüfen, ob `id^="segment-"` Elemente
die Konvention `segment-KIND-{n}` einhalten und ob `n` mit dem Prototype übereinstimmt.

### Schritt 1 — `useTileSvgPaths` Hook

```ts
// src/ui/board/useTileSvgPaths.ts

export interface SegmentShape {
  tagName: 'rect' | 'polygon' | 'path' | 'circle';
  attrs: Record<string, string>;  // alle SVG-Attribute (points, x, y, width, height, d, …)
  localId: number;
  kind: SegmentKind;
}

// Modul-globaler Cache: tileFile → SegmentShape[]
const svgCache = new Map<string, SegmentShape[]>();

export function useTileSvgPaths(tileFile: string): SegmentShape[] | null
```

Ablauf:
1. Cache-Hit? → sofort zurückgeben (kein erneuter Fetch).
2. `fetch('/tiles/' + tileFile)` → SVG-Text.
3. `new DOMParser().parseFromString(svg, 'image/svg+xml')`.
4. `doc.querySelectorAll('[id^="segment-"]')` → NodeList.
5. Pro Element: `id` zerlegen → `kind`, `localId`; alle Attribute als `attrs` speichern.
6. In Cache schreiben, State setzen.

SSR-Guard: `if (typeof window === 'undefined') return null`.

### Schritt 2 — `SegmentHitZone` Komponente

```ts
// src/ui/board/SegmentHitZone.tsx

interface Props {
  shapes: SegmentShape[];
  targets: SegmentRef[];      // gültige Meeple-Ziele aus getMeepleTargets()
  rotation: number;           // Kachel-Rotation in Grad (0 | 90 | 180 | 270)
  tileSize: number;           // px
  playerColor: string;
  onPlace: (ref: SegmentRef) => void;
}
```

Render-Struktur:

```tsx
<svg
  viewBox="0 0 100 100"
  style={{
    position: 'absolute', inset: 0,
    width: tileSize, height: tileSize,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
    overflow: 'visible',
    pointerEvents: 'none',       // Container leitet Events nicht ab
  }}
>
  {targets.flatMap(ref =>
    shapes
      .filter(s => s.localId === ref.localId)
      .map((shape, i) => (
        <SegmentHitShape
          key={`${ref.localId}-${i}`}
          shape={shape}
          playerColor={playerColor}
          onPlace={() => onPlace(ref)}
        />
      ))
  )}
</svg>
```

`SegmentHitShape` (intern):
- Rendert `<rect>`, `<polygon>` oder `<path>` mit den Original-Koordinaten aus `shape.attrs`.
- `fill="transparent"` im Idle-State, `pointerEvents="all"`.
- CSS-Klasse `segment-hit` + Inline-Style `--player-color: ${playerColor}`.
- `data-testid="meeple-target"` (E2E-Kompatibilität bleibt erhalten).

### Schritt 3 — CSS

```css
/* board.css */
.segment-hit {
  cursor: pointer;
  fill: transparent;
  stroke: none;
  transition: fill 100ms ease, stroke 100ms ease;
}
.segment-hit:hover {
  fill: var(--player-color);
  opacity: 0.4;
  stroke: gold;
  stroke-width: 2;
}
.segment-hit:active {
  opacity: 0.65;
}
```

### Schritt 4 — Integration in TileView

```tsx
// TileView.tsx — neue Props
interface Props {
  placed: PlacedTile;
  registry: FeatureRegistry;
  players: Player[];
  size?: number;
  // NEU:
  targets?: SegmentRef[];
  currentPlayerColor?: string;
  onPlace?: (ref: SegmentRef) => void;
}

export function TileView({ placed, ..., targets = [], currentPlayerColor, onPlace, size = 80 }: Props) {
  const tileFile = tileImageMap[placed.prototypeId] ?? '';
  const shapes = useTileSvgPaths(tileFile);

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <img
        src={`/tiles/${tileFile}`}
        style={{ transform: `rotate(${placed.rotation}deg)`, width: '100%', height: '100%', display: 'block' }}
      />
      {/* Platzierte Meeples — unverändert */}
      {meeples.map(...)}
      {/* Hit Zones */}
      {targets.length > 0 && shapes && onPlace && currentPlayerColor && (
        <SegmentHitZone
          shapes={shapes}
          targets={targets}
          rotation={placed.rotation}
          tileSize={size}
          playerColor={currentPlayerColor}
          onPlace={onPlace}
        />
      )}
    </div>
  );
}
```

### Schritt 5 — BoardView vereinfachen

Bestehende `MeepleIcon`-Kreis-Overlays in `BoardView` werden entfernt.
`targets` + `onPlace` werden nur an die zuletzt platzierte Kachel weitergereicht.

```tsx
// BoardView.tsx (vereinfacht)
{placedTiles.map(tile => {
  const isLastPlaced = tile.tileId === state.lastPlacedTileId;
  const targets = isLastPlaced ? meepleTargets : [];
  return (
    <div key={tile.tileId} ...>
      <TileView
        placed={tile}
        registry={state.board.registry}
        players={state.players}
        size={TILE_SIZE}
        targets={targets}
        currentPlayerColor={currentPlayer.color}
        onPlace={ref => controller.placeMeeple(ref)}
      />
    </div>
  );
})}
```

---

## Betroffene Dateien

```
public/tiles/*.svg                    — ID-Audit + Fixes (alle 48 Dateien)
src/ui/board/
  useTileSvgPaths.ts                  — NEU: SVG-fetch + parse + cache
  SegmentHitZone.tsx                  — NEU: SVG-Overlay-Komponente
  TileView.tsx                        — ERWEITERT: targets / onPlace Props
  BoardView.tsx                       — VEREINFACHT: MeepleIcon-Circles entfernt
  board.css                           — ERGÄNZT: .segment-hit Styles
specs/09_meeples.md                   — §9.5 Soll-Verhalten aktualisieren
specs/12_svg-segment-hitzone.md       — dieses Dokument
```

---

## Akzeptanzkriterien

| # | Kriterium |
|---|---|
| 1 | Phase `PLACING_MEEPLE`: jeder gültige Segment-Bereich hebt sich bei Hover farbig ab |
| 2 | Click auf Segment → `placeMeeple(ref)` wird aufgerufen |
| 3 | Nicht-gültige Segmente zeigen kein Highlighting |
| 4 | Overlay liegt pixel-genau über dem SVG-Segment (Rotation 0°/90°/180°/270°) |
| 5 | Alle 48 SVG-Dateien haben konforme `id="segment-KIND-{localId}"` IDs |
| 6 | `data-testid="meeple-target"` bleibt auf den Hit-Zone-Elementen erhalten |
| 7 | Platzierte Meeples werden weiterhin korrekt auf Kacheln gerendert |
| 8 | SVG-Fetch wird gecacht — kein wiederholter Netzwerk-Request derselben Kachel |

---

## Risiken

| Risiko | Mitigation |
|---|---|
| Split-City-Tiles: zwei SVG-Elemente für eine `localId` | Beide `shapes.filter(s => s.localId === ref.localId)` werden gerendert — je ein Hit-Shape |
| FIELD-Hintergrund überdeckt andere Segmente | SVG-Layering: FIELD liegt unten, ROAD/CITY oben — `pointer-events` greift nur auf das oberste Element |
| `DOMParser` in Node/Test-Umgebung | `typeof window === 'undefined'` Guard; Unit-Tests mocken `fetch` |
| Fehlende ID auf einzelnem SVG-Element | `shapes.find()` → `null` → kein Hit-Zone, aber kein Crash; Fallback-Logging im Dev-Mode |

---

## Abhängigkeiten

- Benötigt: vollständige SVG-Tile-Bibliothek (`public/tiles/`) — erledigt in MH-03
- Blockiert: OPT-03 (visuelle Optimierungen), weiterführende UX-Verbesserungen
