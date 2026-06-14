import type { SegmentRef } from '../../core/types';
import type { SegmentShape } from './useTileSvgPaths';

/**
 * One clickable meeple target = one game feature on the placed tile.
 *
 * A single feature can be authored in the tile SVG as several shapes (e.g. a
 * city split by a road is two polygons sharing `localId`). Grouping them here
 * means the UI renders ONE hover/click zone per feature instead of one per
 * shape — fixing the "same feature shown as several separate areas" bug.
 *
 * `center` is the unrotated tile-percentage centroid of the segment. It backs
 * an always-present fallback hit area so a feature stays selectable even when
 * its SVG shape is missing, degenerate, or fully covered by another shape.
 */
export interface HitGroup {
  ref: SegmentRef;
  shapes: SegmentShape[];
  center: { x: number; y: number };
}

function hasField(group: HitGroup): boolean {
  return group.shapes.some(s => s.kind === 'FIELD');
}

export function buildHitGroups(
  shapes: SegmentShape[],
  targets: SegmentRef[],
  centers: Map<number, { x: number; y: number }>,
): HitGroup[] {
  const groups: HitGroup[] = targets.map(ref => ({
    ref,
    shapes: shapes.filter(s => s.localId === ref.localId),
    center: centers.get(ref.localId) ?? { x: 50, y: 50 },
  }));

  // FIELD groups paint first (beneath) so city/road shapes on top stay clickable.
  // Stable sort preserves the original target order within each layer.
  return groups.sort((a, b) => Number(hasField(b)) - Number(hasField(a)));
}
