import * as THREE from 'three';
import type { PlacedTile } from '../../core/tile/Tile';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player } from '../../core/types';
import { segmentKey, PLAYER_COLORS } from '../../core/types';
import type { SegmentKind, TilePrototype } from '../../core/types/tile';
import type { ClaimMap, FeatureClaim } from '../../three/claims';
import type { TileRegions } from '../../three/svgRegions';
import { centroid, svgToWorld, type World2 } from '../../three/generators/util';
import { START_TILE, BASE_GAME_DISTRIBUTION } from '../../core/deck/baseGameTiles';

/**
 * Shared, framework-free helpers for the 3D board: prototype lookup, meeple /
 * claim derivation from the live game state, segment centroids for placing the
 * meeple capsule, and THREE object housekeeping. Kept out of the React
 * components so they stay focused on rendering.
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

// ── Meeples / claims for one placed tile ─────────────────────────────────────

export interface TileMeeple {
  localId: number;
  kind: SegmentKind;
  playerIndex: number;
  color: string;
}

const playerColor = (i: number): string =>
  PLAYER_COLORS[((i % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];

/**
 * The meeples physically sitting on this tile (one per claimed segment whose
 * feature has a meeple placed on *this* tile). Mirrors the 2D TileView, which
 * draws a meeple only on the tile where it was placed.
 */
export function tileMeeples(placed: PlacedTile, registry: FeatureRegistry, players: Player[]): TileMeeple[] {
  const out: TileMeeple[] = [];
  for (const seg of placed.segmentInstances) {
    const fid = registry.segmentToFeature.get(segmentKey(seg.ref));
    const feature = fid ? registry.features.get(fid) : undefined;
    if (!feature) continue;
    for (const m of feature.meeples) {
      if (m.segmentRef.tileId !== placed.tileId || m.segmentRef.localId !== seg.ref.localId) continue;
      const idx = players.findIndex((p) => p.id === m.playerId);
      const playerIndex = idx < 0 ? 0 : idx;
      out.push({ localId: seg.ref.localId, kind: seg.kind, playerIndex, color: playerColor(playerIndex) });
    }
  }
  return out;
}

/** A stable signature so claim markers only rebuild when ownership changes. */
export function meeplesSignature(meeples: TileMeeple[]): string {
  return meeples.map((m) => `${m.localId}:${m.playerIndex}`).join(',');
}

/** The claim map (one banner/lantern per owned segment) for `buildClaimMarkers`. */
export function toClaimMap(meeples: TileMeeple[]): ClaimMap {
  const map = new Map<number, FeatureClaim>();
  for (const m of meeples) map.set(m.localId, { localId: m.localId, kind: m.kind, playerIndex: m.playerIndex });
  return map;
}

// ── Segment centroid (meeple capsule anchor) ─────────────────────────────────

/** Tile-local world centre of a segment, used to stand the meeple capsule on it. */
export function segmentCentroid(regions: TileRegions, localId: number, kind: SegmentKind): World2 {
  if (kind === 'MONASTERY') {
    const marker = regions.markers.find((m) => m.localId === localId);
    if (marker) return svgToWorld(marker.pos);
  }
  if (kind === 'ROAD') {
    const road = regions.roads.find((r) => r.localId === localId);
    if (road) return centroid(road.centerline.map(svgToWorld));
  }
  const pts = regions.polygons.filter((p) => p.localId === localId).flatMap((p) => p.points.map(svgToWorld));
  if (pts.length > 0) return centroid(pts);
  return [0, 0];
}

/** Keeps only the regions whose localId is a valid meeple target (drops the rest). */
export function filterRegions(regions: TileRegions, localIds: Set<number>): TileRegions {
  return {
    polygons: regions.polygons.filter((r) => localIds.has(r.localId)),
    roads: regions.roads.filter((r) => localIds.has(r.localId)),
    markers: regions.markers.filter((r) => localIds.has(r.localId)),
  };
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
