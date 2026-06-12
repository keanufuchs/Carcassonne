import * as THREE from 'three';
import { DETAIL, TOWN } from '../palette';
import {
  type World2, type Instance, standard, shadowMesh, roundedBox, unitRoundedBox, unitPyramid,
  unitGableRoof, unitClipRoof, jitterColor, pyramidRoof,
  extrudeWorldPolygon, scatterInside, distToPolygonEdge, pick, range, instanced, onTileBoundary, pointInPolygon,
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
  const tw = TOWN.tower;
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
      // Drop corner-hugging stubs (both ends at the perimeter) — smoothing
      // artefacts where the city chamfers a tile corner; they read as orphans.
      if (nearTilePerimeter(pA, tw.borderMargin) && nearTilePerimeter(pB, tw.borderMargin)) continue;
      segs.push([pA, pB]);
      const geo = roundedBox(len + DETAIL.wallThickness, DETAIL.wallHeight, DETAIL.wallThickness, 0.25);
      const mesh = shadowMesh(geo, mat);
      mesh.position.set((pA[0] + pB[0]) / 2, baseTop + DETAIL.wallHeight / 2, (pA[1] + pB[1]) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      walls.push(mesh);
    }
  }

  const towerBodies: Instance[] = [];
  const towerSpires: Instance[] = [];
  const finials: Instance[] = [];
  const flags: Instance[] = [];
  const merlons: Instance[] = [];
  for (const stretch of chainStretches(segs)) {
    const length = stretchLength(stretch);
    // A wall end that meets the tile border is a merge seam: set its tower back
    // by borderMargin (so the body never crosses the seam). Interior corners get
    // a tower hugging the tip.
    const startInset = onTilePerimeter(pointAlong(stretch, 0).p) ? tw.borderMargin : TOWER_END_INSET;
    const endInset = onTilePerimeter(pointAlong(stretch, length).p) ? tw.borderMargin : TOWER_END_INSET;
    const towerDists =
      length < startInset + endInset + 0.03
        ? [length / 2]
        : [startInset, length - endInset];
    for (let d = TOWER_SPACING; d < length - TOWER_SPACING / 2; d += TOWER_SPACING) {
      towerDists.push(d);
    }
    for (const d of towerDists) {
      const { p } = pointAlong(stretch, d);
      // Never let a tower body cross the tile border (would overlap a neighbour).
      if (nearTilePerimeter(p, tw.borderMargin - 0.005)) continue;
      const r = tw.baseRadius * (0.85 + rng() * 0.4);
      const h = DETAIL.wallHeight * (1.3 + rng() * 0.5);
      const spireH = tw.spireHeight * (0.85 + rng() * 0.4);
      towerBodies.push({ pos: [p[0], baseTop + h / 2, p[1]], scale: [r, h, r] });
      towerSpires.push({ pos: [p[0], baseTop + h + spireH / 2, p[1]], scale: [r * 1.15, spireH, r * 1.15] });
      finials.push({ pos: [p[0], baseTop + h + spireH + tw.finial / 2, p[1]], scale: [tw.finial, tw.finial, tw.finial] });
      if (rng() < tw.bannerProbability) {
        flags.push({
          pos: [p[0], baseTop + h + spireH * 0.7, p[1] + r * 1.4],
          scale: [0.004, 0.02, 0.03], color: pick(rng, TOWN.accents),
        });
      }
    }
    // Crenellations run the full wall (incl. to the seam) so ends look finished.
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
  // Tapered tower body: top radius is a fraction of the (unit) base radius.
  const taper = tw.topRadius / tw.baseRadius;
  return [
    ...walls,
    instanced(new THREE.CylinderGeometry(taper, 1, 1, 8), standard(DETAIL.wall), towerBodies),
    instanced(new THREE.ConeGeometry(1, 1, 8), standard(DETAIL.roof[2]), towerSpires),
    instanced(new THREE.SphereGeometry(0.5, 6, 5), standard(DETAIL.roof[1]), finials),
    instanced(unitRoundedBox(0.2), standard('#ffffff'), flags),
    instanced(unitRoundedBox(0.2), standard(DETAIL.wall), merlons),
  ].filter((m): m is THREE.Object3D => m !== null);
}

/** Barrels and crates tucked into the open ring between the wall and the houses. */
function cityProps(poly: World2[], rng: () => number, baseTop: number): THREE.Object3D[] {
  const barrels: Instance[] = [];
  const crates: Instance[] = [];
  const ringInner = DETAIL.wallThickness + 0.035; // = the house placement margin
  const spots = scatterInside(poly, rng, {
    step: 0.1, margin: DETAIL.wallThickness + 0.008, probability: TOWN.props.ringProbability,
  });
  for (const [x, z] of spots) {
    if (distToPolygonEdge([x, z], poly) > ringInner) continue; // keep to the wall ring
    if (rng() < 0.5) {
      const r = range(rng, 0.012, 0.018);
      const h = range(rng, 0.02, 0.032);
      barrels.push({ pos: [x, baseTop + h / 2, z], scale: [r, h, r], color: TOWN.props.barrel });
    } else {
      const s = range(rng, 0.02, 0.03);
      crates.push({ pos: [x, baseTop + s / 2, z], scale: [s, s, s], rotationY: rng() * Math.PI, color: TOWN.props.crate });
    }
  }
  return [
    instanced(new THREE.CylinderGeometry(1, 1, 1, 8), standard('#ffffff'), barrels),
    instanced(unitRoundedBox(0.15), standard('#ffffff'), crates),
  ].filter((m): m is THREE.InstancedMesh => m !== null);
}

