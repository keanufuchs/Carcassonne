import type { PlayerId, TileId } from '../types';
import { parseSegmentKey } from '../types';
import type { Feature } from '../feature/Feature';
import { majorityWinners } from './majority';

export function scoreCompletedMidGame(f: Feature): { winners: PlayerId[]; points: number } {
  return { winners: majorityWinners(f), points: pointsForCompleted(f) };
}

function pointsForCompleted(f: Feature): number {
  switch (f.kind) {
    case 'CITY':      return 2 * (tileCount(f) + f.shieldCount);
    case 'ROAD':      return tileCount(f);
    case 'MONASTERY': return 9;
    case 'FIELD':     throw new Error('Fields do not complete mid-game');
  }
}

export function tileCount(f: Feature): number {
  const tiles = new Set<TileId>();
  for (const k of f.segments) tiles.add(parseSegmentKey(k).tileId);
  return tiles.size;
}
