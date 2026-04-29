import type { PlayerId } from '../types';
import type { Feature } from '../feature/Feature';
import { majorityWinners } from './majority';
import { tileCount } from './midGame';

export function scoreIncompleteEndGame(f: Feature): { winners: PlayerId[]; points: number } {
  const winners = majorityWinners(f);
  let points: number;
  switch (f.kind) {
    case 'CITY':      points = tileCount(f) + f.shieldCount; break;
    case 'ROAD':      points = tileCount(f); break;
    case 'MONASTERY': points = 1 + (f.monasterySurroundCount ?? 0); break;
    case 'FIELD':     points = 0; break;
  }
  return { winners, points };
}
