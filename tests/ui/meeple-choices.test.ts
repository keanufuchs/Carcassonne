import { describe, it, expect } from 'vitest';
import {
  buildMeepleChoices,
  MEEPLE_KIND_LABEL,
  MEEPLE_KIND_GLYPH,
} from '../../src/ui/hud/meepleChoices';
import type { SegmentInstance } from '../../src/core/tile/Tile';
import type { SegmentKind, SegmentRef } from '../../src/core/types';

const TILE = 'tile-1';

function seg(localId: number, kind: SegmentKind): SegmentInstance {
  return { ref: { tileId: TILE, localId }, kind };
}

function ref(localId: number): SegmentRef {
  return { tileId: TILE, localId };
}

describe('buildMeepleChoices', () => {
  const segments: SegmentInstance[] = [
    seg(0, 'CITY'),
    seg(1, 'ROAD'),
    seg(2, 'FIELD'),
    seg(3, 'MONASTERY'),
  ];

  it('pairs each target ref with the kind of its segment', () => {
    const choices = buildMeepleChoices([ref(0), ref(3)], segments);
    expect(choices).toEqual([
      { ref: ref(0), kind: 'CITY' },
      { ref: ref(3), kind: 'MONASTERY' },
    ]);
  });

  it('preserves target order so list numbering stays stable', () => {
    const choices = buildMeepleChoices([ref(2), ref(1), ref(0)], segments);
    expect(choices.map(c => c.kind)).toEqual(['FIELD', 'ROAD', 'CITY']);
  });

  it('drops targets whose segment is absent from the tile', () => {
    const choices = buildMeepleChoices([ref(0), ref(99)], segments);
    expect(choices).toEqual([{ ref: ref(0), kind: 'CITY' }]);
  });

  it('returns an empty list when there are no targets', () => {
    expect(buildMeepleChoices([], segments)).toEqual([]);
  });

  it('provides a label and glyph for every segment kind', () => {
    const kinds: SegmentKind[] = ['CITY', 'ROAD', 'FIELD', 'MONASTERY'];
    for (const kind of kinds) {
      expect(MEEPLE_KIND_LABEL[kind]).toBeTruthy();
      expect(MEEPLE_KIND_GLYPH[kind]).toBeTruthy();
    }
  });
});
