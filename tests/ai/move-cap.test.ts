import { describe, it, expect } from 'vitest';
import { applyMoveCap, MOVE_DISPLAY_CAP } from '../../src/ai/boardAnalysis';

describe('applyMoveCap', () => {
  it('returns all moves unchanged when count is below cap', () => {
    const moves = Array.from({ length: 10 }, (_, i) => i);
    const result = applyMoveCap(moves);
    expect(result.moves).toHaveLength(10);
    expect(result.totalMoves).toBe(10);
  });

  it('truncates moves to MOVE_DISPLAY_CAP when count exceeds cap', () => {
    const moves = Array.from({ length: MOVE_DISPLAY_CAP + 15 }, (_, i) => i);
    const result = applyMoveCap(moves);
    expect(result.moves).toHaveLength(MOVE_DISPLAY_CAP);
    expect(result.totalMoves).toBe(MOVE_DISPLAY_CAP + 15);
  });

  it('signals truncation when totalMoves > moves.length', () => {
    const moves = Array.from({ length: MOVE_DISPLAY_CAP + 1 }, (_, i) => i);
    const result = applyMoveCap(moves);
    expect(result.totalMoves).toBeGreaterThan(result.moves.length);
  });

  it('does not signal truncation when all moves fit', () => {
    const moves = Array.from({ length: MOVE_DISPLAY_CAP }, (_, i) => i);
    const result = applyMoveCap(moves);
    expect(result.totalMoves).toBe(result.moves.length);
  });
});
