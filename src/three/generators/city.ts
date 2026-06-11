import * as THREE from 'three';
import { DETAIL } from '../palette';
import {
  type World2, type Instance, standard, shadowMesh, roundedBox, unitRoundedBox, unitPyramid,
  extrudeWorldPolygon, scatterInside, pick, range, instanced, onTileBoundary, pointInPolygon,
} from './util';

const WALL_EPS = 0.012; // outward probe distance for the "city on both sides?" test
const WALL_STEP = 0.045; // sampling resolution along each edge
const TOWER_SPACING = 0.24; // distance between watchtowers along a wall stretch
const TOWER_END_INSET = 0.015; // pulls the end towers slightly off the stretch tips
const MERLON_SPACING = 0.034; // crenellation rhythm along the wall top

function lerp(a: World2, b: World2, t: number): World2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * True if the side of this edge facing away from polygon `P` is also city —
 * i.e. the edge is an internal seam (e.g. the crossing diagonals of the
 * `data-part` city tiles), not a real outer wall.
 */
function exteriorIsCity(mid: World2, perp: World2, p: World2[], all: World2[][]): boolean {
  const plus: World2 = [mid[0] + perp[0] * WALL_EPS, mid[1] + perp[1] * WALL_EPS];
  const minus: World2 = [mid[0] - perp[0] * WALL_EPS, mid[1] - perp[1] * WALL_EPS];
  const exterior = pointInPolygon(plus, p) ? minus : plus;
  return all.some((poly) => pointInPolygon(exterior, poly));
}

/**
 * Returns the sub-segments of edge a→b that should carry a wall: skips the
 * whole edge if it's on the tile boundary, otherwise samples along it and keeps
 * the contiguous runs whose outward side is non-city.
 */
