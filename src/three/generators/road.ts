import type * as THREE from 'three';
import { PALETTE, DETAIL } from '../palette';
import { type World2, standard, extrudeWorldPolygon } from './util';

/** Offsets a centreline by ±width/2 into a closed ribbon polygon. */
export function roadRibbon(centerline: World2[], width: number): World2[] {
  const half = width / 2;
  const left: World2[] = [];
  const right: World2[] = [];
  for (let i = 0; i < centerline.length; i++) {
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const nx = -dz;
    const nz = dx;
    const [cx, cz] = centerline[i];
    left.push([cx + nx * half, cz + nz * half]);
    right.push([cx - nx * half, cz - nz * half]);
  }
  return [...left, ...right.reverse()];
}

/** Marks the paved surface mesh so ownership tinting targets it (not the curb). */
export const ROAD_SURFACE_TAG = 'roadSurface' as const;
/**
 * Carries the road's segment localId on the surface mesh for claim tinting.
 * Deliberately NOT the shared SEGMENT_MESH_TAG: roads are hover-highlighted via
 * their shell overlay, so tagging them for the mesh-emissive highlight would let
 * its save/restore clobber the claim tint.
 */
export const ROAD_LOCAL_ID = 'roadLocalId' as const;

/** A paved road ribbon on a slightly wider, lower stone curb. */
export function generateRoad(centerline: World2[], width: number, localId: number): THREE.Object3D[] {
  if (centerline.length < 2) return [];
  const curb = extrudeWorldPolygon(roadRibbon(centerline, width * 1.7), 0.025, standard(DETAIL.roadCurb));
  const surface = extrudeWorldPolygon(roadRibbon(centerline, width), PALETTE.ROAD.height, standard(PALETTE.ROAD.color));
  surface.userData[ROAD_SURFACE_TAG] = true;
  surface.userData[ROAD_LOCAL_ID] = localId;
  return [curb, surface];
}