type RoofKind = 'gable' | 'hip' | 'clip';

/** Weighted, deterministic roof-archetype pick from the central config. */
function pickRoofKind(rng: () => number): RoofKind {
  const { gable, hip, clip } = TOWN.roof.weights;
  const r = rng() * (gable + hip + clip);
  if (r < gable) return 'gable';
  if (r < gable + hip) return 'hip';
  return 'clip';
}

/**
 * Packed houses with varied roofs (gable / hip / clip), eaves, ridge caps,
 * chimneys, a foundation lip and slight handmade asymmetry. Each family is one
 * instanced mesh; per-instance colours are HSL-jittered to avoid repetition.
 */
function cityHouses(poly: World2[], rng: () => number, baseTop: number): THREE.Object3D[] {
  const bodies: Instance[] = [];
  const foundations: Instance[] = [];
  const eaves: Instance[] = [];
  const ridges: Instance[] = [];
  const chimneys: Instance[] = [];
  const doors: Instance[] = [];
  const windows: Instance[] = [];
  const roofsByKind: Record<RoofKind, Instance[]> = { gable: [], hip: [], clip: [] };
  const { foundation, roof: roofCfg, chimney, house, colorJitter, facade } = TOWN;

  const spots = scatterInside(poly, rng, {
    step: 0.13,
    margin: DETAIL.wallThickness + 0.035,
    probability: 0.85,
  });
  for (const [x, z] of spots) {
    const w = range(rng, 0.06, 0.1);
    const d = range(rng, 0.06, 0.1);
    const h = range(rng, 0.1, 0.24);
    const rot = Math.floor(rng() * 4) * (Math.PI / 2) + (rng() - 0.5) * house.yawJitter;
    const span = Math.max(w, d);
    const kind = pickRoofKind(rng);
    const roofH = span * (kind === 'gable' ? 0.5 : kind === 'hip' ? 0.55 : 0.42);
    const wallColor = jitterColor(rng, pick(rng, DETAIL.houseWalls), colorJitter);
    const roofColor = jitterColor(rng, pick(rng, DETAIL.roof), colorJitter);

    foundations.push({
      pos: [x, baseTop + foundation.height / 2, z],
      scale: [w + foundation.overhang * 2, foundation.height, d + foundation.overhang * 2],
      rotationY: rot, color: foundation.color,
    });
    bodies.push({ pos: [x, baseTop + h / 2, z], scale: [w, h, d], rotationY: rot, color: wallColor });

    const eaveOv = roofCfg.eaveOverhang;
    eaves.push({
      pos: [x, baseTop + h, z],
      scale: [w + eaveOv * 2, roofCfg.eaveThickness, d + eaveOv * 2],
      rotationY: rot, color: roofColor,
    });
    roofsByKind[kind].push({
      pos: [x, baseTop + h + roofH / 2, z],
      scale: [w + eaveOv, roofH, d + eaveOv], rotationY: rot, color: roofColor,
    });
    if (kind === 'gable') {
      ridges.push({
        pos: [x, baseTop + h + roofH - roofCfg.ridgeSize * 0.4, z],
        scale: [roofCfg.ridgeSize, roofCfg.ridgeSize, d + eaveOv], rotationY: rot, color: roofColor,
      });
    }
    if (rng() < chimney.probability) {
      const ox = (rng() < 0.5 ? 0.28 : -0.28) * w;
      const oz = (rng() < 0.5 ? 0.28 : -0.28) * d;
      const cx = x + ox * Math.cos(rot) - oz * Math.sin(rot);
      const cz = z + ox * Math.sin(rot) + oz * Math.cos(rot);
      chimneys.push({
        pos: [cx, baseTop + h + chimney.height / 2, cz],
        scale: [chimney.size, chimney.height, chimney.size], color: chimney.color,
      });
    }

    // Facade: a coloured door + symmetric windows on the front (+Z local) face.
    const fwd: World2 = [Math.sin(rot), Math.cos(rot)];
    const rightV: World2 = [Math.cos(rot), -Math.sin(rot)];
    const faceX = x + fwd[0] * (d / 2);
    const faceZ = z + fwd[1] * (d / 2);
    doors.push({
      pos: [faceX, baseTop + facade.door.h / 2, faceZ],
      scale: [facade.door.w, facade.door.h, facade.door.depth],
      rotationY: rot, color: pick(rng, TOWN.accents),
    });
    if (h > 0.13 && rng() < facade.windowProbability) {
      for (const s of [-1, 1]) {
        windows.push({
          pos: [faceX + rightV[0] * w * 0.26 * s, baseTop + h * 0.62, faceZ + rightV[1] * w * 0.26 * s],
          scale: [facade.window.w, facade.window.h, facade.window.depth],
          rotationY: rot, color: facade.window.color,
        });
      }
    }
  }
  return [
    instanced(unitRoundedBox(0.12), standard('#ffffff'), foundations),
    instanced(unitRoundedBox(0.18), standard('#ffffff'), bodies),
    instanced(unitRoundedBox(0.08), standard('#ffffff'), eaves),
    instanced(unitGableRoof(), standard('#ffffff'), roofsByKind.gable),
    instanced(unitPyramid(), standard('#ffffff'), roofsByKind.hip),
    instanced(unitClipRoof(), standard('#ffffff'), roofsByKind.clip),
    instanced(unitRoundedBox(0.2), standard('#ffffff'), ridges),
    instanced(unitRoundedBox(0.2), standard('#ffffff'), chimneys),
    instanced(unitRoundedBox(0.12), standard('#ffffff'), doors),
    instanced(unitRoundedBox(0.12), standard('#ffffff'), windows),
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
    ...cityProps(poly, rng, baseTop),
  ];
}