function edgeWallRuns(a: World2, b: World2, p: World2[], all: World2[][]): [World2, World2][] {
  if (onTileBoundary(a, b)) return [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n = Math.max(1, Math.ceil(len / WALL_STEP));
  const perp: World2 = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  const runs: [World2, World2][] = [];
  let start: number | null = null;
  for (let i = 0; i < n; i++) {
    const isWall = !exteriorIsCity(lerp(a, b, (i + 0.5) / n), perp, p, all);
    if (isWall && start === null) start = i / n;
    if (!isWall && start !== null) {
      runs.push([lerp(a, b, start), lerp(a, b, i / n)]);
      start = null;
    }
  }
  if (start !== null) runs.push([lerp(a, b, start), b]);
  return runs;
}

type WallSeg = [World2, World2];

/** Groups ordered wall segments into contiguous stretches (incl. wrap-around). */
function chainStretches(segs: WallSeg[]): WallSeg[][] {
  const eps = 1e-3;
  const joins = (a: World2, b: World2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < eps;
  const stretches: WallSeg[][] = [];
  let current: WallSeg[] = [];
  for (const seg of segs) {
    if (current.length > 0 && !joins(current[current.length - 1][1], seg[0])) {
      stretches.push(current);
      current = [];
    }
    current.push(seg);
  }
  if (current.length > 0) stretches.push(current);
  if (stretches.length > 1) {
    const first = stretches[0];
    const last = stretches[stretches.length - 1];
    if (joins(last[last.length - 1][1], first[0][0])) {
      stretches[0] = [...last, ...first];
      stretches.pop();
    }
  }
  return stretches;
}

/** Point and local direction at a distance along a stretch of wall segments. */
function pointAlong(segs: WallSeg[], dist: number): { p: World2; angle: number } {
  let walked = 0;
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (walked + len >= dist || i === segs.length - 1) {
      const t = len > 0 ? Math.min(1, Math.max(0, (dist - walked) / len)) : 0;
      return { p: lerp(a, b, t), angle: -Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    walked += len;
  }
  const [a, b] = segs[segs.length - 1];
  return { p: b, angle: -Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

const stretchLength = (segs: WallSeg[]) =>
  segs.reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);

/**
 * A defensive wall along the city's true outer boundary only, structured with
 * watchtowers (stretch ends + regular intervals) and a crenellation rhythm of
 * merlons along the top.
 */
function cityWalls(
  poly: World2[],
  allCityPolys: World2[][],
  baseTop: number,
  rng: () => number,
): THREE.Object3D[] {
  const mat = standard(DETAIL.wall);
  const walls: THREE.Object3D[] = [];
  const segs: WallSeg[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    for (const [pA, pB] of edgeWallRuns(a, b, poly, allCityPolys)) {
      const dx = pB[0] - pA[0];
      const dz = pB[1] - pA[1];
      const len = Math.hypot(dx, dz);
      if (len < 2e-3) continue;
      segs.push([pA, pB]);
      const geo = roundedBox(len + DETAIL.wallThickness, DETAIL.wallHeight, DETAIL.wallThickness, 0.25);
      const mesh = shadowMesh(geo, mat);
      mesh.position.set((pA[0] + pB[0]) / 2, baseTop + DETAIL.wallHeight / 2, (pA[1] + pB[1]) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      walls.push(mesh);
    }
  }

  const towerBodies: Instance[] = [];
  const towerRoofs: Instance[] = [];
  const merlons: Instance[] = [];
  for (const stretch of chainStretches(segs)) {
    const length = stretchLength(stretch);
    const towerDists =
      length < 2 * TOWER_END_INSET + 0.03
        ? [length / 2]
        : [TOWER_END_INSET, length - TOWER_END_INSET];
    for (let d = TOWER_SPACING; d < length - TOWER_SPACING / 2; d += TOWER_SPACING) {
      towerDists.push(d);
    }
    for (const d of towerDists) {
      const { p } = pointAlong(stretch, d);
      const r = 0.02;
      const h = DETAIL.wallHeight * (1.35 + rng() * 0.2);
      towerBodies.push({ pos: [p[0], baseTop + h / 2, p[1]], scale: [r, h, r] });
      towerRoofs.push({ pos: [p[0], baseTop + h + 0.022, p[1]], scale: [0.028, 0.044, 0.028] });
    }
    for (let d = MERLON_SPACING / 2; d < length; d += MERLON_SPACING) {
      if (towerDists.some((t) => Math.abs(t - d) < 0.04)) continue;
      const { p, angle } = pointAlong(stretch, d);
      merlons.push({
        pos: [p[0], baseTop + DETAIL.wallHeight + 0.0055, p[1]],
        scale: [0.014, 0.011, DETAIL.wallThickness * 0.85],
        rotationY: angle,
      });
    }
  }
  return [
    ...walls,
    instanced(new THREE.CylinderGeometry(1, 1, 1, 8), standard(DETAIL.wall), towerBodies),
    instanced(new THREE.ConeGeometry(1, 1, 8), standard(DETAIL.roof[2]), towerRoofs),
    instanced(unitRoundedBox(0.2), standard(DETAIL.wall), merlons),
  ].filter((m): m is THREE.Object3D => m !== null);
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

/** A heraldic banner (pole + shield) marking a shielded city, at `pos`. */
export function cityBanner([cx, cz]: World2, baseTop: number): THREE.Object3D[] {
  const poleH = 0.34;
  const pole = shadowMesh(new THREE.CylinderGeometry(0.006, 0.006, poleH, 6), standard('#6a543a'));
  pole.position.set(cx, baseTop + poleH / 2, cz);
  const shield = shadowMesh(roundedBox(0.06, 0.075, 0.014, 0.3), standard('#3b6fb0'));
  shield.position.set(cx, baseTop + poleH - 0.025, cz);
  const emblem = shadowMesh(roundedBox(0.03, 0.03, 0.02, 0.35), standard('#eef0f4'));
  emblem.position.set(cx, baseTop + poleH - 0.025, cz);
  return [pole, shield, emblem];
}

/**
 * A walled city on a stone plaza, packed with houses. `allCityPolys` is every
 * city polygon on the tile (incl. other parts of this city), used to suppress
 * walls along internal seams. Shield banners are added once per city by the
 * tile dispatcher, not here.
 */
export function generateCity(poly: World2[], rng: () => number, allCityPolys: World2[][]): THREE.Object3D[] {
  const baseTop = DETAIL.cityBaseHeight;
  return [
    extrudeWorldPolygon(poly, baseTop, standard(DETAIL.cityBase)),
    ...cityWalls(poly, allCityPolys, baseTop, rng),
    ...cityHouses(poly, rng, baseTop),
  ];
}
