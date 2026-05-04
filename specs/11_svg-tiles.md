# 11 — SVG Tile Generation

Each `TilePrototype` in `src/core/deck/tiles/` gets a handcrafted SVG in `public/tiles/`.
These SVGs replace the existing PNGs.

---

## Design Tokens

| Token            | Value     |
|------------------|-----------|
| `FIELD_FILL`     | `#7fbf6a` |
| `CITY_FILL`      | `#c9b07a` |
| `ROAD_STROKE`    | `#ffffff` |
| `ROAD_WIDTH`     | `10`      |
| `MONASTERY_FILL` | `#d6d6d6` |

---

## File Naming

```
Prototype id : TILE-L
Output file  : public/tiles/tile-l.svg
```

Lowercase, hyphen preserved, `.svg` extension.

---

## SVG Root

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
```

---

## Layer Order (bottom → top)

1. FIELD background
2. ROAD segments
3. CITY segments
4. MONASTERY (only if `hasMonastery: true`)

---

## Edge Midpoints (road endpoints)

```
N → (50,  0)
E → (100, 50)
S → (50, 100)
W → (0,  50)
```

Center: **(50, 50)**. City corners match tile corners exactly. Roads meet edge midpoints exactly.

---

## 1 — FIELD

Always a full background rect:

```svg
<rect id="segment-FIELD" width="100" height="100" fill="#7fbf6a" data-kind="FIELD"/>
```

---

## 2 — ROAD

Road width = 10 units. Color = `#ffffff`.

### Straight

| Direction | Element |
|-----------|---------|
| N↔S | `<rect x="45" y="0" width="10" height="100" fill="#ffffff" data-kind="ROAD"/>` |
| E↔W | `<rect x="0" y="45" width="100" height="10" fill="#ffffff" data-kind="ROAD"/>` |

### Curve (2 adjacent sides)

Circle centred on the shared tile corner; SVG viewport clips the arc to 0–100.

| Curve | Element |
|-------|---------|
| N+E | `<circle cx="100" cy="0" r="50" fill="none" stroke="#ffffff" stroke-width="10" data-kind="ROAD"/>` |
| N+W | `<circle cx="0" cy="0" r="50" fill="none" stroke="#ffffff" stroke-width="10" data-kind="ROAD"/>` |
| S+E | `<circle cx="100" cy="100" r="50" fill="none" stroke="#ffffff" stroke-width="10" data-kind="ROAD"/>` |
| S+W | `<circle cx="0" cy="100" r="50" fill="none" stroke="#ffffff" stroke-width="10" data-kind="ROAD"/>` |

### T-junction (3 sides)

Full axis rect + half rect from centre to the third edge.

| Missing | Rects |
|---------|-------|
| no N (E+S+W) | H-rect (`x=0,y=45,w=100,h=10`) + `<rect x="45" y="50" width="10" height="50"/>` |
| no S (N+E+W) | H-rect + `<rect x="45" y="0" width="10" height="50"/>` |
| no E (N+S+W) | V-rect (`x=45,y=0,w=10,h=100`) + `<rect x="0" y="45" width="50" height="10"/>` |
| no W (N+S+E) | V-rect + `<rect x="50" y="45" width="50" height="10"/>` |

### Cross (4 sides)

H-rect + V-rect.

### Dead-end (1 side)

```svg
<line x1="<ex>" y1="<ey>" x2="50" y2="50"
      stroke="#ffffff" stroke-width="10" stroke-linecap="round" data-kind="ROAD"/>
```

---

## 3 — CITY

All polygons use exact tile corners. Color: `fill="#c9b07a" data-kind="CITY"`. No stroke.

### 1 side — triangle (25 % depth)

| Side | Polygon points |
|------|----------------|
| N | `0,0 100,0 50,25` |
| S | `0,100 100,100 50,75` |
| E | `100,0 100,100 75,50` |
| W | `0,0 0,100 25,50` |

### 2 adjacent sides — right triangle at shared corner

| Sides | Polygon points |
|-------|----------------|
| N+E | `0,0 100,0 100,100` |
| N+W | `0,0 100,0 0,100` |
| S+E | `100,0 0,100 100,100` |
| S+W | `0,0 0,100 100,100` |

### 2 opposite sides

Two independent 1-side triangles (same fill, separate elements).

### 3 sides — two overlapping right triangles

| Missing | Triangle 1 points | Triangle 2 points |
|---------|------------------|------------------|
| no S (N+E+W) | `0,0 100,0 100,100` | `0,0 100,0 0,100` |
| no N (E+S+W) | `100,0 0,100 100,100` | `0,0 0,100 100,100` |
| no W (N+E+S) | `0,0 100,0 100,100` | `100,0 0,100 100,100` |
| no E (N+S+W) | `0,0 100,0 0,100` | `0,0 0,100 100,100` |

### 4 sides — full rect

```svg
<rect id="segment-CITY-0" width="100" height="100" fill="#c9b07a" data-kind="CITY"/>
```

---

## 4 — MONASTERY

Only render when `hasMonastery: true`. Always centred, always topmost layer.

```svg
<circle id="segment-MONASTERY" cx="50" cy="50" r="12"
        fill="#d6d6d6" stroke="#333" stroke-width="1" data-kind="MONASTERY"/>
<rect x="46" y="46" width="8" height="8" fill="#888"/>
```

---

## Shield

Only render when `hasShield: true`. Place inside the city area, near tile centre.

```svg
<polygon id="shield" points="46,46 54,46 54,52 50,55 46,52"
         fill="#E8D48A" stroke="#9A7F4A" stroke-width="1"/>
```

Shift coordinates for non-full-city tiles so the shield sits visibly inside the city polygon.

---

## Element IDs & Attributes

- `id="segment-<KIND>-<localId>"` on every shape
- `data-kind="FIELD|ROAD|CITY|MONASTERY"` on every shape

---

## Tileability Rules

1. Road endpoints land **exactly** on edge midpoints.
2. City polygon corners coincide **exactly** with tile corners.
3. No coordinates outside `0–100`.
4. Layer order: FIELD → ROAD → CITY → MONASTERY.

---

## Output Rules

- Return **only** the `<svg>` element — no wrapper, no `<style>`, no comments.
- Deterministic — same prototype → same SVG every time.
- One file per prototype.
