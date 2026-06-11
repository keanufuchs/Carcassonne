import * as THREE from 'three';
import { DETAIL } from '../palette';
import {
  type World2, type Instance, standard, shadowMesh, roundedBox, unitRoundedBox, unitPyramid,
  extrudeWorldPolygon, scatterInside, pick, range, centroid, instanced,
} from './util';

/** A defensive wall built from a rounded box along each polygon edge. */
function cityWalls(poly: World2[], baseTop: number): THREE.Object3D[] {
  const walls: THREE.Object3D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const geo = roundedBox(len + DETAIL.wallThickness, DETAIL.wallHeight, DETAIL.wallThickness, 0.25);
    const mesh = shadowMesh(geo, standard(DETAIL.wall));
    mesh.position.set((a[0] + b[0]) / 2, baseTop + DETAIL.wallHeight / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    walls.push(mesh);
  }
  return walls;
}

/** Packed houses as two instanced meshes (rounded bodies + pyramid roofs). */
function cityHouses(poly: World2[], rng: () => number, baseTop: number): THREE.Object3D[] {
  const bodies: Instance[] = [];
  const roofs: Instance[] = [];
  const spots = scatterInside(poly, rng, {
    step: 0.13,
    margin: DETAIL.wallThickness + 0.035,
    probability: 0.85,
  });
  for (const [x, z] of spots) {
    const w = range(rng, 0.06, 0.1);
    const d = range(rng, 0.06, 0.1);
    const h = range(rng, 0.1, 0.24);
    const rot = Math.floor(rng() * 4) * (Math.PI / 2);
    const span = Math.max(w, d);
    const roofH = span * 0.55;

    bodies.push({ pos: [x, baseTop + h / 2, z], scale: [w, h, d], rotationY: rot, color: pick(rng, DETAIL.houseWalls) });
    roofs.push({ pos: [x, baseTop + h + roofH / 2, z], scale: [span, roofH, span], rotationY: rot, color: pick(rng, DETAIL.roof) });
  }
  return [
    instanced(unitRoundedBox(0.18), standard('#ffffff'), bodies),
    instanced(unitPyramid(), standard('#ffffff'), roofs),
  ].filter((m): m is THREE.InstancedMesh => m !== null);
}

/** A heraldic banner (pole + shield) marking a shielded city. */
function cityBanner(poly: World2[], baseTop: number): THREE.Object3D[] {
  const [cx, cz] = centroid(poly);
  const poleH = 0.34;
  const pole = shadowMesh(new THREE.CylinderGeometry(0.006, 0.006, poleH, 6), standard('#6a543a'));
  pole.position.set(cx, baseTop + poleH / 2, cz);
  const shield = shadowMesh(roundedBox(0.06, 0.075, 0.014, 0.3), standard('#3b6fb0'));
  shield.position.set(cx, baseTop + poleH - 0.025, cz);
  const emblem = shadowMesh(roundedBox(0.03, 0.03, 0.02, 0.35), standard('#eef0f4'));
  emblem.position.set(cx, baseTop + poleH - 0.025, cz);
  return [pole, shield, emblem];
}

/** A walled city on a stone plaza, packed with houses (+ banner if shielded). */
export function generateCity(poly: World2[], rng: () => number, shielded: boolean): THREE.Object3D[] {
  const baseTop = DETAIL.cityBaseHeight;
  return [
    extrudeWorldPolygon(poly, baseTop, standard(DETAIL.cityBase)),
    ...cityWalls(poly, baseTop),
    ...cityHouses(poly, rng, baseTop),
    ...(shielded ? cityBanner(poly, baseTop) : []),
  ];
}
