import * as THREE from 'three';
import { PALETTE, DETAIL } from '../palette';
import {
  type World2, type Instance, standard, extrudeWorldPolygon, scatterInside, pick, range, instanced,
  pointInPolygon,
} from './util';

/**
 * A grass field scattered with trees and bushes. Foliage and trunks are each
 * batched into a single instanced mesh (one draw call per family). `exclude`
 * holds city polygons so no greenery is placed where a city sits on top of a
 * full-tile field.
 */
export function generateField(
  poly: World2[],
  rng: () => number,
  exclude: World2[][] = [],
): THREE.Object3D[] {
  const top = PALETTE.FIELD.height;
  const trunks: Instance[] = [];
  const foliage: Instance[] = [];

  const spots = scatterInside(poly, rng, { step: 0.16, margin: 0.03, probability: 0.45 });
  for (const [x, z] of spots) {
    if (exclude.some((p) => pointInPolygon([x, z], p))) continue;
    const color = pick(rng, DETAIL.treeFoliage);
    if (rng() < 0.35) {
      // bush — foliage blob only
      const r = range(rng, 0.018, 0.03);
      foliage.push({ pos: [x, top + r * 0.75, z], scale: [r, r, r], color });
      continue;
    }
    const trunkH = range(rng, 0.03, 0.05);
    const tr = range(rng, 0.007, 0.009);
    trunks.push({ pos: [x, top + trunkH / 2, z], scale: [tr, trunkH, tr] });
    const r = range(rng, 0.028, 0.045);
    foliage.push({ pos: [x, top + trunkH + r * 0.7, z], scale: [r, r, r], color });
  }

  const trunkGeo = new THREE.CylinderGeometry(1, 1.15, 1, 5);
  const foliageGeo = new THREE.IcosahedronGeometry(1, 0);
  const out: (THREE.Object3D | null)[] = [
    extrudeWorldPolygon(poly, top, standard(PALETTE.FIELD.color)),
    instanced(trunkGeo, standard(DETAIL.treeTrunk), trunks),
    instanced(foliageGeo, standard('#ffffff'), foliage),
  ];
  return out.filter((m): m is THREE.Object3D => m !== null);
}
