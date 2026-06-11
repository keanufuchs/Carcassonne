import * as THREE from 'three';
import { DETAIL } from '../palette';
import {
  type World2, standard, shadowMesh, pyramidRoof, extrudeWorldPolygon,
  scatterInside, pick, range,
} from './util';

/** A defensive wall built from a box along each polygon edge. */
function cityWalls(poly: World2[], baseTop: number): THREE.Object3D[] {
  const mat = standard(DETAIL.wall);
  const walls: THREE.Object3D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const geo = new THREE.BoxGeometry(len + DETAIL.wallThickness, DETAIL.wallHeight, DETAIL.wallThickness);
    const mesh = shadowMesh(geo, mat);
    mesh.position.set((a[0] + b[0]) / 2, baseTop + DETAIL.wallHeight / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    walls.push(mesh);
  }
  return walls;
}

/** Packed houses (body + pyramid roof) scattered inside the city, within walls. */
function cityHouses(poly: World2[], rng: () => number, baseTop: number): THREE.Object3D[] {
  const houses: THREE.Object3D[] = [];
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

    const body = shadowMesh(new THREE.BoxGeometry(w, h, d), standard(pick(rng, DETAIL.houseWalls)));
    body.position.set(x, baseTop + h / 2, z);
    body.rotation.y = rot;
    houses.push(body);

    const span = Math.max(w, d);
    const roofH = span * 0.55;
    const roof = pyramidRoof(span, roofH, pick(rng, DETAIL.roof));
    roof.position.set(x, baseTop + h + roofH / 2, z);
    roof.rotation.y = rot;
    houses.push(roof);
  }
  return houses;
}

/** A walled city sitting on a stone plaza, packed with little houses. */
export function generateCity(poly: World2[], rng: () => number): THREE.Object3D[] {
  const baseTop = DETAIL.cityBaseHeight;
  return [
    extrudeWorldPolygon(poly, baseTop, standard(DETAIL.cityBase)),
    ...cityWalls(poly, baseTop),
    ...cityHouses(poly, rng, baseTop),
  ];
}
