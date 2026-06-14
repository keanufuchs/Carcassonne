import { describe, it, expect } from 'vitest';
import { buildHitGroups } from '../../src/ui/board/hitGroups';
import type { SegmentShape } from '../../src/ui/board/useTileSvgPaths';

const shape = (kind: SegmentShape['kind'], localId: number, tagName: SegmentShape['tagName'] = 'rect'): SegmentShape => ({
  tagName,
  attrs: {},
  localId,
  kind,
});

describe('buildHitGroups', () => {
  it('produces exactly one group per target feature', () => {
    const shapes = [shape('CITY', 0), shape('FIELD', 1)];
    const targets = [{ tileId: 't1', localId: 0 }, { tileId: 't1', localId: 1 }];
    const groups = buildHitGroups(shapes, targets, new Map());
    expect(groups).toHaveLength(2);
  });

  it('collapses a feature drawn as multiple SVG shapes (split city) into ONE group', () => {
    // tile-r style: CITY localId 0 drawn as two polygons
    const shapes = [shape('CITY', 0, 'polygon'), shape('CITY', 0, 'polygon'), shape('FIELD', 1)];
    const targets = [{ tileId: 't1', localId: 0 }, { tileId: 't1', localId: 1 }];
    const groups = buildHitGroups(shapes, targets, new Map());

    const city = groups.find(g => g.ref.localId === 0)!;
    expect(groups).toHaveLength(2);            // ONE group for the split city, not two
    expect(city.shapes).toHaveLength(2);       // but it still carries both shapes to render
  });

  it('orders FIELD groups first so they paint beneath cities/roads', () => {
    const shapes = [shape('CITY', 0), shape('ROAD', 1), shape('FIELD', 2)];
    const targets = [
      { tileId: 't1', localId: 0 },
      { tileId: 't1', localId: 1 },
      { tileId: 't1', localId: 2 },
    ];
    const groups = buildHitGroups(shapes, targets, new Map());
    expect(groups[0].ref.localId).toBe(2);     // FIELD first (bottom layer)
  });

  it('still yields a selectable group with a fallback center when the SVG has no matching shape', () => {
    const shapes: SegmentShape[] = []; // SVG missing / malformed
    const targets = [{ tileId: 't1', localId: 0 }];
    const centers = new Map([[0, { x: 30, y: 70 }]]);
    const groups = buildHitGroups(shapes, targets, centers);

    expect(groups).toHaveLength(1);
    expect(groups[0].shapes).toHaveLength(0);  // no shapes…
    expect(groups[0].center).toEqual({ x: 30, y: 70 }); // …but a clickable fallback center
  });

  it('defaults the fallback center to the tile center (50,50) when none is supplied', () => {
    const shapes = [shape('MONASTERY', 0, 'circle')];
    const targets = [{ tileId: 't1', localId: 0 }];
    const groups = buildHitGroups(shapes, targets, new Map());
    expect(groups[0].center).toEqual({ x: 50, y: 50 });
  });
});
