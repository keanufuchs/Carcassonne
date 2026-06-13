import * as THREE from 'three';
import { PLAYER_COLORS } from '../core/types';
import type { ClaimMap, FeatureClaim } from './claims';
import type { TileRegions } from './svgRegions';
import { svgToWorld, type World2 } from './generators/util';
import { cityAnchor, fieldAnchor, playerGonfalon, playerShield, roadLantern, roadLanternAnchor } from './generators/banner';
import { MONASTERY_APEX_Y } from './generators/monastery';
import { BANNER, DETAIL, PALETTE } from './palette';

/**
 * Turns a tile's ownership claims into world-integrated markers, decoupled from
 * the procedural tile so the tile is never rebuilt on a claim change. Cities and
 * fields get a gonfalon, monasteries a roof shield. Every road carries a wayside
 * lantern (neutral by default); claiming a road hangs a player pennant on it —
 * the road material is never recoloured.
 * See docs/superpowers/specs/2026-06-12-banner-ownership-visualization-design.md.
 */

const playerColor = (i: number): string => PLAYER_COLORS[((i % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];

/** All city polygon parts (world space) sharing a localId. */
function cityParts(regions: TileRegions, localId: number): World2[][] {
  return regions.polygons
    .filter((r) => r.kind === 'CITY' && r.localId === localId)
    .map((r) => r.points.map(svgToWorld));
}

/** Builds the marker for one claim, or null for roads / missing geometry. */
function markerFor(regions: TileRegions, claim: FeatureClaim): THREE.Group | null {
  const marker = buildMarker(regions, claim);
  // Player-coloured markers billboard toward the camera (see PlacedTile3D).
  if (marker) marker.userData.billboard = true;
  return marker;
}

function buildMarker(regions: TileRegions, claim: FeatureClaim): THREE.Group | null {
  const color = playerColor(claim.playerIndex);
  if (claim.kind === 'CITY') {
    const parts = cityParts(regions, claim.localId);
    if (parts.length === 0) return null;
    return playerGonfalon(cityAnchor(parts), DETAIL.cityBaseHeight, color, BANNER.gonfalon.cityScale);
  }
  if (claim.kind === 'FIELD') {
    const region = regions.polygons.find((r) => r.kind === 'FIELD' && r.localId === claim.localId);
    if (!region) return null;
    // Monastery buildings sit inside the field polygon — keep the banner away from them.
    const obstacles = regions.markers.map((m) => svgToWorld(m.pos));
    return playerGonfalon(fieldAnchor(region.points.map(svgToWorld), obstacles), PALETTE.FIELD.height, color, BANNER.gonfalon.fieldScale);
  }
  if (claim.kind === 'MONASTERY') {
    const marker = regions.markers.find((m) => m.localId === claim.localId);
    if (!marker) return null;
    return playerShield(svgToWorld(marker.pos), MONASTERY_APEX_Y, color);
  }
  return null; // ROAD → handled by buildRoadLanterns
}

/**
 * One wayside lantern per road run. Neutral when the road is unclaimed; a
 * player pennant is hung on it when claimed (looked up by the road's localId).
 */
function buildRoadLanterns(group: THREE.Group, regions: TileRegions, claims: ClaimMap): void {
  for (const road of regions.roads) {
    const anchor = roadLanternAnchor(road.centerline.map(svgToWorld));
    const claim = claims.get(road.localId);
    const color = claim && claim.kind === 'ROAD' ? playerColor(claim.playerIndex) : null;
    const lantern = roadLantern(anchor, color);
    lantern.name = `road-lantern-${road.localId}`;
    // Only a claimed lantern carries a pennant worth billboarding; neutral stays fixed.
    if (color) lantern.userData.billboard = true;
    group.add(lantern);
  }
}

/**
 * The ownership marker layer for the current claims: gonfalon/shield markers for
 * claimed cities, fields and monasteries, plus a lantern beside every road.
 */
export function buildClaimMarkers(regions: TileRegions, claims: ClaimMap): THREE.Group {
  const group = new THREE.Group();
  group.name = 'claim-markers';
  for (const claim of claims.values()) {
    const marker = markerFor(regions, claim);
    if (!marker) continue;
    marker.name = `claim-marker-${claim.kind}-${claim.localId}`;
    group.add(marker);
  }
  buildRoadLanterns(group, regions, claims);
  return group;
}
