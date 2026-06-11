import * as THREE from 'three';
import { DETAIL } from '../palette';
import { type World2, standard, shadowMesh, pyramidRoof } from './util';

/** A cloister building (main hall + roof) with a small bell tower. */
export function generateMonastery([x, z]: World2): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];

  // Main hall
  const w = 0.2;
  const bodyH = 0.16;
  const body = shadowMesh(new THREE.BoxGeometry(w, bodyH, w), standard(DETAIL.monasteryWall));
  body.position.set(x, bodyH / 2, z);
  out.push(body);

  const roofH = 0.1;
  const roof = pyramidRoof(w, roofH, DETAIL.monasteryRoof);
  roof.position.set(x, bodyH + roofH / 2, z);
  out.push(roof);

  // Bell tower at one corner
  const tw = 0.06;
  const towerH = 0.22;
  const tx = x - w * 0.28;
  const tz = z - w * 0.28;
  const tower = shadowMesh(new THREE.BoxGeometry(tw, towerH, tw), standard(DETAIL.monasteryWall));
  tower.position.set(tx, towerH / 2, tz);
  out.push(tower);

  const towerRoofH = 0.05;
  const towerRoof = pyramidRoof(tw, towerRoofH, DETAIL.monasteryRoof);
  towerRoof.position.set(tx, towerH + towerRoofH / 2, tz);
  out.push(towerRoof);

  return out;
}
