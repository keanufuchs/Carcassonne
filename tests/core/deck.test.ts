import { describe, it, expect } from 'vitest';
import { drawPlaceable, drawNext, hasRemaining } from '../../src/core/deck/Deck';
import {
  BASE_GAME_DISTRIBUTION,
  BASE_GAME_DECK_COUNTS,
  START_TILE,
  buildRemainingTiles,
} from '../../src/core/deck/baseGameTiles';
import { TILE_B } from '../../src/core/deck/tiles/tile-B';
import { TILE_D } from '../../src/core/deck/tiles/tile-D';
import { TILE_U } from '../../src/core/deck/tiles/tile-U';
import type { Deck } from '../../src/core/deck/Deck';

// ─── §8.3.9 Deck & unplaceable tile handling ─────────────────────────────

describe('base-game tile distribution', () => {
  it('contains 72 land tiles in the box', () => {
    const total = BASE_GAME_DISTRIBUTION.reduce((sum, { count }) => sum + count, 0);
    expect(total).toBe(72);
  });

  it('builds a 71-tile draw pile excluding the start tile', () => {
    const remaining = buildRemainingTiles();
    expect(remaining).toHaveLength(71);
    expect(remaining.filter(t => t.id === START_TILE.id)).toHaveLength(3);
    expect(BASE_GAME_DECK_COUNTS['TILE-D']).toBe(3);
  });
});

describe('§8.3.9 Deck and unplaceable tile handling', () => {
  it('drawPlaceable skips an unplaceable tile and returns the next one', () => {
    const deck: Deck = { startTile: TILE_D, remaining: [TILE_B, TILE_U] };
    const unplaceable = new Set([TILE_B.id]);
    const result = drawPlaceable(deck, t => !unplaceable.has(t.id));
    expect(result).toBe(TILE_U);
    expect(deck.remaining).toHaveLength(0);
  });

  it('drawPlaceable returns null when all remaining tiles are unplaceable', () => {
    const deck: Deck = { startTile: TILE_D, remaining: [TILE_B, TILE_B] };
    const result = drawPlaceable(deck, () => false);
    expect(result).toBeNull();
    expect(deck.remaining).toHaveLength(0);
  });

  it('drawPlaceable returns null for an empty deck', () => {
    const deck: Deck = { startTile: TILE_D, remaining: [] };
    expect(drawPlaceable(deck, () => true)).toBeNull();
  });

  it('drawNext removes and returns the first tile', () => {
    const deck: Deck = { startTile: TILE_D, remaining: [TILE_B, TILE_U] };
    expect(drawNext(deck)).toBe(TILE_B);
    expect(deck.remaining).toHaveLength(1);
  });

  it('drawNext returns null when deck is empty', () => {
    const deck: Deck = { startTile: TILE_D, remaining: [] };
    expect(drawNext(deck)).toBeNull();
  });

  it('hasRemaining reflects deck state after draws', () => {
    const deck: Deck = { startTile: TILE_D, remaining: [TILE_B] };
    expect(hasRemaining(deck)).toBe(true);
    drawNext(deck);
    expect(hasRemaining(deck)).toBe(false);
  });
});
