import type * as THREE from 'three';
import { DETAIL, TOWN } from '../palette';
import { type World2, standard, shadowMesh, roundedBox, pyramidRoof } from './util';

/** Main-hall dimensions, shared so ownership markers can sit at the roof apex. */
export const MONASTERY_BODY_HEIGHT = 0.16;
export const MONASTERY_ROOF_HEIGHT = 0.1;
/** Y of the main-hall roof apex (where a claim shield is mounted). */
export const MONASTERY_APEX_Y = MONASTERY_BODY_HEIGHT + MONASTERY_ROOF_HEIGHT;

/** A small Latin cross (vertical + transom) for a roof apex. */
function cross(x: number, y: number, z: number): THREE.Object3D[] {
  const mat = standard('#caa94a');
  const up = shadowMesh(roundedBox(0.006, 0.04, 0.006, 0.2), mat);
  up.position.set(x, y + 0.02, z);
  const arm = shadowMesh(roundedBox(0.022, 0.006, 0.006, 0.2), mat);
  arm.position.set(x, y + 0.026, z);
  return [up, arm];
}

/** A cloister building (main hall + roof) with a bell tower, door, windows and a cross. */
export function generateMonastery([x, z]: World2): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];

  // Main hall
  const w = 0.2;
  const bodyH = MONASTERY_BODY_HEIGHT;
  const body = shadowMesh(roundedBox(w, bodyH, w, 0.12), standard(DETAIL.monasteryWall));
  body.position.set(x, bodyH / 2, z);
  out.push(body);

  const roofH = MONASTERY_ROOF_HEIGHT;
  const roof = pyramidRoof(w, roofH, DETAIL.monasteryRoof);
  roof.position.set(x, bodyH + roofH / 2, z);
  out.push(roof);

  // Arched door + flanking windows on the south face (+z).
  const door = shadowMesh(roundedBox(0.03, 0.05, 0.012, 0.4), standard('#6a543a'));
  door.position.set(x, 0.025, z + w / 2);
  out.push(door);
  for (const s of [-1, 1]) {
    const win = shadowMesh(roundedBox(0.02, 0.024, 0.012, 0.3), standard(TOWN.facade.window.color));
    win.position.set(x + 0.06 * s, bodyH * 0.6, z + w / 2);
    out.push(win);
  }

  // Bell tower at one corner
  const tw = 0.06;
  const towerH = 0.22;
  const tx = x - w * 0.28;
  const tz = z - w * 0.28;
  const tower = shadowMesh(roundedBox(tw, towerH, tw, 0.2), standard(DETAIL.monasteryWall));
  tower.position.set(tx, towerH / 2, tz);
  out.push(tower);

  const towerRoofH = 0.05;
  const towerRoof = pyramidRoof(tw, towerRoofH, DETAIL.monasteryRoof);
  towerRoof.position.set(tx, towerH + towerRoofH / 2, tz);
  out.push(towerRoof);

  out.push(...cross(tx, towerH + towerRoofH, tz));
  out.push(...cross(x, bodyH + roofH, z));

  return out;
}
