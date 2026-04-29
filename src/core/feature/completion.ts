import type { FeatureRegistry } from './segments';
import type { Feature } from './Feature';
import type { FeatureId } from '../types';

export function detectCompletions(
  reg: FeatureRegistry,
  touched: Iterable<FeatureId>,
): Feature[] {
  const out: Feature[] = [];
  for (const id of touched) {
    const f = reg.features.get(id);
    if (!f || f.completed) continue;

    if (f.kind === 'MONASTERY') {
      if ((f.monasterySurroundCount ?? 0) === 8) { f.completed = true; out.push(f); }
    } else if (f.kind !== 'FIELD') {
      if (f.openEdges === 0) { f.completed = true; out.push(f); }
    }
  }
  return out;
}
