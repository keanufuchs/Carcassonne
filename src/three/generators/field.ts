import * as THREE from 'three';
import { PALETTE, DETAIL } from '../palette';
import {
  type World2, standard, shadowMesh, extrudeWorldPolygon, scatterInside, pick, range,
} from './util';

/** A low-poly tree (trunk + icosahedron foliage). */
function tree(x: number, z: number, top: number, rng: () => number): THREE.Object3D[] {
  const trunkH = range(rng, 0.03, 0.05);
  const trunk = shadowMesh(
    new THREE.CylinderGeometry(0.006, 0.009, trunkH, 5),
    standard(DETAIL.treeTrunk),
  );
  trunk.position.set(x, top + trunkH / 2, z);

  const r = range(rng, 0.028, 0.045);
  const foliage = shadowMesh(new THREE.IcosahedronGeometry(r, 0), standard(pick(rng, DETAIL.treeFoliage)));
  foliage.position.set(x, top + trunkH + r * 0.7, z);
  return [trunk, foliage];
}

/** A small bush (single rounded blob). */
function bush(x: number, z: number, top: number, rng: () => number): THREE.Object3D {
  const r = range(rng, 0.018, 0.03);
  const mesh = shadowMesh(new THREE.IcosahedronGeometry(r, 0), standard(pick(rng, DETAIL.treeFoliage)));
  mesh.position.set(x, top + r * 0.75, z);
  return mesh;
}

/** A grass field scattered with trees and bushes. */
export function generateField(poly: World2[], rng: () => number): THREE.Object3D[] {
  const top = PALETTE.FIELD.height;
  const out: THREE.Object3D[] = [extrudeWorldPolygon(poly, top, standard(PALETTE.FIELD.color))];
  const spots = scatterInside(poly, rng, { step: 0.16, margin: 0.03, probability: 0.45 });
  for (const [x, z] of spots) {
    if (rng() < 0.35) out.push(bush(x, z, top, rng));
    else out.push(...tree(x, z, top, rng));
  }
  return out;
}
