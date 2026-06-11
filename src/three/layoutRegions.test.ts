import { describe, expect, it } from 'vitest';
import type { EdgeSide, SlotPos, TilePrototype } from '../core/types/tile';
import type { Vec2 } from './svgRegions';
import { BASE_GAME_DISTRIBUTION } from '../core/deck/baseGameTiles';
import { CITY_CAP_DEPTH, layoutRegions, slotMidpoint } from './layoutRegions';

const PROTOS: TilePrototype[] = BASE_GAME_DISTRIBUTION.map((e) => e.prototype);

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
      const regions = layoutRegions(proto);
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
      const regions = layoutRegions(proto);
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

  it('TILE-D: single-edge city is a cap triangle on the north edge', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-D')!;
    const cities = layoutRegions(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(1);
    const pts = cities[0].points;
    expect(pts).toHaveLength(3);
    expect(pts.some((p) => near(p, [0, 0]))).toBe(true);
    expect(pts.some((p) => near(p, [100, 0]))).toBe(true);
    expect(pts.some((p) => near(p, [50, CITY_CAP_DEPTH]))).toBe(true);
  });

  it('TILE-F: opposite-edge city is a band hexagon pinched on N and S', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-F')!;
    const cities = layoutRegions(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(1);
    const pts = cities[0].points;
    expect(pts).toHaveLength(6);
    expect(pts.some((p) => near(p, [50, CITY_CAP_DEPTH]))).toBe(true);
    expect(pts.some((p) => near(p, [50, 100 - CITY_CAP_DEPTH]))).toBe(true);
  });

  it('TILE-S: three-edge city is two overlapping half-square triangles sharing the localId', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-S')!;
    const cities = layoutRegions(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(2);
    expect(cities[0].localId).toBe(cities[1].localId);
    for (const c of cities) expect(c.points).toHaveLength(3);
    // Together they must cover the N edge centre deep into the tile.
    expect(cities.some((c) => pointInPolygon([50, 30], c.points))).toBe(true);
  });

  it('TILE-C: four-edge city is the full square', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-C')!;
    const cities = layoutRegions(proto).polygons.filter((r) => r.kind === 'CITY');
    expect(cities).toHaveLength(1);
    expect(polygonArea(cities[0].points)).toBeCloseTo(10000, 3);
  });
});

// ── Road layout ──────────────────────────────────────────────────────────────

describe('layoutRegions — roads', () => {
  it('anchors a centerline endpoint exactly at every ROAD edge slot', () => {
    for (const proto of PROTOS) {
      const regions = layoutRegions(proto);
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
      for (const road of layoutRegions(proto).roads) {
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
      const regions = layoutRegions(proto);
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
      const regions = layoutRegions(proto);
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

  it('TILE-V: curved road is a quarter arc of radius 50 around the SW corner', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-V')!;
    const roads = layoutRegions(proto).roads;
    expect(roads).toHaveLength(1);
    const line = roads[0].centerline;
    expect(line.length).toBeGreaterThanOrEqual(8);
    expect(near(line[0], [0, 50]) || near(line[line.length - 1], [0, 50])).toBe(true);
    expect(near(line[0], [50, 100]) || near(line[line.length - 1], [50, 100])).toBe(true);
    for (const [x, y] of line) {
      expect(Math.hypot(x - 0, y - 100)).toBeCloseTo(50, 6);
    }
  });

  it('TILE-W: three dead-end roads all meet at the tile centre', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-W')!;
    const roads = layoutRegions(proto).roads;
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
      const regions = layoutRegions(proto);
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
      const regions = layoutRegions(proto);
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
      const regions = layoutRegions(proto);
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
      const regions = layoutRegions(proto);
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
    const fields = layoutRegions(proto).polygons.filter((r) => r.kind === 'FIELD');
    expect(fields).toHaveLength(2);
    expect(fields[0].localId).toBe(fields[1].localId);
  });

  it('TILE-B: monastery tile has one large field covering nearly the whole tile', () => {
    const proto = PROTOS.find((p) => p.id === 'TILE-B')!;
    const fields = layoutRegions(proto).polygons.filter((r) => r.kind === 'FIELD');
    expect(fields).toHaveLength(1);
    expect(polygonArea(fields[0].points)).toBeGreaterThan(9000);
  });
});

// ── Determinism ──────────────────────────────────────────────────────────────

describe('layoutRegions — determinism', () => {
  it('produces identical output across invocations', () => {
    for (const proto of PROTOS) {
      expect(layoutRegions(proto)).toEqual(layoutRegions(proto));
    }
  });
});
