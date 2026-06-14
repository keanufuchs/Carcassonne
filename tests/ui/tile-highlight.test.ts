import { describe, it, expect } from 'vitest';
import { parseSegmentLocalId, segmentClasses } from '../../src/ui/board/tileHighlight';

describe('parseSegmentLocalId', () => {
  it('parses the localId from a conforming segment id', () => {
    expect(parseSegmentLocalId('segment-CITY-0')).toBe(0);
    expect(parseSegmentLocalId('segment-FIELD-2')).toBe(2);
    expect(parseSegmentLocalId('segment-MONASTERY-0')).toBe(0);
  });

  it('returns null for non-conforming ids', () => {
    expect(parseSegmentLocalId('segment-FIELD')).toBeNull(); // missing localId
    expect(parseSegmentLocalId('background')).toBeNull();
    expect(parseSegmentLocalId('segment-CITY-x')).toBeNull(); // non-numeric
  });
});

describe('segmentClasses', () => {
  const targets = new Set([0, 1]);
  const highlights = new Set([1]);

  it('marks a placeable feature as a target', () => {
    expect(segmentClasses(0, targets, highlights)).toEqual(['tile-seg--target']);
  });

  it('marks the hovered feature as highlighted (and target if placeable)', () => {
    expect(segmentClasses(1, targets, highlights)).toEqual(['tile-seg--target', 'tile-seg--hl']);
  });

  it('returns no classes for a feature that is neither placeable nor hovered', () => {
    expect(segmentClasses(9, targets, highlights)).toEqual([]);
  });

  it('can highlight a non-target feature (e.g. cross-tile hover of a completed feature)', () => {
    expect(segmentClasses(5, new Set<number>(), new Set([5]))).toEqual(['tile-seg--hl']);
  });
});
