import type { EdgeSide, SegmentBlueprint, SlotPos, TilePrototype } from '../core/types/tile';
import type { MarkerRegion, PolygonRegion, RoadRegion, TileRegions, Vec2 } from './svgRegions';
import { ROAD_DEFAULT_WIDTH, VARIANCE } from './palette';
import { partitionFields } from './fieldPartition';
import { makeRng } from './generators/util';

/**
 * Derives `TileRegions` purely from a tile's TS topology — no SVG involved.
 * Output lives in the same 0..100, y-down space as `svgRegions.ts`, so
 * `generateTile` consumes it unchanged. Everything here is deterministic:
 * the same prototype always yields the same regions.
 *
 * Conventions (matching the SVG assets and the game's slot model):
 * - Edges run clockwise: N x 0→100, E y 0→100, S x 100→0, W y 100→0.
 * - Slot midpoints L/C/R sit at 1/6, 1/2, 5/6 along the clockwise edge.
 */

export const CITY_CAP_DEPTH = 25;
const MONASTERY_RADIUS = 12;
const CITY_CLEARANCE = 3;
const CENTER: Vec2 = [50, 50];

const SIDES: EdgeSide[] = ['N', 'E', 'S', 'W'];

const EDGE_GEOMETRY: Record<EdgeSide, { from: Vec2; to: Vec2 }> = {
  N: { from: [0, 0], to: [100, 0] },
  E: { from: [100, 0], to: [100, 100] },
  S: { from: [100, 100], to: [0, 100] },
  W: { from: [0, 100], to: [0, 0] },
};

const INWARD: Record<EdgeSide, Vec2> = { N: [0, 1], E: [-1, 0], S: [0, -1], W: [1, 0] };

const OPPOSITE: Record<EdgeSide, EdgeSide> = { N: 'S', S: 'N', E: 'W', W: 'E' };

const SLOT_T: Record<SlotPos, number> = { L: 1 / 6, C: 1 / 2, R: 5 / 6 };

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Midpoint of an edge slot on the tile border (clockwise L/C/R convention). */
export function slotMidpoint(side: EdgeSide, pos: SlotPos): Vec2 {
  const { from, to } = EDGE_GEOMETRY[side];
  return lerp(from, to, SLOT_T[pos]);
}

function edgeMidpoint(side: EdgeSide): Vec2 {
  return slotMidpoint(side, 'C');
}

/** The corner shared by two adjacent sides, or null for opposite sides. */
function sharedCorner(a: EdgeSide, b: EdgeSide): Vec2 | null {
  const ga = EDGE_GEOMETRY[a];
  const gb = EDGE_GEOMETRY[b];
  const same = ([px, py]: Vec2, [qx, qy]: Vec2) => px === qx && py === qy;
  if (same(ga.to, gb.from)) return ga.to;
  if (same(gb.to, ga.from)) return gb.to;
  return null;
}

// ── Geometry helpers (pure, SVG space) ───────────────────────────────────────

export function pointInPolygon([x, y]: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function distToSegment([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distToPolygonEdge(p: Vec2, poly: Vec2[]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    min = Math.min(min, distToSegment(p, poly[j], poly[i]));
  }
  return min;
}

export function distToPolyline(p: Vec2, line: Vec2[]): number {
  let min = Infinity;
  for (let i = 1; i < line.length; i++) {
    min = Math.min(min, distToSegment(p, line[i - 1], line[i]));
  }
  return min;
}

// ── Organic variance (seeded, deterministic per prototype) ──────────────────

/** Fraction of a path near each endpoint that stays exactly straight. */
const WINDOW_PAD = 0.1;
const PATH_SEGMENTS = 20;

/**
 * Displacement window: zero (value *and* shape) inside the end pads, a smooth
 * sin² bump in between. Paths therefore keep their exact endpoints and leave
 * them in their original direction — roads still meet the tile border
 * perpendicular and neighbouring tiles connect seamlessly.
 */
function windowAt(t: number): number {
  if (t <= WINDOW_PAD || t >= 1 - WINDOW_PAD) return 0;
  const s = Math.sin(Math.PI * ((t - WINDOW_PAD) / (1 - 2 * WINDOW_PAD)));
  return s * s;
}

function pathLength(path: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  return len;
}

/** Resamples a polyline into `n` equal-arc-length segments (endpoints exact). */
function resample(path: Vec2[], n: number): Vec2[] {
  const total = pathLength(path);
  if (total === 0) return [...path];
  const out: Vec2[] = [path[0]];
  let seg = 1;
  let walked = 0;
  for (let i = 1; i < n; i++) {
    const target = (total * i) / n;
    while (seg < path.length - 1) {
      const segLen = Math.hypot(path[seg][0] - path[seg - 1][0], path[seg][1] - path[seg - 1][1]);
      if (walked + segLen >= target) break;
      walked += segLen;
      seg++;
    }
    const segLen = Math.hypot(path[seg][0] - path[seg - 1][0], path[seg][1] - path[seg - 1][1]) || 1;
    const t = (target - walked) / segLen;
    out.push(lerp(path[seg - 1], path[seg], t));
  }
  out.push(path[path.length - 1]);
  return out;
}

/**
 * Hand-drawn feel: resamples the path and sways each interior point
 * perpendicular to the local direction by windowed two-mode noise. `amplitude`
 * is the maximum sway in SVG units; short paths scale it down. Deterministic
 * for a given `rng`.
 */
function displacePath(path: Vec2[], amplitude: number, rng: () => number): Vec2[] {
  const pts = resample(path, PATH_SEGMENTS);
  const amp = amplitude * Math.min(1, pathLength(path) / 100);
  if (amp <= 0) return pts;
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const mode2 = 0.4 + rng() * 0.4;
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const t = i / (pts.length - 1);
    const win = windowAt(t);
    if (win === 0) return p;
    const noise =
      (Math.sin(2 * Math.PI * t + phase1) + mode2 * Math.sin(4 * Math.PI * t + phase2)) /
      (1 + mode2);
    const [px, py] = pts[i - 1];
    const [nx, ny] = pts[i + 1];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const off = amp * win * noise;
    return [p[0] - ((ny - py) / len) * off, p[1] + ((nx - px) / len) * off];
  });
}

