import type { SegmentInstance } from '../../core/tile/Tile';
import type { SegmentKind, SegmentRef } from '../../core/types';

/** A valid meeple placement enriched with the segment kind for labelling. */
export interface MeepleChoice {
  ref: SegmentRef;
  kind: SegmentKind;
}

/** Human-readable label per feature kind (mirrors the in-game terminology). */
export const MEEPLE_KIND_LABEL: Record<SegmentKind, string> = {
  CITY: 'City',
  ROAD: 'Road',
  MONASTERY: 'Monastery',
  FIELD: 'Field',
};

/** Quick-recognition glyph per feature kind. */
export const MEEPLE_KIND_GLYPH: Record<SegmentKind, string> = {
  CITY: '🏰',
  ROAD: '🛣️',
  MONASTERY: '⛪',
  FIELD: '🌾',
};

/**
 * Pairs each valid meeple target with the kind of the segment it sits on, so the
 * mobile choice list can label entries ("Road", "City", …). Targets whose segment
 * is missing from the tile are dropped defensively. See issue #34.
 */
export function buildMeepleChoices(
  targets: readonly SegmentRef[],
  segmentInstances: readonly SegmentInstance[],
): MeepleChoice[] {
  const kindByLocalId = new Map(segmentInstances.map(s => [s.ref.localId, s.kind]));
  return targets.flatMap(ref => {
    const kind = kindByLocalId.get(ref.localId);
    return kind ? [{ ref, kind }] : [];
  });
}
