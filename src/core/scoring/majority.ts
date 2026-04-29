import type { PlayerId } from '../types';
import type { Feature } from '../feature/Feature';

export function majorityWinners(feature: Feature): PlayerId[] {
  if (feature.meeples.length === 0) return [];
  const counts = new Map<PlayerId, number>();
  for (const m of feature.meeples) {
    counts.set(m.playerId, (counts.get(m.playerId) ?? 0) + 1);
  }
  const max = Math.max(...counts.values());
  return [...counts.entries()].filter(([, c]) => c === max).map(([p]) => p);
}
