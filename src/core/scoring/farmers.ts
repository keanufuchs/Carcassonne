import type { FeatureId, PlayerId } from '../types';
import { parseSegmentKey } from '../types';
import type { Feature } from '../feature/Feature';
import type { FeatureRegistry } from '../feature/segments';
import { majorityWinners } from './majority';
import type { PlacedTile } from '../tile/Tile';

export function scoreFarmers(
  reg: FeatureRegistry,
  tileById: Map<string, PlacedTile>,
): Array<{ winners: PlayerId[]; points: number; fieldId: FeatureId }> {
  const out: Array<{ winners: PlayerId[]; points: number; fieldId: FeatureId }> = [];
  for (const f of reg.features.values()) {
    if (f.kind !== 'FIELD') continue;
    if (f.meeples.length === 0) continue;
    const adjacent = computeAdjacentCompletedCities(reg, f, tileById);
    out.push({ winners: majorityWinners(f), points: adjacent.size * 3, fieldId: f.id });
  }
  return out;
}

function computeAdjacentCompletedCities(
  reg: FeatureRegistry,
  field: Feature,
  tileById: Map<string, PlacedTile>,
): Set<FeatureId> {
  const adjacent = new Set<FeatureId>();
  const fieldTiles = new Set<string>();
  for (const k of field.segments) fieldTiles.add(parseSegmentKey(k).tileId);

  for (const tileId of fieldTiles) {
    const placed = tileById.get(tileId);
    if (!placed) continue;
    for (const inst of placed.segmentInstances) {
      if (inst.kind !== 'CITY') continue;
      const key = `${inst.ref.tileId}#${inst.ref.localId}`;
      const fid = reg.segmentToFeature.get(key);
      if (!fid) continue;
      const cityFeature = reg.features.get(fid);
      if (cityFeature?.completed) adjacent.add(fid);
    }
  }
  return adjacent;
}
