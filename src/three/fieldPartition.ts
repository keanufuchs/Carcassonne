import type { SegmentBlueprint } from '../core/types/tile';
import type { PolygonRegion, RoadRegion, Vec2 } from './svgRegions';
import {
  distToPolygonEdge,
  distToPolyline,
  pointInPolygon,
  slotMidpoint,
} from './layoutRegions';

/**
 * Partitions the open countryside of a tile among its FIELD segments.
 *
 * Fields are "everything that is neither city nor road", split into the
 * per-segment regions the game topology dictates — including fields whose
 * area consists of several disconnected components (e.g. the two pockets
 * beside the dead-end road of TILE-S/T). A coordinate-free case table can't
 * express that, so the tile is rasterised and flood-filled instead:
 *
 * 1. Rasterise the 0..100 tile into CELL-sized cells.
 * 2. Block cells under cities (deflated slightly so fields tuck under the
 *    taller city base) and under road corridors (the curb footprint, which
 *    also keeps tree scatter off the roads).
 * 3. Seed each field segment at its edge slots and grow all seeds with a
 *    multi-source BFS — fully deterministic, no RNG.
 * 4. Contour-trace each connected component and simplify the outline.
 *
 * Assumption: every blocking feature touches the tile border (true for all
 * valid Carcassonne tiles), so field components never contain holes.
 */

const GRID = 50;
const CELL = 100 / GRID;
/** Fields reach this far under city polygons (city base hides the seam). */
const CITY_DEFLATE = 1;
/** Curb half-footprint: road width/2 × the generator's 1.7 curb factor. */
const curbClearance = (width: number) => (width / 2) * 1.7;
const SIMPLIFY_TOLERANCE = 2;
const SEED_INSET = 5;

const cellCenter = (i: number, j: number): Vec2 => [i * CELL + CELL / 2, j * CELL + CELL / 2];
const cellIndex = (i: number, j: number) => j * GRID + i;
const inGrid = (i: number, j: number) => i >= 0 && i < GRID && j >= 0 && j < GRID;

function buildBlockedMask(cityPolys: Vec2[][], roads: RoadRegion[]): Uint8Array {
  const blocked = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const p = cellCenter(i, j);
      const inCity = cityPolys.some(
        (poly) => pointInPolygon(p, poly) && distToPolygonEdge(p, poly) >= CITY_DEFLATE,
      );
      const onRoad = roads.some((r) => distToPolyline(p, r.centerline) <= curbClearance(r.width));
      if (inCity || onRoad) blocked[cellIndex(i, j)] = 1;
    }
  }
  return blocked;
}

const INWARD_STEP: Record<string, [number, number]> = {
  N: [0, 1],
  E: [-1, 0],
  S: [0, -1],
  W: [1, 0],
};

/** Multi-source BFS: labels every reachable free cell with a field localId. */
function floodFill(fieldSegments: SegmentBlueprint[], blocked: Uint8Array): Int16Array {
  const labels = new Int16Array(GRID * GRID).fill(-1);
  const queue: [number, number][] = [];

  for (const seg of fieldSegments) {
    for (const slot of seg.edgeSlots) {
      const [mx, my] = slotMidpoint(slot.side, slot.pos);
      const [dx, dy] = INWARD_STEP[slot.side];
      let i = Math.min(GRID - 1, Math.max(0, Math.floor((mx + dx * SEED_INSET) / CELL)));
      let j = Math.min(GRID - 1, Math.max(0, Math.floor((my + dy * SEED_INSET) / CELL)));
      // Walk inward past any blocking feature sitting on the slot (defensive).
      while (inGrid(i, j) && blocked[cellIndex(i, j)]) {
        i += dx;
        j += dy;
      }
      if (!inGrid(i, j) || labels[cellIndex(i, j)] !== -1) continue;
      labels[cellIndex(i, j)] = seg.localId;
      queue.push([i, j]);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const [i, j] = queue[head];
    const label = labels[cellIndex(i, j)];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (!inGrid(ni, nj)) continue;
      const idx = cellIndex(ni, nj);
      if (blocked[idx] || labels[idx] !== -1) continue;
      labels[idx] = label;
      queue.push([ni, nj]);
    }
  }
  return labels;
}

/** 4-connected components of one label, in deterministic row-major order. */
function components(labels: Int16Array, label: number): Set<number>[] {
  const seen = new Uint8Array(GRID * GRID);
  const result: Set<number>[] = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const idx = cellIndex(i, j);
      if (labels[idx] !== label || seen[idx]) continue;
      const comp = new Set<number>();
      const queue: [number, number][] = [[i, j]];
      seen[idx] = 1;
      for (let head = 0; head < queue.length; head++) {
        const [ci, cj] = queue[head];
        comp.add(cellIndex(ci, cj));
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ni = ci + di;
          const nj = cj + dj;
          if (!inGrid(ni, nj)) continue;
          const nidx = cellIndex(ni, nj);
          if (labels[nidx] !== label || seen[nidx]) continue;
          seen[nidx] = 1;
          queue.push([ni, nj]);
        }
      }
      result.push(comp);
    }
  }
  return result;
}

