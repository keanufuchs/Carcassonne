import type { FeatureId, SegmentRef } from '../types';
import { segmentKey } from '../types';
import type { Feature, FeatureKind } from './Feature';

export interface FeatureRegistry {
  features: Map<FeatureId, Feature>;
  segmentToFeature: Map<string, FeatureId>;
  nextId: number;
}

export function createRegistry(): FeatureRegistry {
  return { features: new Map(), segmentToFeature: new Map(), nextId: 1 };
}

export function createFeature(reg: FeatureRegistry, kind: FeatureKind): Feature {
  const id = `F${reg.nextId++}`;
  const f: Feature = {
    id, kind,
    segments: new Set(),
    openEdges: 0,
    meeples: [],
    shieldCount: 0,
    completed: false,
  };
  reg.features.set(id, f);
  return f;
}

export function attachSegment(reg: FeatureRegistry, feature: Feature, ref: SegmentRef): void {
  const k = segmentKey(ref);
  feature.segments.add(k);
  reg.segmentToFeature.set(k, feature.id);
}

export function lookupBySegment(reg: FeatureRegistry, ref: SegmentRef): Feature {
  const key = segmentKey(ref);
  const fid = reg.segmentToFeature.get(key);
  if (!fid) throw new Error(`No feature for segment ${key}`);
  const f = reg.features.get(fid);
  if (!f) throw new Error(`Feature ${fid} not found in registry`);
  return f;
}

export function retireFeature(reg: FeatureRegistry, id: FeatureId): void {
  reg.features.delete(id);
}
