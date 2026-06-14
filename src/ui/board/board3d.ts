import * as THREE from 'three';
import type { PlacedTile } from '../../core/tile/Tile';
import type { Feature } from '../../core/feature/Feature';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player, TileId } from '../../core/types';
import { parseSegmentKey, segmentKey, PLAYER_COLORS } from '../../core/types';
import type { TilePrototype } from '../../core/types/tile';
import type { ClaimMap, FeatureClaim } from '../../three/claims';
import { SEGMENT_HIGHLIGHT } from '../../shared/segmentHighlight';
import { START_TILE, BASE_GAME_DISTRIBUTION } from '../../core/deck/baseGameTiles';

/**
 * Shared, framework-free helpers for the 3D board: prototype lookup, meeple /
 * claim derivation from the live game state, and THREE object housekeeping.
 * Kept out of the React components so they stay focused on rendering.
 */

// ── Prototype lookup ─────────────────────────────────────────────────────────

const PROTOTYPE_BY_ID: Map<string, TilePrototype> = (() => {
  const map = new Map<string, TilePrototype>();
  map.set(START_TILE.id, START_TILE);
  for (const { prototype } of BASE_GAME_DISTRIBUTION) map.set(prototype.id, prototype);
  return map;
})();

/** Resolves a `PlacedTile.prototypeId` back to its full prototype. */
export function getPrototype(prototypeId: string): TilePrototype {
  const proto = PROTOTYPE_BY_ID.get(prototypeId);
  if (!proto) throw new Error(`Unknown tile prototype: ${prototypeId}`);
  return proto;
}

// ── Feature ownership → per-tile claims ──────────────────────────────────────

export const playerColor = (i: number): string =>
  PLAYER_COLORS[((i % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];

/**
 * The player who controls a feature: the one with the most meeples on it. Ties
 * resolve to the lowest player index (deterministic). Returns -1 when unclaimed.
 */
export function controllingPlayerIndex(feature: Feature, players: Player[]): number {
  const counts = new Map<number, number>();
  for (const m of feature.meeples) {
    const idx = players.findIndex((p) => p.id === m.playerId);
    const playerIndex = idx < 0 ? 0 : idx;
    counts.set(playerIndex, (counts.get(playerIndex) ?? 0) + 1);
  }
  let bestIdx = -1;
  let bestCount = 0;
  for (const [idx, count] of counts) {
    if (count > bestCount || (count === bestCount && (bestIdx === -1 || idx < bestIdx))) {
      bestIdx = idx;
      bestCount = count;
    }
  }
  return bestIdx;
}

/** The localIds of `feature` that live on `tileId` (a feature may span tiles). */
export function featureLocalIdsOnTile(feature: Feature, tileId: TileId): Set<number> {
  const out = new Set<number>();
  for (const key of feature.segments) {
    const seg = parseSegmentKey(key);
    if (seg.tileId === tileId) out.add(seg.localId);
  }
  return out;
}

/**
 * One claim per segment on this tile whose feature is owned — derived from
 * feature membership, not meeple location, so every tile of a claimed feature
 * carries the controlling player's banner/lantern.
 */
export function tileClaims(placed: PlacedTile, registry: FeatureRegistry, players: Player[]): ClaimMap {
  const map = new Map<number, FeatureClaim>();
  for (const seg of placed.segmentInstances) {
    const fid = registry.segmentToFeature.get(segmentKey(seg.ref));
    const feature = fid ? registry.features.get(fid) : undefined;
    if (!feature || feature.meeples.length === 0) continue;
    const playerIndex = controllingPlayerIndex(feature, players);
    if (playerIndex < 0) continue;
    map.set(seg.ref.localId, { localId: seg.ref.localId, kind: seg.kind, playerIndex });
  }
  return map;
}

/**
 * The colour to glow a hovered feature: gold while placing a meeple, otherwise
 * the controlling player's colour (gold if the feature is unclaimed).
 */
export function featureHighlightColor(feature: Feature, players: Player[], meeplePhase: boolean): string {
  if (meeplePhase) return SEGMENT_HIGHLIGHT.glowColor;
  const idx = controllingPlayerIndex(feature, players);
  return idx < 0 ? SEGMENT_HIGHLIGHT.glowColor : playerColor(idx);
}

/** A stable signature so claim markers only rebuild when ownership changes. */
export function claimsSignature(claims: ClaimMap): string {
  return [...claims.values()]
    .map((c) => `${c.localId}:${c.playerIndex}`)
    .sort()
    .join(',');
}

// ── THREE housekeeping ───────────────────────────────────────────────────────

/** Recursively disposes geometries and materials of a generated group. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose?.();
  });
}

/** Makes every material in a group translucent at the given opacity (ghost tile). */
export function setGroupOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((obj) => {
    const material = (obj as THREE.Mesh).material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const m of list) {
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
    }
  });
}

const TINT_KEY = '_ghostTint';
const _tintScratch = new THREE.Color();

interface SavedTint {
  color: number;
  emissive: number;
  emissiveIntensity: number;
}

/**
 * Tints every material in a group toward `color`, or restores the originals when
 * `color` is null. Reversible (saves the base colour on first tint) so a single
 * persistent ghost can flip between red/normal without rebuilding its geometry.
 */
export function setGroupTint(root: THREE.Object3D, color: string | null): void {
  root.traverse((obj) => {
    const material = (obj as THREE.Mesh).material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const m of list) {
      const std = m as THREE.MeshStandardMaterial;
      if (!std.color) continue;
      if (std.userData[TINT_KEY] === undefined) {
        std.userData[TINT_KEY] = {
          color: std.color.getHex(),
          emissive: std.emissive?.getHex() ?? 0,
          emissiveIntensity: std.emissiveIntensity ?? 0,
        } satisfies SavedTint;
      }
      const base = std.userData[TINT_KEY] as SavedTint;
      if (color) {
        std.color.setHex(base.color).lerp(_tintScratch.set(color), 0.65);
        if (std.emissive) {
          std.emissive.set(_tintScratch.set(color));
          std.emissiveIntensity = 0.35;
        }
      } else {
        std.color.setHex(base.color);
        if (std.emissive) {
          std.emissive.setHex(base.emissive);
          std.emissiveIntensity = base.emissiveIntensity;
        }
      }
    }
  });
}
