import { describe, expect, it } from 'vitest';
import type { EdgeSide, SlotPos, TilePrototype } from '../core/types/tile';
import type { Vec2 } from './svgRegions';
import { BASE_GAME_DISTRIBUTION } from '../core/deck/baseGameTiles';
import { CITY_CAP_DEPTH, layoutRegions, slotMidpoint } from './layoutRegions';
import { VARIANCE } from './palette';

const ROAD_SWAY = VARIANCE.roadVariance * 100;
const CITY_SWAY = VARIANCE.cityVariance * 100;

const PROTOS: TilePrototype[] = BASE_GAME_DISTRIBUTION.map((e) => e.prototype);

// layoutRegions is deterministic (verified in its own test below), so the
// other tests share one memoized result per prototype to keep the suite fast.
const layoutCache = new Map<string, ReturnType<typeof layoutRegions>>();
function layout(proto: TilePrototype): ReturnType<typeof layoutRegions> {
  let regions = layoutCache.get(proto.id);
  if (!regions) {
    regions = layoutRegions(proto);
    layoutCache.set(proto.id, regions);
  }
  return regions;
}

// ── Independent geometry helpers (deliberately not shared with the impl) ────

const INWARD: Record<EdgeSide, Vec2> = { N: [0, 1], E: [-1, 0], S: [0, -1], W: [1, 0] };

/** Expected slot midpoints from the clockwise edge convention. */
const EXPECTED_MIDPOINTS: Record<EdgeSide, Record<SlotPos, Vec2>> = {
  N: { L: [100 / 6, 0], C: [50, 0], R: [500 / 6, 0] },
  E: { L: [100, 100 / 6], C: [100, 50], R: [100, 500 / 6] },
  S: { L: [100 - 100 / 6, 100], C: [50, 100], R: [100 - 500 / 6, 100] },
  W: { L: [0, 100 - 100 / 6], C: [0, 50], R: [0, 100 - 500 / 6] },
};

function add([ax, ay]: Vec2, [bx, by]: Vec2, scale = 1): Vec2 {
  return [ax + bx * scale, ay + by * scale];
}

