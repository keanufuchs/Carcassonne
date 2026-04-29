import type { TilePrototype } from '../types/tile';

export interface Deck {
  startTile: TilePrototype;
  remaining: TilePrototype[];
}

export function shuffle(deck: Deck, rng: () => number): void {
  const arr = deck.remaining;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function hasRemaining(deck: Deck): boolean {
  return deck.remaining.length > 0;
}

export function drawNext(deck: Deck): TilePrototype | null {
  return deck.remaining.shift() ?? null;
}

export function drawPlaceable(
  deck: Deck,
  isPlaceable: (t: TilePrototype) => boolean,
): TilePrototype | null {
  while (hasRemaining(deck)) {
    const tile = drawNext(deck)!;
    if (isPlaceable(tile)) return tile;
  }
  return null;
}