/** Chaikin corner cutting on an open chain (endpoints preserved). */
function chaikin(points: Vec2[], iterations: number): Vec2[] {
  let pts = points;
  for (let k = 0; k < iterations; k++) {
    const out: Vec2[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      out.push(lerp(a, b, 0.25), lerp(a, b, 0.75));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** A displaced + smoothed interior city boundary chain. */
function cityChain(path: Vec2[], rng: () => number): Vec2[] {
  const displaced = displacePath(path, VARIANCE.cityVariance * 100, rng);
  return chaikin(displaced, VARIANCE.smoothingIterations);
}

// ── City layout ──────────────────────────────────────────────────────────────

/** The inward pinch point at a non-city edge's midpoint. */
function pinchPoint(side: EdgeSide): Vec2 {
  const [mx, my] = edgeMidpoint(side);
  const [nx, ny] = INWARD[side];
  return [mx + nx * CITY_CAP_DEPTH, my + ny * CITY_CAP_DEPTH];
}

/**
 * Half-square city part between two adjacent edges: the two border edges stay
 * exact, the hypotenuse becomes a displaced chain.
 */
function adjacentCityPart(a: EdgeSide, b: EdgeSide, rng: () => number): Vec2[] {
  const corner = sharedCorner(a, b)!;
  const far = (side: EdgeSide): Vec2 => {
    const { from, to } = EDGE_GEOMETRY[side];
    return from[0] === corner[0] && from[1] === corner[1] ? to : from;
  };
  return [corner, ...cityChain([far(b), far(a)], rng)];
}

/** Band spanning two opposite city edges, with curved pinch chains on the other two. */
function bandPolygon(citySides: Set<EdgeSide>, rng: () => number): Vec2[] {
  const points: Vec2[] = [];
  for (const side of SIDES) {
    const { from, to } = EDGE_GEOMETRY[side];
    if (citySides.has(side)) {
      points.push(from);
    } else {
      const chain = cityChain([from, pinchPoint(side), to], rng);
      points.push(...chain.slice(0, -1));
    }
  }
  return points;
}

/**
 * One or more polygons (sharing the segment's localId) for a CITY segment,
 * derived from the set of edges its slots touch. Tile-border edges stay
 * mathematically exact (wall suppression + neighbour continuity); interior
 * boundaries are organically curved via `rng`.
 */
export function layoutCitySegment(seg: SegmentBlueprint, rng: () => number): Vec2[][] {
  const sides = SIDES.filter((s) => seg.edgeSlots.some((slot) => slot.side === s));
  switch (sides.length) {
    case 1: {
      const { from, to } = EDGE_GEOMETRY[sides[0]];
      return [[...cityChain([to, pinchPoint(sides[0]), from], rng)]];
    }
    case 2:
      return sharedCorner(sides[0], sides[1])
        ? [adjacentCityPart(sides[0], sides[1], rng)]
        : [bandPolygon(new Set(sides), rng)];
    case 3: {
      // Two overlapping half-square parts (mirrors the SVG `data-part`
      // encoding) so wall seam suppression and the shield banner centroid
      // behave exactly like the SVG-derived multi-part cities.
      const missing = SIDES.find((s) => !sides.includes(s))!;
      const apex = OPPOSITE[missing];
      const neighbours = SIDES.filter((s) => s !== missing && s !== apex);
      return neighbours.map((n) => adjacentCityPart(apex, n, rng));
    }
    default:
      return [[[0, 0], [100, 0], [100, 100], [0, 100]]];
  }
}

// ── Road layout ──────────────────────────────────────────────────────────────

const ARC_SEGMENTS = 16;

/** Quarter-circle polyline between two adjacent edge slots, centred on their corner. */
function arcCenterline(corner: Vec2, start: Vec2, end: Vec2): Vec2[] {
  const a0 = Math.atan2(start[1] - corner[1], start[0] - corner[0]);
  let a1 = Math.atan2(end[1] - corner[1], end[0] - corner[0]);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  const r0 = Math.hypot(start[0] - corner[0], start[1] - corner[1]);
  const r1 = Math.hypot(end[0] - corner[0], end[1] - corner[1]);
  const points: Vec2[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS;
    const angle = a0 + (a1 - a0) * t;
    const radius = r0 + (r1 - r0) * t;
    points.push([corner[0] + Math.cos(angle) * radius, corner[1] + Math.sin(angle) * radius]);
  }
  points[0] = start;
  points[points.length - 1] = end;
  return points;
}

/**
 * Straight dead-end run from an edge slot toward the tile centre, trimmed
 * back so it stops `CITY_CLEARANCE` short of any city polygon.
 */
function deadEndCenterline(from: Vec2, cityPolys: Vec2[][], trim: boolean): Vec2[] {
  let t = 1;
  if (trim) {
    const clear = (p: Vec2) =>
      cityPolys.every((poly) => !pointInPolygon(p, poly) && distToPolygonEdge(p, poly) >= CITY_CLEARANCE);
    while (t > 0.05 && !clear(lerp(from, CENTER, t))) t -= 0.01;
  }
  return [from, lerp(from, CENTER, t)];
}

/** Road regions (sharing the segment's localId) for a ROAD segment. */
export function layoutRoadSegment(
  seg: SegmentBlueprint,
  cityPolys: Vec2[][],
  hasMonastery: boolean,
  rng: () => number,
): RoadRegion[] {
  const width = ROAD_DEFAULT_WIDTH;
  const sway = VARIANCE.roadVariance * 100;
  const mids = seg.edgeSlots.map((slot) => slotMidpoint(slot.side, slot.pos));

  if (seg.edgeSlots.length === 2) {
    const [a, b] = seg.edgeSlots;
    const corner = sharedCorner(a.side, b.side);
    // Arcs already carry curvature — full sway on top reads as a zigzag, so
    // they only get a gentle breathing of the radius.
    const ideal = corner ? arcCenterline(corner, mids[0], mids[1]) : [mids[0], mids[1]];
    const amplitude = corner ? sway * 0.4 : sway;
    const centerline = chaikin(displacePath(ideal, amplitude, rng), 1);
    return [{ localId: seg.localId, centerline, width }];
  }

  // Dead ends (1 slot) and future ≥3-way segments: one run per slot to centre.
  return mids.map((mid) => ({
    localId: seg.localId,
    centerline: chaikin(displacePath(deadEndCenterline(mid, cityPolys, !hasMonastery), sway, rng), 1),
    width,
  }));
}

// ── Orchestration ────────────────────────────────────────────────────────────

export function layoutRegions(proto: TilePrototype, seed: string = proto.id): TileRegions {
  const polygons: PolygonRegion[] = [];
  const roads: RoadRegion[] = [];
  const markers: MarkerRegion[] = [];

  const segRng = (seg: SegmentBlueprint) => makeRng(`${seed}:layout:${seg.kind}:${seg.localId}`);

  for (const seg of proto.segments) {
    if (seg.kind !== 'CITY') continue;
    for (const points of layoutCitySegment(seg, segRng(seg))) {
      polygons.push({ localId: seg.localId, kind: 'CITY', points });
    }
  }
  const cityPolys = polygons.map((p) => p.points);

  for (const seg of proto.segments) {
    if (seg.kind === 'ROAD') {
      roads.push(...layoutRoadSegment(seg, cityPolys, proto.hasMonastery, segRng(seg)));
    }
    if (seg.kind === 'MONASTERY') {
      markers.push({ localId: seg.localId, pos: CENTER, radius: MONASTERY_RADIUS });
    }
  }

  const fieldSegments = proto.segments.filter((s) => s.kind === 'FIELD');
  polygons.push(...partitionFields(fieldSegments, cityPolys, roads));

  return { polygons, roads, markers };
}
