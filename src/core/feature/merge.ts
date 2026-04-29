import type { FeatureRegistry } from './segments';
import { retireFeature } from './segments';
import type { Feature } from './Feature';

export function unify(reg: FeatureRegistry, a: Feature, b: Feature): Feature {
  if (a.id === b.id) return a;
  const [winner, loser] = a.id < b.id ? [a, b] : [b, a];

  for (const k of loser.segments) {
    winner.segments.add(k);
    reg.segmentToFeature.set(k, winner.id);
  }

  winner.openEdges   += loser.openEdges;
  winner.shieldCount += loser.shieldCount;
  winner.meeples      = [...winner.meeples, ...loser.meeples];

  retireFeature(reg, loser.id);
  return winner;
}
