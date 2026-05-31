import { describe, it, expect } from 'vitest';
import { BASE_GAME_DISTRIBUTION } from '../../src/core/deck/baseGameTiles';
import { rotateSide } from '../../src/core/tile/rotation';

describe('§8.3.1 TilePrototype structural invariants', () => {
  it('every prototype has segments with consecutive localIds starting at 0', () => {
    for (const { prototype } of BASE_GAME_DISTRIBUTION) {
      prototype.segments.forEach((seg, idx) => {
        expect(seg.localId, `${prototype.id} segment[${idx}].localId`).toBe(idx);
      });
    }
  });

  it('no two segments on the same tile share an edge slot', () => {
    for (const { prototype } of BASE_GAME_DISTRIBUTION) {
      const seen = new Set<string>();
      for (const seg of prototype.segments) {
        for (const slot of seg.edgeSlots) {
          const key = `${slot.side}${slot.pos}`;
          expect(seen.has(key), `${prototype.id} duplicate slot ${key}`).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it('non-monastery segments collectively cover all 12 edge slots', () => {
    const allSlots = ['NL', 'NC', 'NR', 'EL', 'EC', 'ER', 'SL', 'SC', 'SR', 'WL', 'WC', 'WR'];
    for (const { prototype } of BASE_GAME_DISTRIBUTION) {
      const found = new Set<string>();
      for (const seg of prototype.segments) {
        if (seg.kind === 'MONASTERY') continue;
        for (const slot of seg.edgeSlots) {
          found.add(slot.side + slot.pos);
        }
      }
      expect([...found].sort(), `${prototype.id} missing edge slots`).toEqual(allSlots.sort());
    }
  });

  it('rotating a side 4× returns to itself', () => {
    expect(rotateSide('N', 0)).toBe('N');
    let side: 'N' | 'E' | 'S' | 'W' = 'N';
    for (let i = 0; i < 4; i++) side = rotateSide(side, 90) as typeof side;
    expect(side).toBe('N');
  });
});
