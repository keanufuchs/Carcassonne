import type { EdgeSide, SegmentBlueprint, SlotPos, TilePrototype } from '../core/types/tile';
import type { MarkerRegion, PolygonRegion, RoadRegion, TileRegions, Vec2 } from './svgRegions';
import { ROAD_DEFAULT_WIDTH } from './palette';
import { partitionFields } from './fieldPartition';

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

// ── City layout ──────────────────────────────────────────────────────────────

/** Triangle filling the half square cut off by the diagonal between two adjacent edges. */
function adjacentCityTriangle(a: EdgeSide, b: EdgeSide): Vec2[] {
  const corner = sharedCorner(a, b)!;
  const far = (side: EdgeSide): Vec2 => {
    const { from, to } = EDGE_GEOMETRY[side];
    return from[0] === corner[0] && from[1] === corner[1] ? to : from;
  };
  return [far(a), corner, far(b)];
}

/** Band hexagon spanning two opposite city edges, pinched on the other two. */
function bandHexagon(citySides: Set<EdgeSide>): Vec2[] {
  const points: Vec2[] = [];
  for (const side of SIDES) {
    const { from } = EDGE_GEOMETRY[side];
    points.push(from);
    if (!citySides.has(side)) {
      const [mx, my] = edgeMidpoint(side);
      const [nx, ny] = INWARD[side];
      points.push([mx + nx * CITY_CAP_DEPTH, my + ny * CITY_CAP_DEPTH]);
    }
  }
  return points;
}

/**
 * One or more polygons (sharing the segment's localId) for a CITY segment,
 * derived from the set of edges its slots touch.
 */
export function layoutCitySegment(seg: SegmentBlueprint): Vec2[][] {
  const sides = SIDES.filter((s) => seg.edgeSlots.some((slot) => slot.side === s));
  switch (sides.length) {
    case 1: {
      const { from, to } = EDGE_GEOMETRY[sides[0]];
      const [mx, my] = edgeMidpoint(sides[0]);
      const [nx, ny] = INWARD[sides[0]];
      return [[from, to, [mx + nx * CITY_CAP_DEPTH, my + ny * CITY_CAP_DEPTH]]];
    }
    case 2:
      return sharedCorner(sides[0], sides[1])
        ? [adjacentCityTriangle(sides[0], sides[1])]
        : [bandHexagon(new Set(sides))];
    case 3: {
      // Two overlapping half-square triangles (mirrors the SVG `data-part`
      // encoding) so wall seam suppression and the shield banner centroid
      // behave exactly like the SVG-derived multi-part cities.
      const missing = SIDES.find((s) => !sides.includes(s))!;
      const apex = OPPOSITE[missing];
      const neighbours = SIDES.filter((s) => s !== missing && s !== apex);
      return neighbours.map((n) => adjacentCityTriangle(apex, n));
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
): RoadRegion[] {
  const width = ROAD_DEFAULT_WIDTH;
  const mids = seg.edgeSlots.map((slot) => slotMidpoint(slot.side, slot.pos));

  if (seg.edgeSlots.length === 2) {
    const [a, b] = seg.edgeSlots;
    const corner = sharedCorner(a.side, b.side);
    const centerline = corner ? arcCenterline(corner, mids[0], mids[1]) : [mids[0], mids[1]];
    return [{ localId: seg.localId, centerline, width }];
  }

  // Dead ends (1 slot) and future ≥3-way segments: one run per slot to centre.
  return mids.map((mid) => ({
    localId: seg.localId,
    centerline: deadEndCenterline(mid, cityPolys, !hasMonastery),
    width,
  }));
}

// ── Orchestration ────────────────────────────────────────────────────────────

export function layoutRegions(proto: TilePrototype): TileRegions {
  const polygons: PolygonRegion[] = [];
  const roads: RoadRegion[] = [];
  const markers: MarkerRegion[] = [];

  for (const seg of proto.segments) {
    if (seg.kind !== 'CITY') continue;
    for (const points of layoutCitySegment(seg)) {
      polygons.push({ localId: seg.localId, kind: 'CITY', points });
    }
  }
  const cityPolys = polygons.map((p) => p.points);

  for (const seg of proto.segments) {
    if (seg.kind === 'ROAD') roads.push(...layoutRoadSegment(seg, cityPolys, proto.hasMonastery));
    if (seg.kind === 'MONASTERY') {
      markers.push({ localId: seg.localId, pos: CENTER, radius: MONASTERY_RADIUS });
    }
  }

  const fieldSegments = proto.segments.filter((s) => s.kind === 'FIELD');
  polygons.push(...partitionFields(fieldSegments, cityPolys, roads));

  return { polygons, roads, markers };
}
