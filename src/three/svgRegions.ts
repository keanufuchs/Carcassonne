import type { SegmentKind } from '../core/types/tile';
import { parseSegmentLocalId } from '../shared/segmentHighlight';
import { ROAD_DEFAULT_WIDTH } from './palette';

/**
 * Converts a tile's SVG geometry into normalised, framework-independent
 * segment regions. The SVG is treated as a *boundary/mask* (where each segment
 * lies on the 0..100 tile), NOT as a mesh source — the 3D geometry is generated
 * procedurally from these regions plus the TS topology.
 *
 * Coordinates here stay in raw SVG space (0..100, y-down). The Three.js builder
 * (`generateTile.ts`) maps them into the 1×1 world footprint.
 */

export type Vec2 = [number, number];

/** Filled area segments (CITY, FIELD) → a closed 2D polygon. */
export interface PolygonRegion {
  localId: number;
  kind: SegmentKind;
  points: Vec2[];
}

/** ROAD segments → a centreline polyline plus a width (a ribbon, not an area). */
export interface RoadRegion {
  localId: number;
  centerline: Vec2[];
  width: number;
}

/** MONASTERY segments → a placement point for a building (not an area). */
export interface MarkerRegion {
  localId: number;
  pos: Vec2;
  radius: number;
}

export interface TileRegions {
  polygons: PolygonRegion[];
  roads: RoadRegion[];
  markers: MarkerRegion[];
}

/** A raw `segment-*` SVG element, decoupled from the DOM for pure processing. */
export interface RawSegmentShape {
  tagName: 'rect' | 'polygon' | 'path' | 'circle' | 'line';
  attrs: Record<string, string>;
  localId: number;
  kind: SegmentKind;
}

// ── Number / attribute helpers ──────────────────────────────────────────────

const num = (v: string | undefined, fallback = 0): number => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
};

// ── Shape → geometry converters (all pure, DOM-free) ────────────────────────

/** `points="x,y x,y …"` → polygon vertices. */
export function parsePolygonPoints(points: string): Vec2[] {
  return points
    .trim()
    .split(/\s+/)
    .map((pair): Vec2 => {
      const [x, y] = pair.split(',').map(Number);
      return [x, y];
    })
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

/** A `<rect>` → its four corners (used for CITY/FIELD rectangles). */
export function rectToPolygon(attrs: Record<string, string>): Vec2[] {
  const x = num(attrs.x);
  const y = num(attrs.y);
  const w = num(attrs.width);
  const h = num(attrs.height);
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/**
 * A road drawn as a filled `<rect>` → centreline along the longer axis, with
 * the width taken from the shorter axis.
 */
export function rectToRoad(attrs: Record<string, string>): { centerline: Vec2[]; width: number } {
  const x = num(attrs.x);
  const y = num(attrs.y);
  const w = num(attrs.width);
  const h = num(attrs.height);
  if (w >= h) {
    return { centerline: [[x, y + h / 2], [x + w, y + h / 2]], width: h };
  }
  return { centerline: [[x + w / 2, y], [x + w / 2, y + h]], width: w };
}

/** A road drawn as a `<line>` → centreline endpoints + stroke width. */
export function lineToRoad(attrs: Record<string, string>): { centerline: Vec2[]; width: number } {
  return {
    centerline: [
      [num(attrs.x1), num(attrs.y1)],
      [num(attrs.x2), num(attrs.y2)],
    ],
    width: num(attrs['stroke-width'], ROAD_DEFAULT_WIDTH),
  };
}

/**
 * Samples an SVG elliptical-arc segment (endpoint parameterisation, per the
 * W3C spec) into a polyline. All tile arcs are circular (rx=ry, rotation=0),
 * but this handles the general case.
 */
export function sampleArc(
  p0: Vec2,
  rx: number,
  ry: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  p1: Vec2,
  segments = 16,
): Vec2[] {
  const rad = (xAxisRotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  let rxa = Math.abs(rx);
  let rya = Math.abs(ry);
  const lambda = (x1p * x1p) / (rxa * rxa) + (y1p * y1p) / (rya * rya);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxa *= s;
    rya *= s;
  }

  const sign = largeArc !== sweep ? 1 : -1;
  const numerator = Math.max(
    rxa * rxa * rya * rya - rxa * rxa * y1p * y1p - rya * rya * x1p * x1p,
    0,
  );
  const denom = rxa * rxa * y1p * y1p + rya * rya * x1p * x1p;
  const coef = sign * Math.sqrt(numerator / denom);
  const cxp = (coef * (rxa * y1p)) / rya;
  const cyp = (coef * -(rya * x1p)) / rxa;
  const cx = cos * cxp - sin * cyp + (p0[0] + p1[0]) / 2;
  const cy = sin * cxp + cos * cyp + (p0[1] + p1[1]) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };

  const ux = (x1p - cxp) / rxa;
  const uy = (y1p - cyp) / rya;
  const theta1 = angle(1, 0, ux, uy);
  let dTheta = angle(ux, uy, (-x1p - cxp) / rxa, (-y1p - cyp) / rya);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const out: Vec2[] = [];
  for (let i = 1; i <= segments; i++) {
    const t = theta1 + dTheta * (i / segments);
    const x = cos * rxa * Math.cos(t) - sin * rya * Math.sin(t) + cx;
    const y = sin * rxa * Math.cos(t) + cos * rya * Math.sin(t) + cy;
    out.push([x, y]);
  }
  return out;
}

/** Parses an SVG path `d` (M/L/A/Z only, as used by the tiles) into a polyline. */
export function parsePathPolyline(d: string): Vec2[] {
  const tokens = d.match(/[MLAZmlaz]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const pts: Vec2[] = [];
  let cur: Vec2 = [0, 0];
  let i = 0;
  const next = (): number => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M':
      case 'L':
      case 'm':
      case 'l': {
        cur = [next(), next()];
        pts.push(cur);
        break;
      }
      case 'A':
      case 'a': {
        const rx = next();
        const ry = next();
        const rot = next();
        const largeArc = next() !== 0;
        const sweep = next() !== 0;
        const end: Vec2 = [next(), next()];
        pts.push(...sampleArc(cur, rx, ry, rot, largeArc, sweep, end));
        cur = end;
        break;
      }
      // 'Z'/'z' closes the polygon implicitly — nothing to push.
    }
  }
  return pts;
}

