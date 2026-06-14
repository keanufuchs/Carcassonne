/**
 * Helpers for highlighting feature segments directly on the inline tile SVG.
 *
 * The tile is rendered as its real (inline) SVG, so each `segment-KIND-localId`
 * element keeps its original fill AND its original paint order. Highlighting is
 * therefore just a CSS class toggled on the real element — the shapes painted
 * on top (city/road over field) naturally clip the highlight to the visible
 * area of each feature, so highlights always match the drawn shapes.
 */

/** Extracts the numeric localId from a `segment-KIND-localId` element id. */
export function parseSegmentLocalId(id: string): number | null {
  const parts = id.split('-'); // ['segment', KIND, localId, ...]
  if (parts.length < 3) return null;
  const n = parseInt(parts[2], 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * CSS classes to apply to a segment element given the current interaction state.
 * - `tile-seg--target`: a placeable feature this turn (subtle persistent affordance)
 * - `tile-seg--hl`: the feature currently hovered (strong highlight)
 */
export function segmentClasses(
  localId: number,
  targets: ReadonlySet<number>,
  highlights: ReadonlySet<number>,
): string[] {
  const classes: string[] = [];
  if (targets.has(localId)) classes.push('tile-seg--target');
  if (highlights.has(localId)) classes.push('tile-seg--hl');
  return classes;
}
