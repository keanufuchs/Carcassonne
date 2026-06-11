import { describe, it, expect } from 'vitest';
import {
  rectToRoad,
  rectToPolygon,
  lineToRoad,
  parsePolygonPoints,
  parsePathPolyline,
  sampleArc,
  shapesToRegions,
  type RawSegmentShape,
} from './svgRegions';

describe('rectToRoad (filled-rect roads → centreline + width)', () => {
  it('derives a horizontal centreline from a wide rect', () => {
    // tile-d road: x=0 y=45 w=100 h=10
    const { centerline, width } = rectToRoad({ x: '0', y: '45', width: '100', height: '10' });
    expect(width).toBe(10);
    expect(centerline).toEqual([[0, 50], [100, 50]]);
  });

  it('derives a vertical centreline from a tall rect', () => {
    // x=45 y=0 w=10 h=100
    const { centerline, width } = rectToRoad({ x: '45', y: '0', width: '10', height: '100' });
    expect(width).toBe(10);
    expect(centerline).toEqual([[50, 0], [50, 100]]);
  });
});

describe('lineToRoad', () => {
  it('reads endpoints and stroke width', () => {
    const { centerline, width } = lineToRoad({
      x1: '50', y1: '100', x2: '50', y2: '50', 'stroke-width': '10',
    });
    expect(centerline).toEqual([[50, 100], [50, 50]]);
    expect(width).toBe(10);
  });
});

describe('polygon / rect parsing (CITY/FIELD areas)', () => {
  it('parses a polygon points string', () => {
    expect(parsePolygonPoints('0,0 50,25 100,0')).toEqual([[0, 0], [50, 25], [100, 0]]);
  });

  it('turns a rect into four corners', () => {
    expect(rectToPolygon({ x: '0', y: '0', width: '100', height: '45' })).toEqual([
      [0, 0], [100, 0], [100, 45], [0, 45],
    ]);
  });
});

describe('path parsing with arcs', () => {
  it('keeps explicit M/L vertices', () => {
    const pts = parsePathPolyline('M 0,0 L 100,0 L 50,25 Z');
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[1]).toEqual([100, 0]);
    expect(pts[2]).toEqual([50, 25]);
  });

  it('samples a quarter-circle arc that ends at its stated endpoint', () => {
    // tile-v road arc: M 0,50 A 50,50 0 0,1 50,100
    const pts = parsePathPolyline('M 0,50 A 50,50 0 0,1 50,100');
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(50, 3);
    expect(last[1]).toBeCloseTo(100, 3);
    // This arc is centred on the SW corner (0,100) with r=50 (matches the
    // adjacent corner field's r=45 arc, also centred there).
    const mid = pts[Math.floor(pts.length / 2)];
    expect(Math.hypot(mid[0] - 0, mid[1] - 100)).toBeCloseTo(50, 0);
  });
});

describe('sampleArc', () => {
  it('produces points on the circle of radius r', () => {
    const pts = sampleArc([0, 50], 50, 50, 0, false, true, [50, 100], 8);
    for (const [x, y] of pts) {
      expect(Math.hypot(x - 0, y - 100)).toBeCloseTo(50, 4);
    }
  });
});

describe('shapesToRegions (aggregation by kind)', () => {
  it('routes each kind to the correct region bucket', () => {
    const shapes: RawSegmentShape[] = [
      { tagName: 'polygon', attrs: { points: '0,0 100,0 50,25' }, localId: 0, kind: 'CITY' },
      { tagName: 'rect', attrs: { x: '0', y: '45', width: '100', height: '10' }, localId: 1, kind: 'ROAD' },
      { tagName: 'circle', attrs: { cx: '50', cy: '50', r: '12' }, localId: 2, kind: 'MONASTERY' },
      { tagName: 'rect', attrs: { x: '0', y: '0', width: '100', height: '45' }, localId: 3, kind: 'FIELD' },
    ];
    const regions = shapesToRegions(shapes);
    expect(regions.polygons.map((p) => p.kind).sort()).toEqual(['CITY', 'FIELD']);
    expect(regions.roads).toHaveLength(1);
    expect(regions.roads[0].centerline).toEqual([[0, 50], [100, 50]]);
    expect(regions.markers).toHaveLength(1);
    expect(regions.markers[0].pos).toEqual([50, 50]);
  });
});
