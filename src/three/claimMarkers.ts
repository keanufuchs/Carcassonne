import * as THREE from 'three';
import { PLAYER_COLORS } from '../core/types';
import type { ClaimMap, FeatureClaim } from './claims';
import type { TileRegions } from './svgRegions';
import { svgToWorld, type World2 } from './generators/util';
import { cityAnchor, fieldAnchor, playerGonfalon, playerShield } from './generators/banner';
import { MONASTERY_APEX_Y } from './generators/monastery';
import { ROAD_SURFACE_TAG } from './generators/road';
import { SEGMENT_MESH_TAG } from './regionHighlight';
import { BANNER, DETAIL, PALETTE } from './palette';

/**
 * Turns a tile's ownership claims into world-integrated banner markers and road
 * tints, decoupled from the procedural tile so the tile is never rebuilt on a
 * claim change. Cities/fields get a gonfalon, monasteries a roof shield, roads a
 * surface tint (no marker).
 * See docs/superpowers/specs/2026-06-12-banner-ownership-visualization-design.md.
 */

const playerColor = (i: number): string => PLAYER_COLORS[((i % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];

const ROAD_TINT_KEY = '_roadBaseColor';

/** All city polygon parts (world space) sharing a localId. */
function cityParts(regions: TileRegions, localId: number): World2[][] {
  return regions.polygons
    .filter((r) => r.kind === 'CITY' && r.localId === localId)
    .map((r) => r.points.map(svgToWorld));
}

/** Builds the marker for one claim, or null for roads / missing geometry. */
function markerFor(regions: TileRegions, claim: FeatureClaim): THREE.Group | null {
  const color = playerColor(claim.playerIndex);
  if (claim.kind === 'CITY') {
    const parts = cityParts(regions, claim.localId);
    if (parts.length === 0) return null;
    return playerGonfalon(cityAnchor(parts), DETAIL.cityBaseHeight, color, BANNER.gonfalon.cityScale);
  }
  if (claim.kind === 'FIELD') {
    const region = regions.polygons.find((r) => r.kind === 'FIELD' && r.localId === claim.localId);
    if (!region) return null;
    return playerGonfalon(fieldAnchor(region.points.map(svgToWorld)), PALETTE.FIELD.height, color, BANNER.gonfalon.fieldScale);
  }
  if (claim.kind === 'MONASTERY') {
    const marker = regions.markers.find((m) => m.localId === claim.localId);
    if (!marker) return null;
    return playerShield(svgToWorld(marker.pos), MONASTERY_APEX_Y, color);
  }
  return null; // ROAD → handled by applyRoadClaimTints
}

/** A group of ownership markers for the current claims (excludes roads). */
export function buildClaimMarkers(regions: TileRegions, claims: ClaimMap): THREE.Group {
  const group = new THREE.Group();
  group.name = 'claim-markers';
  for (const claim of claims.values()) {
    const marker = markerFor(regions, claim);
    if (!marker) continue;
    marker.name = `claim-marker-${claim.kind}-${claim.localId}`;
    group.add(marker);
  }
  return group;
}

/** Blends the road's base colour toward the player colour by the configured factor. */
function tintedRoadColor(base: THREE.Color, playerHex: string): THREE.Color {
  return base.clone().lerp(new THREE.Color(playerHex), BANNER.roadTintFactor);
}

/**
 * Applies (or restores) road-surface tints for the current claims. Tints only
 * tagged surface meshes; the curb stays neutral. Saves the original colour on
 * first tint so a later un-claim restores it exactly.
 */
export function applyRoadClaimTints(tileGroup: THREE.Object3D, claims: ClaimMap): void {
  tileGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj.userData[ROAD_SURFACE_TAG] !== true) return;
    const localId = obj.userData[SEGMENT_MESH_TAG] as number | undefined;
    const material = obj.material;
    if (localId === undefined || !(material instanceof THREE.MeshStandardMaterial)) return;

    if (material.userData[ROAD_TINT_KEY] === undefined) {
      material.userData[ROAD_TINT_KEY] = material.color.getHex();
    }
    const base = new THREE.Color(material.userData[ROAD_TINT_KEY] as number);
    const claim = claims.get(localId);
    material.color.copy(claim && claim.kind === 'ROAD' ? tintedRoadColor(base, playerColor(claim.playerIndex)) : base);
  });
}