/** Nearest point on a polygon's boundary to `p`, plus that edge's unit direction. */
function nearestBoundary(p: World2, poly: World2[]): { point: World2; dir: World2; dist: number } {
  let best = { point: poly[0], dir: [1, 0] as World2, dist: Infinity };
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lenSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lenSq));
    const cx = a[0] + t * dx;
    const cz = a[1] + t * dz;
    const dist = Math.hypot(p[0] - cx, p[1] - cz);
    if (dist < best.dist) {
      const len = Math.hypot(dx, dz) || 1;
      best = { point: [cx, cz], dir: [dx / len, dz / len], dist };
    }
  }
  return best;
}

/** True if a point lies within `margin` of the tile perimeter (x=±0.5 or z=±0.5). */
function nearTilePerimeter([x, z]: World2, margin: number): boolean {
  return Math.abs(Math.abs(x) - 0.5) < margin || Math.abs(Math.abs(z) - 0.5) < margin;
}

/** True if a point lies on the tile perimeter (where no wall — hence no gate — exists). */
function onTilePerimeter(p: World2): boolean {
  return nearTilePerimeter(p, 0.012);
}

/** A gatehouse straddling the road at `point`, aligned to wall direction `dir`. */
function gatehouse([px, pz]: World2, dir: World2, baseTop: number): THREE.Object3D[] {
  const g = TOWN.gate;
  const angle = -Math.atan2(dir[1], dir[0]); // maps local +X onto the wall direction
  const wallMat = standard(DETAIL.wall);
  const out: THREE.Object3D[] = [];
  const half = g.width / 2 + g.postWidth / 2;
  for (const s of [-1, 1]) {
    const post = shadowMesh(roundedBox(g.postWidth, g.height, g.depth, 0.18), wallMat);
    post.position.set(px + dir[0] * half * s, baseTop + g.height / 2, pz + dir[1] * half * s);
    post.rotation.y = angle;
    out.push(post);
  }
  const lintel = shadowMesh(roundedBox(g.width + g.postWidth * 2, g.height * 0.2, g.depth, 0.18), wallMat);
  lintel.position.set(px, baseTop + g.height - g.height * 0.1, pz);
  lintel.rotation.y = angle;
  out.push(lintel);

  const roof = pyramidRoof(g.width + g.postWidth * 2, g.roofHeight, DETAIL.roof[2]);
  roof.position.set(px, baseTop + g.height + g.roofHeight / 2, pz);
  roof.rotation.y = angle;
  out.push(roof);
  return out;
}

/**
 * Places a gatehouse wherever a road end approaches a city wall (within
 * `gate.reach`). Gates are skipped on the tile perimeter (open neighbour seams,
 * no wall) and de-duplicated so converging roads share one gate.
 */
export function generateGates(
  cityPolys: World2[][],
  roads: World2[][],
  baseTop: number,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const placed: World2[] = [];
  for (const road of roads) {
    if (road.length < 2) continue;
    for (const end of [road[0], road[road.length - 1]]) {
      let best: { point: World2; dir: World2; dist: number } | null = null;
      for (const poly of cityPolys) {
        const nb = nearestBoundary(end, poly);
        if (nb.dist < TOWN.gate.reach && !onTilePerimeter(nb.point) && (!best || nb.dist < best.dist)) {
          best = nb;
        }
      }
      if (best && !placed.some((p) => Math.hypot(p[0] - best!.point[0], p[1] - best!.point[1]) < 0.06)) {
        placed.push(best.point);
        out.push(...gatehouse(best.point, best.dir, baseTop));
      }
    }
  }
  return out;
}
