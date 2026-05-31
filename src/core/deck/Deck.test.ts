import { describe, it, expect } from 'vitest';
import { shuffle, hasRemaining, drawNext, drawPlaceable } from './Deck';
import type { Deck } from './Deck';
import type { TilePrototype } from '../types/tile';

function makeTile(id: string): TilePrototype {
  return {
    id,
    segments: [],
    file: `${id}.svg`,
    edges: { N: ['FIELD', 'FIELD', 'FIELD'], S: ['FIELD', 'FIELD', 'FIELD'], E: ['FIELD', 'FIELD', 'FIELD'], W: ['FIELD', 'FIELD', 'FIELD'] },
    hasMonastery: false,
    hasShield: false,
    farmSegments: [],
    connectCitySegments: [],
  };
}

function makeDeck(tileIds: string[]): Deck {
  return { startTile: makeTile('start'), remaining: tileIds.map(makeTile) };
}

describe('Deck', () => {
  describe('shuffle', () => {
    it('preserves all tiles after shuffle', () => {
      const deck = makeDeck(['t1', 't2', 't3', 't4', 't5']);
      const before = new Set(deck.remaining.map(t => t.id));
      shuffle(deck, Math.random);
      const after = new Set(deck.remaining.map(t => t.id));
      expect(after).toEqual(before);
    });

    it('preserves deck length', () => {
      const deck = makeDeck(['t1', 't2', 't3']);
      shuffle(deck, Math.random);
      expect(deck.remaining).toHaveLength(3);
    });

    it('produces deterministic order with fixed RNG', () => {
      const deck = makeDeck(['t1', 't2', 't3']);
      shuffle(deck, () => 0.5);
      expect(deck.remaining.map(t => t.id)).toEqual(['t1', 't3', 't2']);
    });
  });

  describe('hasRemaining', () => {
    it('returns true when deck has tiles', () => {
      expect(hasRemaining(makeDeck(['t1']))).toBe(true);
    });

    it('returns false when deck is empty', () => {
      expect(hasRemaining(makeDeck([]))).toBe(false);
    });
  });

  describe('drawNext', () => {
    it('returns first tile from remaining', () => {
      const deck = makeDeck(['t1', 't2']);
      const tile = drawNext(deck);
      expect(tile).not.toBeNull();
      expect(tile!.id).toBe('t1');
      expect(deck.remaining.map(t => t.id)).toEqual(['t2']);
    });

    it('returns null when deck is empty', () => {
      expect(drawNext(makeDeck([]))).toBeNull();
    });
  });

  describe('drawPlaceable', () => {
    it('returns first tile when all are placeable', () => {
      const deck = makeDeck(['t1', 't2']);
      const tile = drawPlaceable(deck, () => true);
      expect(tile).not.toBeNull();
      expect(tile!.id).toBe('t1');
      expect(deck.remaining.map(t => t.id)).toEqual(['t2']);
    });

    it('skips unplaceable tiles', () => {
      const deck = makeDeck(['t1', 't2', 't3']);
      const tile = drawPlaceable(deck, (t) => t.id !== 't1');
      expect(tile).not.toBeNull();
      expect(tile!.id).toBe('t2');
      expect(deck.remaining.map(t => t.id)).toEqual(['t3']);
    });

    it('returns null when all remaining tiles are unplaceable', () => {
      const deck = makeDeck(['t1', 't2']);
      expect(drawPlaceable(deck, () => false)).toBeNull();
      expect(deck.remaining).toHaveLength(0);
    });

    it('returns null for empty deck', () => {
      expect(drawPlaceable(makeDeck([]), () => true)).toBeNull();
    });
  });
});