function pointInPolygon([x, y]: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function distToSegment([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToPolygonEdge(p: Vec2, poly: Vec2[]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    min = Math.min(min, distToSegment(p, poly[j], poly[i]));
  }
  return min;
}

function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

const near = ([ax, ay]: Vec2, [bx, by]: Vec2, eps = 1e-6) =>
  Math.abs(ax - bx) < eps && Math.abs(ay - by) < eps;

// ── Slot geometry ────────────────────────────────────────────────────────────

describe('slotMidpoint', () => {
  it('returns the clockwise L/C/R midpoints for every side', () => {
    for (const side of ['N', 'E', 'S', 'W'] as EdgeSide[]) {
      for (const pos of ['L', 'C', 'R'] as SlotPos[]) {
        expect(slotMidpoint(side, pos), `${side}-${pos}`).toSatisfy((p: Vec2) =>
          near(p, EXPECTED_MIDPOINTS[side][pos]),
        );
      }
    }
  });
});

// ── City layout ──────────────────────────────────────────────────────────────

describe('layoutRegions — cities', () => {
  it('covers every CITY edge slot with a city polygon of the same localId', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      for (const seg of proto.segments) {
        if (seg.kind !== 'CITY') continue;
        for (const slot of seg.edgeSlots) {
          const probe = add(slotMidpoint(slot.side, slot.pos), INWARD[slot.side], 3);
          const hit = regions.polygons.some(
            (r) => r.kind === 'CITY' && r.localId === seg.localId && pointInPolygon(probe, r.points),
          );
          expect(hit, `${proto.id} city ${seg.localId} slot ${slot.side}-${slot.pos}`).toBe(true);
        }
      }
    }
  });

  it('emits valid in-bounds polygons', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      for (const r of regions.polygons) {
        expect(r.points.length, `${proto.id} ${r.kind}-${r.localId} vertex count`).toBeGreaterThanOrEqual(3);
        expect(polygonArea(r.points), `${proto.id} ${r.kind}-${r.localId} area`).toBeGreaterThan(0);
        for (const [x, y] of r.points) {
          expect(x).toBeGreaterThanOrEqual(-0.5);
          expect(x).toBeLessThanOrEqual(100.5);
          expect(y).toBeGreaterThanOrEqual(-0.5);
          expect(y).toBeLessThanOrEqual(100.5);
        }
      }
    }
  });

  it('TILE-D: single-edge city is a curved cap hugging the north edge', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-D')!;
    const cities = layout(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(1);
    const pts = cities[0].points;
    expect(pts.length).toBeGreaterThanOrEqual(4);
    expect(pts.some((p) => near(p, [0, 0]))).toBe(true);
    expect(pts.some((p) => near(p, [100, 0]))).toBe(true);
    const depth = Math.max(...pts.map((p) => p[1]));
    expect(depth).toBeGreaterThan(CITY_CAP_DEPTH / 2);
    expect(depth).toBeLessThanOrEqual(CITY_CAP_DEPTH + CITY_SWAY + 1e-6);
  });

  it('TILE-F: opposite-edge city is a band pinched on N and S', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-F')!;
    const cities = layout(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(1);
    const pts = cities[0].points;
    // All four tile corners stay mathematically exact (city edges on the border).
    for (const corner of [[0, 0], [100, 0], [100, 100], [0, 100]] as Vec2[]) {
      expect(pts.some((p) => near(p, corner)), `corner ${corner}`).toBe(true);
    }
    const area = polygonArea(pts);
    expect(area).toBeGreaterThan(10000 - 2 * (CITY_CAP_DEPTH + CITY_SWAY) * 50 - 500);
    expect(area).toBeLessThan(10000 - 2 * (CITY_CAP_DEPTH - CITY_SWAY) * 50 * 0.3);
  });

  it('TILE-S: three-edge city is two overlapping parts sharing the localId', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-S')!;
    const cities = layout(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(2);
    expect(cities[0].localId).toBe(cities[1].localId);
    for (const c of cities) expect(c.points.length).toBeGreaterThanOrEqual(3);
    // Together they must cover the N edge centre deep into the tile.
    expect(cities.some((c) => pointInPolygon([50, 30], c.points))).toBe(true);
  });

  it('TILE-C: four-edge city is the full square', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-C')!;
    const cities = layout(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(1);
    expect(polygonArea(cities[0].points)).toBeCloseTo(10000, 3);
  });
});

// ── Road layout ──────────────────────────────────────────────────────────────