// ── Aggregation ─────────────────────────────────────────────────────────────

/** Converts raw segment shapes into normalised tile regions (pure). */
export function shapesToRegions(shapes: RawSegmentShape[]): TileRegions {
  const regions: TileRegions = { polygons: [], roads: [], markers: [] };

  for (const { tagName, attrs, localId, kind } of shapes) {
    if (kind === 'MONASTERY') {
      regions.markers.push({
        localId,
        pos: [num(attrs.cx, 50), num(attrs.cy, 50)],
        radius: num(attrs.r, 12),
      });
      continue;
    }

    if (kind === 'ROAD') {
      if (tagName === 'rect') {
        regions.roads.push({ localId, ...rectToRoad(attrs) });
      } else if (tagName === 'line') {
        regions.roads.push({ localId, ...lineToRoad(attrs) });
      } else if (tagName === 'path') {
        regions.roads.push({
          localId,
          centerline: parsePathPolyline(attrs.d ?? ''),
          width: num(attrs['stroke-width'], ROAD_DEFAULT_WIDTH),
        });
      }
      continue;
    }

    // CITY / FIELD → filled polygon
    let points: Vec2[] = [];
    if (tagName === 'polygon') points = parsePolygonPoints(attrs.points ?? '');
    else if (tagName === 'rect') points = rectToPolygon(attrs);
    else if (tagName === 'path') points = parsePathPolyline(attrs.d ?? '');
    if (points.length >= 3) regions.polygons.push({ localId, kind, points });
  }

  return regions;
}

/**
 * Browser-only: extracts `segment-*` elements from raw SVG markup via DOMParser
 * (mirrors the existing parser in `src/ui/board/useTileSvgPaths.ts`), then
 * normalises them. Kept separate from `shapesToRegions` so the geometry math
 * can be unit-tested without a DOM.
 */
export function parseTileRegions(svgMarkup: string): TileRegions {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const elements = doc.querySelectorAll('[id^="segment-"]');
  const shapes: RawSegmentShape[] = [];
  elements.forEach((el) => {
    const id = el.getAttribute('id') ?? '';
    const parts = id.split('-');
    if (parts.length < 3) return;
    const kind = parts[1] as SegmentKind;
    const localId = parseSegmentLocalId(id);
    if (localId === null) return;
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) attrs[attr.name] = attr.value;
    shapes.push({
      tagName: el.tagName.toLowerCase() as RawSegmentShape['tagName'],
      attrs,
      localId,
      kind,
    });
  });
  return shapesToRegions(shapes);
}
