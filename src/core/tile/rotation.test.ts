import { describe, it, expect } from 'vitest';
import { rotateSide, flipPos, opposite, stepCoord, rotateSlot, rotatedEdge } from './rotation';
import { TILE_D } from '../deck/tiles/tile-D';

describe('flipPos', () => {
  it('flips L↔R, keeps C', () => {
    expect(flipPos('L')).toBe('R');
    expect(flipPos('R')).toBe('L');
    expect(flipPos('C')).toBe('C');
  });
});

describe('opposite', () => {
  it('maps each side to its opposite', () => {
    expect(opposite('N')).toBe('S');
    expect(opposite('S')).toBe('N');
    expect(opposite('E')).toBe('W');
    expect(opposite('W')).toBe('E');
  });
});

describe('rotateSide', () => {
  it('N CW 90 → E', ()  => expect(rotateSide('N', 90)).toBe('E'));
  it('N CW 180 → S', () => expect(rotateSide('N', 180)).toBe('S'));
  it('N CW 270 → W', () => expect(rotateSide('N', 270)).toBe('W'));
  it('rotation 0 is identity', () => expect(rotateSide('W', 0)).toBe('W'));
});

describe('rotateSlot', () => {
  it('preserves pos, rotates side', () => {
    expect(rotateSlot({ side: 'N', pos: 'L' }, 90)).toEqual({ side: 'E', pos: 'L' });
    expect(rotateSlot({ side: 'N', pos: 'R' }, 90)).toEqual({ side: 'E', pos: 'R' });
  });
});

describe('stepCoord', () => {
  it('N decreases y', () => expect(stepCoord({ x: 0, y: 0 }, 'N')).toEqual({ x: 0, y: -1 }));
  it('E increases x', () => expect(stepCoord({ x: 0, y: 0 }, 'E')).toEqual({ x: 1, y:  0 }));
  it('S increases y', () => expect(stepCoord({ x: 0, y: 0 }, 'S')).toEqual({ x: 0, y:  1 }));
  it('W decreases x', () => expect(stepCoord({ x: 0, y: 0 }, 'W')).toEqual({ x:-1, y:  0 }));
});

describe('rotatedEdge', () => {
  it('TILE_D rotation 0: North edge is city', () => {
    const edge = rotatedEdge(TILE_D, 'N', 0);
    expect(edge).toEqual(['CITY', 'CITY', 'CITY']);
  });
  it('TILE_D rotation 90: East edge was North (now E facing)', () => {
    // After 90° CW, original N edge is now at E.
    const edge = rotatedEdge(TILE_D, 'E', 90);
    expect(edge).toEqual(['CITY', 'CITY', 'CITY']);
  });
});