/**
 * Traces the outer boundary of a cell component as a closed polygon.
 * Directed boundary edges (interior on a consistent side) are chained into
 * loops; the loop with the largest area is the outer ring (components have
 * no holes, see module doc).
 */
function traceContour(comp: Set<number>): Vec2[] {
  const has = (i: number, j: number) => inGrid(i, j) && comp.has(cellIndex(i, j));
  const key = ([x, y]: Vec2) => x * 1000 + y;
  const edges = new Map<number, Vec2[][]>();
  const addEdge = (from: Vec2, to: Vec2) => {
    const k = key(from);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push([from, to]);
  };

  for (const idx of comp) {
    const i = idx % GRID;
    const j = Math.floor(idx / GRID);
    const x0 = i * CELL;
    const x1 = (i + 1) * CELL;
    const y0 = j * CELL;
    const y1 = (j + 1) * CELL;
    if (!has(i, j - 1)) addEdge([x0, y0], [x1, y0]);
    if (!has(i + 1, j)) addEdge([x1, y0], [x1, y1]);
    if (!has(i, j + 1)) addEdge([x1, y1], [x0, y1]);
    if (!has(i - 1, j)) addEdge([x0, y1], [x0, y0]);
  }

  const used = new Set<Vec2[]>();
  const loops: Vec2[][] = [];
  for (const list of edges.values()) {
    for (const start of list) {
      if (used.has(start)) continue;
      const loop: Vec2[] = [start[0]];
      let edge: Vec2[] | undefined = start;
      while (edge) {
        used.add(edge);
        loop.push(edge[1]);
        if (key(edge[1]) === key(loop[0])) break; // loop closed
        const candidates: Vec2[][] = (edges.get(key(edge[1])) ?? []).filter((e) => !used.has(e));
        if (candidates.length === 0) break; // open chain — cannot happen for valid masks
        // At pinch vertices prefer the sharpest turn so loops stay simple.
        const [dx, dy] = [edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]];
        candidates.sort(
          (a, b) =>
            cross(dx, dy, a[1][0] - a[0][0], a[1][1] - a[0][1]) -
            cross(dx, dy, b[1][0] - b[0][0], b[1][1] - b[0][1]),
        );
        edge = candidates[0];
      }
      loop.pop(); // drop the duplicated closing vertex
      if (loop.length >= 3) loops.push(loop);
    }
  }

  loops.sort((a, b) => Math.abs(shoelace(b)) - Math.abs(shoelace(a)));
  return loops[0] ?? [];
}

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

function shoelace(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return a / 2;
}

function removeCollinear(poly: Vec2[]): Vec2[] {
  return poly.filter((p, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length];
    const next = poly[(i + 1) % poly.length];
    return cross(p[0] - prev[0], p[1] - prev[1], next[0] - p[0], next[1] - p[1]) !== 0;
  });
}

/** Ramer–Douglas–Peucker on an open chain (endpoints kept). */
function simplifyChain(chain: Vec2[], tolerance: number): Vec2[] {
  if (chain.length <= 2) return chain;
  const [a, b] = [chain[0], chain[chain.length - 1]];
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < chain.length - 1; i++) {
    const d = perpendicularDist(chain[i], a, b);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist <= tolerance) return [a, b];
  return [
    ...simplifyChain(chain.slice(0, maxIdx + 1), tolerance).slice(0, -1),
    ...simplifyChain(chain.slice(maxIdx), tolerance),
  ];
}

function perpendicularDist(p: Vec2, a: Vec2, b: Vec2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(cross(dx, dy, p[0] - a[0], p[1] - a[1])) / len;
}

/** Closed-polygon simplification: split at the two farthest vertices, RDP each half. */
function simplifyPolygon(poly: Vec2[], tolerance: number): Vec2[] {
  const cleaned = removeCollinear(poly);
  if (cleaned.length <= 4) return cleaned;
  let farIdx = 1;
  let farDist = 0;
  for (let i = 1; i < cleaned.length; i++) {
    const d = Math.hypot(cleaned[i][0] - cleaned[0][0], cleaned[i][1] - cleaned[0][1]);
    if (d > farDist) {
      farDist = d;
      farIdx = i;
    }
  }
  const half1 = simplifyChain(cleaned.slice(0, farIdx + 1), tolerance);
  const half2 = simplifyChain([...cleaned.slice(farIdx), cleaned[0]], tolerance);
  return removeCollinear([...half1.slice(0, -1), ...half2.slice(0, -1)]);
}

export function partitionFields(
  fieldSegments: SegmentBlueprint[],
  cityPolys: Vec2[][],
  roads: RoadRegion[],
): PolygonRegion[] {
  if (fieldSegments.length === 0) return [];
  const blocked = buildBlockedMask(cityPolys, roads);
  const labels = floodFill(fieldSegments, blocked);

  const regions: PolygonRegion[] = [];
  for (const seg of fieldSegments) {
    for (const comp of components(labels, seg.localId)) {
      const points = simplifyPolygon(traceContour(comp), SIMPLIFY_TOLERANCE);
      if (points.length >= 3) regions.push({ localId: seg.localId, kind: 'FIELD', points });
    }
  }
  return regions;
}
