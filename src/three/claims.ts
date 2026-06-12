import type { SegmentKind } from '../core/types/tile';

/**
 * Ownership claims for the banner-based visualization. Framework-free: the lab
 * UI and the Three.js marker builder both consume this, no React/THREE here.
 * See docs/superpowers/specs/2026-06-12-banner-ownership-visualization-design.md.
 */

/** Identifies a claimable feature on a tile. */
export interface SegmentRef {
  localId: number;
  kind: SegmentKind;
}

/** A claimed feature owned by a player (index into PLAYER_COLORS). */
export interface FeatureClaim extends SegmentRef {
  playerIndex: number;
}

/** Active claims on a tile, keyed by feature `localId`. */
export type ClaimMap = ReadonlyMap<number, FeatureClaim>;

/**
 * Click-toggle reducer for the lab's "active player" interaction:
 * - unclaimed            → claim for the active player
 * - owned by active      → remove the claim
 * - owned by another     → reassign to the active player
 * Returns a new map; never mutates the input.
 */
export function nextClaims(claims: ClaimMap, ref: SegmentRef, activePlayer: number): ClaimMap {
  const next = new Map(claims);
  const existing = next.get(ref.localId);
  if (existing && existing.playerIndex === activePlayer) {
    next.delete(ref.localId);
  } else {
    next.set(ref.localId, { localId: ref.localId, kind: ref.kind, playerIndex: activePlayer });
  }
  return next;
}
