import * as THREE from 'three';
import { PALETTE, DETAIL, TOWN } from '../palette';
import {
  type World2, type Instance, standard, standardFlat, extrudeWorldPolygon, scatterInside, pick, range, instanced,
  jitterColor, pointInPolygon,
} from './util';

/**
 * A grass field scattered with broadleaf trees, conifers, bushes and the odd
 * rock. Each family is batched into a single instanced mesh (one draw call).
 * Foliage colour is HSL-jittered per instance for variety. `exclude` holds city
 * polygons so no greenery sits where a city covers a full-tile field.
 */
export function generateField(
  poly: World2[],
  rng: () => number,
  exclude: World2[][] = [],
): THREE.Object3D[] {
  const top = PALETTE.FIELD.height;
  const { coniferWeight, rockProbability, rock, haystackProbability, haystack } = TOWN.vegetation;
  const trunks: Instance[] = [];
  const foliage: Instance[] = []; // round broadleaf + bushes
  const conifers: Instance[] = [];
  const rocks: Instance[] = [];
  const haystacks: Instance[] = [];

  const spots = scatterInside(poly, rng, { step: 0.16, margin: 0.03, probability: 0.45 });
  for (const [x, z] of spots) {
    if (exclude.some((p) => pointInPolygon([x, z], p))) continue;

    if (rng() < haystackProbability) {
      const r = range(rng, 0.03, 0.045);
      haystacks.push({ pos: [x, top + r * 0.5, z], scale: [r, r * 1.2, r], color: haystack });
      continue;
    }
    if (rng() < rockProbability) {
      const r = range(rng, 0.016, 0.028);
      rocks.push({ pos: [x, top + r * 0.3, z], scale: [r, r * 0.6, r], rotationY: rng() * Math.PI, color: rock });
      continue;
    }
    const color = jitterColor(rng, pick(rng, DETAIL.treeFoliage), TOWN.colorJitter);
    if (rng() < 0.3) {
      // bush — foliage blob only
      const r = range(rng, 0.018, 0.032);
      foliage.push({ pos: [x, top + r * 0.75, z], scale: [r, r, r], color });
      continue;
    }
    const trunkH = range(rng, 0.03, 0.06);
    const tr = range(rng, 0.007, 0.01);
    trunks.push({ pos: [x, top + trunkH / 2, z], scale: [tr, trunkH, tr] });
    if (rng() < coniferWeight) {
      const r = range(rng, 0.03, 0.045);
      const h = range(rng, 0.09, 0.15);
      conifers.push({ pos: [x, top + trunkH + h / 2, z], scale: [r, h, r], color });
    } else {
      const r = range(rng, 0.03, 0.05);
      foliage.push({ pos: [x, top + trunkH + r * 0.7, z], scale: [r, r, r], color });
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(1, 1.15, 1, 5);
  const foliageGeo = new THREE.IcosahedronGeometry(1, 0);
  const coniferGeo = new THREE.ConeGeometry(1, 1, 7);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  // A haystack: a rounded conical mound (cylinder tapering to a point).
  const haystackGeo = new THREE.CylinderGeometry(0.12, 0.6, 1, 8);
  const out: (THREE.Object3D | null)[] = [
    extrudeWorldPolygon(poly, top, standard(PALETTE.FIELD.color)),
    instanced(trunkGeo, standard(DETAIL.treeTrunk), trunks),
    instanced(foliageGeo, standardFlat('#ffffff'), foliage),
    instanced(coniferGeo, standardFlat('#ffffff'), conifers),
    instanced(rockGeo, standardFlat('#ffffff'), rocks),
    instanced(haystackGeo, standardFlat('#ffffff'), haystacks),
  ];
  return out.filter((m): m is THREE.Object3D => m !== null);
}
