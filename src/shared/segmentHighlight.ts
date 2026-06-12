import type { SegmentKind } from '../core/types/tile';

/**
 * Shared segment-highlight semantics for the 2D inline SVG board and the 3D
 * tile lab. CSS class names map to the rules in `src/ui/board/board.css`; the
 * numeric visual constants mirror `.tile-seg--hl`.
 */
export const SEGMENT_HIGHLIGHT = {
  /** Matches `.tile-seg--hl` filter: brightness(1.22) */
  brightness: 1.22,
  /** Matches `.tile-seg--hl` filter: saturate(1.35) */
  saturation: 1.35,
  /** Gold glow from the `.tile-seg--hl` drop-shadow */
  glowColor: '#ffd700',
  glowOpacity: 0.42,
} as const;

/** Builds a conforming `segment-KIND-localId` element id. */
export function segmentElementId(kind: SegmentKind, localId: number): string {
  return `segment-${kind}-${localId}`;
}

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

/** Per-segment localIds to highlight for a hover (single tile — no feature graph). */
export function highlightLocalIdsForSegment(localId: number): number[] {
  return [localId];
}