describe('layoutRegions — roads', () => {
  it('anchors a centerline endpoint exactly at every ROAD edge slot', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      for (const seg of proto.segments) {
        if (seg.kind !== 'ROAD') continue;
        for (const slot of seg.edgeSlots) {
          const mid = slotMidpoint(slot.side, slot.pos);
          const hit = regions.roads.some(
            (r) =>
              r.localId === seg.localId &&
              (near(r.centerline[0], mid) || near(r.centerline[r.centerline.length - 1], mid)),
          );
          expect(hit, `${proto.id} road ${seg.localId} slot ${slot.side}-${slot.pos}`).toBe(true);
        }
      }
    }
  });

  it('uses the default road width and stays in bounds', () => {
    for (const proto of PROTOS) {
      for (const road of layout(proto).roads) {
        expect(road.width).toBe(10);
        expect(road.centerline.length).toBeGreaterThanOrEqual(2);
        let length = 0;
        for (let i = 1; i < road.centerline.length; i++) {
          length += Math.hypot(
            road.centerline[i][0] - road.centerline[i - 1][0],
            road.centerline[i][1] - road.centerline[i - 1][1],
          );
        }
        expect(length, `${proto.id} road ${road.localId} length`).toBeGreaterThan(0);
        for (const [x, y] of road.centerline) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('keeps every road point out of city polygons', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      const cities = regions.polygons.filter((r) => r.kind === 'CITY');
      for (const road of regions.roads) {
        for (const p of road.centerline) {
          for (const city of cities) {
            expect(
              pointInPolygon(p, city.points),
              `${proto.id} road ${road.localId} point ${p} inside city`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('trims dead-end roads back from city walls with clearance', () => {
    for (const proto of PROTOS) {
      if (proto.hasMonastery) continue;
      const regions = layout(proto);
      const cities = regions.polygons.filter((r) => r.kind === 'CITY');
      if (cities.length === 0) continue;
      for (const seg of proto.segments) {
        if (seg.kind !== 'ROAD' || seg.edgeSlots.length !== 1) continue;
        const mid = slotMidpoint(seg.edgeSlots[0].side, seg.edgeSlots[0].pos);
        for (const road of regions.roads) {
          if (road.localId !== seg.localId) continue;
          const inner = near(road.centerline[0], mid)
            ? road.centerline[road.centerline.length - 1]
            : road.centerline[0];
          for (const city of cities) {
            expect(
              distToPolygonEdge(inner, city.points) >= 3 - 1e-6 || pointInPolygon(inner, city.points),
              `${proto.id} road ${seg.localId} end clearance`,
            ).toBe(true);
            expect(pointInPolygon(inner, city.points)).toBe(false);
          }
        }
      }
    }
  });

  it('TILE-V: curved road follows a quarter arc (radius 50 ± sway) around the SW corner', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-V')!;
    const roads = layout(proto).roads;
    expect(roads).toHaveLength(1);
    const line = roads[0].centerline;
    expect(line.length).toBeGreaterThanOrEqual(8);
    expect(near(line[0], [0, 50]) || near(line[line.length - 1], [0, 50])).toBe(true);
    expect(near(line[0], [50, 100]) || near(line[line.length - 1], [50, 100])).toBe(true);
    for (const [x, y] of line) {
      const r = Math.hypot(x - 0, y - 100);
      expect(r).toBeGreaterThanOrEqual(50 - ROAD_SWAY - 1e-6);
      expect(r).toBeLessThanOrEqual(50 + ROAD_SWAY + 1e-6);
    }
  });

  it('TILE-U: straight road sways off the ideal line, bounded by the configured variance', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-U')!;
    const roads = layout(proto).roads;
    expect(roads).toHaveLength(1);
    const deviation = Math.max(...roads[0].centerline.map(([x]) => Math.abs(x - 50)));
    expect(deviation).toBeGreaterThan(0.3);
    expect(deviation).toBeLessThanOrEqual(ROAD_SWAY + 1e-6);
  });

  it('every road leaves the tile border perpendicular (seamless neighbour joins)', () => {
    for (const proto of PROTOS) {
      for (const road of layout(proto).roads) {
        const line = road.centerline;
        for (const [endIdx, nextIdx] of [[0, 1], [line.length - 1, line.length - 2]] as const) {
          const [ex, ey] = line[endIdx];
          const onBorder = ex === 0 || ex === 100 || ey === 0 || ey === 100;
          if (!onBorder) continue;
          const inward: Vec2 = ey === 0 ? [0, 1] : ey === 100 ? [0, -1] : ex === 0 ? [1, 0] : [-1, 0];
          const [dx, dy] = [line[nextIdx][0] - ex, line[nextIdx][1] - ey];
          const len = Math.hypot(dx, dy) || 1;
          const cos = (dx * inward[0] + dy * inward[1]) / len;
          expect(cos, `${proto.id} road ${road.localId} border entry angle`).toBeGreaterThanOrEqual(
            Math.cos((6 * Math.PI) / 180),
          );
        }
      }
    }
  });

  it('TILE-W: three dead-end roads all meet at the tile centre', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-W')!;
    const roads = layout(proto).roads;
    expect(roads).toHaveLength(3);
    for (const road of roads) {
      expect(road.centerline.some((p) => near(p, [50, 50]))).toBe(true);
    }
  });
});

// ── Monastery layout ─────────────────────────────────────────────────────────

describe('layoutRegions — monasteries', () => {
  it('places a centre marker for every MONASTERY segment', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      const monasterySegs = proto.segments.filter((s) => s.kind === 'MONASTERY');
      expect(regions.markers, proto.id).toHaveLength(monasterySegs.length);
      for (const seg of monasterySegs) {
        const marker = regions.markers.find((m) => m.localId === seg.localId);
        expect(marker, `${proto.id} marker ${seg.localId}`).toBeDefined();
        expect(near(marker!.pos, [50, 50])).toBe(true);
        expect(marker!.radius).toBe(12);
      }
    }
  });
});

// ── Field layout ─────────────────────────────────────────────────────────────

describe('layoutRegions — fields', () => {
  it('covers every FIELD edge slot with a field polygon of the same localId', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      for (const seg of proto.segments) {
        if (seg.kind !== 'FIELD') continue;
        for (const slot of seg.edgeSlots) {
          const probe = add(slotMidpoint(slot.side, slot.pos), INWARD[slot.side], 3);
          const hit = regions.polygons.some(
            (r) =>
              r.kind === 'FIELD' &&
              r.localId === seg.localId &&
              (pointInPolygon(probe, r.points) || distToPolygonEdge(probe, r.points) <= 1.5),
          );
          expect(hit, `${proto.id} field ${seg.localId} slot ${slot.side}-${slot.pos}`).toBe(true);
        }
      }
    }
  });

  it('matches the owning segment along a sweep of every tile edge', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      for (const side of ['N', 'E', 'S', 'W'] as EdgeSide[]) {
        for (let i = 0; i < 12; i++) {
          const t = (i + 0.5) / 12;
          const pos: SlotPos = t < 1 / 3 ? 'L' : t < 2 / 3 ? 'C' : 'R';
          const owner = proto.segments.find((s) =>
            s.edgeSlots.some((slot) => slot.side === side && slot.pos === pos),
          );
          expect(owner, `${proto.id} ${side} slot ${pos} has an owner`).toBeDefined();
          const edgePoint = add(
            EXPECTED_MIDPOINTS[side].L,
            [
              EXPECTED_MIDPOINTS[side].R[0] - EXPECTED_MIDPOINTS[side].L[0],
              EXPECTED_MIDPOINTS[side].R[1] - EXPECTED_MIDPOINTS[side].L[1],
            ],
            (t - 1 / 6) / (4 / 6),
          );
          const probe = add(edgePoint, INWARD[side], 3);
          const label = `${proto.id} ${side} t=${t.toFixed(2)} (${owner!.kind} ${owner!.localId})`;
          if (owner!.kind === 'ROAD') {
            // The ribbon (width 10) doesn't fill the whole 33-unit slot; the
            // remainder is roadside verge. Require the road to anchor at the
            // slot midpoint instead of containing every sample.
            const mid = EXPECTED_MIDPOINTS[side][pos];
            const anchored = regions.roads.some(
              (r) =>
                r.localId === owner!.localId &&
                (near(r.centerline[0], mid) || near(r.centerline[r.centerline.length - 1], mid)),
            );
            expect(anchored, label).toBe(true);
          } else {
            const hit = regions.polygons.some(
              (r) =>
                r.kind === owner!.kind &&
                r.localId === owner!.localId &&
                (pointInPolygon(probe, r.points) || distToPolygonEdge(probe, r.points) <= 3.5),
            );
            expect(hit, label).toBe(true);
          }
        }
      }
    }
  });

  it('keeps field polygons clear of road centerlines', () => {
    for (const proto of PROTOS) {
      const regions = layout(proto);
      const fields = regions.polygons.filter((r) => r.kind === 'FIELD');
      for (const road of regions.roads) {
        for (let i = 1; i < road.centerline.length; i++) {
          const [a, b] = [road.centerline[i - 1], road.centerline[i]];
          const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
          for (let s = 0; s <= steps; s++) {
            const p: Vec2 = [a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps];
            for (const field of fields) {
              expect(
                pointInPolygon(p, field.points) && distToPolygonEdge(p, field.points) > 1,
                `${proto.id} road ${road.localId} point inside field ${field.localId}`,
              ).toBe(false);
            }
          }
        }
      }
    }
  });

  it('TILE-S: the single field segment yields two disconnected components', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-S')!;
    const fields = layout(proto).polygons.filter((r) => r.kind === 'FIELD');
    expect(fields).toHaveLength(2);
    expect(fields[0].localId).toBe(fields[1].localId);
  });

  it('TILE-B: monastery tile has one large field covering nearly the whole tile', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-B')!;
    const fields = layout(proto).polygons.filter((r) => r.kind === 'FIELD');
    expect(fields).toHaveLength(1);
    expect(polygonArea(fields[0].points)).toBeGreaterThan(9000);
  });
});

// ── Determinism ──────────────────────────────────────────────────────────────

describe('layoutRegions — determinism', () => {
  it('produces identical output across invocations', () => {
    for (const proto of PROTOS) {
      // Deliberately fresh invocations — the memoized `layout` would compare
      // an object with itself.
      expect(layoutRegions(proto)).toEqual(layoutRegions(proto));
    }
  });
});
