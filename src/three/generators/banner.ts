import * as THREE from 'three';
import { BANNER } from '../palette';
import { TILE_SIZE } from '../palette';
import {
  type World2, standard, shadowMesh, roundedBox, centroid, pyramidRoof,
  polygonBounds, pointInPolygon, distToPolygonEdge,
} from './util';

const CLOTH_ROUGHNESS = 0.75;

/**
 * Banner-based ownership markers. Pure Three.js geometry primitives plus the
 * anchor maths that decides where each marker stands. Orchestration (which
 * marker per claim, road tinting) lives in `../claimMarkers.ts`.
 * See docs/superpowers/specs/2026-06-12-banner-ownership-visualization-design.md.
 */

// ── Anchors ──────────────────────────────────────────────────────────────────

/** City marker anchor: the centroid of every polygon part of the city. */
export function cityAnchor(parts: World2[][]): World2 {
  return centroid(parts.flat());
}

const SHIELD_EDGE_MARGIN = 0.04;

/** True when `p` lies inside any city part with clearance from its boundary. */
function insideCityParts(p: World2, parts: World2[][]): boolean {
  return parts.some((poly) => pointInPolygon(p, poly) && distToPolygonEdge(p, poly) >= SHIELD_EDGE_MARGIN);
}

/** Furthest distance from `anchor` along `dir` that still lies inside the city. */
function maxReachFromAnchor(anchor: World2, parts: World2[][], dir: World2): number {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const dx = dir[0] / len;
  const dz = dir[1] / len;
  const inside = (d: number): boolean => insideCityParts([anchor[0] + dx * d, anchor[1] + dz * d], parts);

  let lo = 0;
  let hi = TILE_SIZE;
  if (inside(hi)) return hi;
  while (hi - lo > 0.003) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Shielded-city heraldic banner anchor: as far from the claim gonfalon anchor
 * (`cityAnchor`) as the city polygon allows, so the two markers sit on opposite
 * sides of the settlement instead of crowding the centroid.
 */
export function cityShieldAnchor(parts: World2[][]): World2 {
  const anchor = cityAnchor(parts);
  let bestPos = anchor;
  let bestDist = 0;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const dir: World2 = [Math.cos(a), Math.sin(a)];
    const reach = maxReachFromAnchor(anchor, parts, dir);
    if (reach > bestDist) {
      bestDist = reach;
      bestPos = [anchor[0] + dir[0] * reach, anchor[1] + dir[1] * reach];
    }
  }
  return bestPos;
}

/**
 * Field marker anchor: the sampled interior point that is farthest from both the
 * field boundary AND any obstacle (e.g. a monastery building, which sits inside
 * the field polygon). Maximising `min(edgeDist, obstacleDist)` keeps the pole off
 * the boundary and clear of the cloister, instead of landing dead-centre on it.
 */
export function fieldAnchor(poly: World2[], obstacles: World2[] = []): World2 {
  const { minX, minZ, maxX, maxZ } = polygonBounds(poly);
  const steps = 24;
  const score = (p: World2): number => {
    const edge = distToPolygonEdge(p, poly);
    const obs = obstacles.length
      ? Math.min(...obstacles.map((o) => Math.hypot(p[0] - o[0], p[1] - o[1])))
      : Infinity;
    return Math.min(edge, obs);
  };
  let best: World2 = centroid(poly);
  let bestScore = pointInPolygon(best, poly) ? score(best) : -Infinity;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const p: World2 = [minX + ((maxX - minX) * i) / steps, minZ + ((maxZ - minZ) * j) / steps];
      if (!pointInPolygon(p, poly)) continue;
      const s = score(p);
      if (s > bestScore) { bestScore = s; best = p; }
    }
  }
  return best;
}

/**
 * Road lantern anchor: a point beside the road's centreline midpoint, offset
 * perpendicular toward the tile centre so the lantern stands clear of the paving
 * and never lands off-tile on a border road. Centreline is in world space.
 */
export function roadLanternAnchor(centerline: World2[]): World2 {
  const n = centerline.length;
  const i = Math.floor(n / 2);
  const a = centerline[Math.max(0, i - 1)];
  const b = centerline[Math.min(n - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let px = -(b[1] - a[1]) / len; // perpendicular to the local direction
  let pz = (b[0] - a[0]) / len;
  const [mx, mz] = centerline[i];
  // Flip to the side that points toward the tile centre (origin).
  if (px * -mx + pz * -mz < 0) { px = -px; pz = -pz; }
  return [mx + px * BANNER.lantern.offset, mz + pz * BANNER.lantern.offset];
}

// ── Meeple emblem ────────────────────────────────────────────────────────────

/** SVG meeple silhouette (viewBox 0..100, y-down) — mirrors ui/board/MeepleIcon. */
const MEEPLE_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [35, 90], [15, 90], [22, 60], [5, 50], [10, 35], [30, 35],
  // head arc (sampled from the C 30 10, 70 10, 70 35 cubic)
  [33, 22], [50, 14], [67, 22], [70, 35],
  [90, 35], [95, 50], [78, 60], [85, 90], [65, 90], [50, 70],
];

/** A thin extruded meeple silhouette, `height` tall, centred on the origin. Uses meepleWhite by default. */
export function meepleEmblem(height: number, color: string = BANNER.meepleWhite): THREE.Mesh {
  const shape = new THREE.Shape();
  // Map SVG (0..100, y-down) → centred local XY (y-up), unit-ish then scaled.
  const toLocal = ([sx, sy]: readonly [number, number]): [number, number] => [
    (sx - 50) / 100,
    (50 - sy) / 100,
  ];
  const [mx, my] = toLocal(MEEPLE_OUTLINE[0]);
  shape.moveTo(mx, my);
  for (let i = 1; i < MEEPLE_OUTLINE.length; i++) {
    const [x, y] = toLocal(MEEPLE_OUTLINE[i]);
    shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  geo.scale(height, height, 0.012);
  const mesh = new THREE.Mesh(geo, standard(color));
  mesh.castShadow = true;
  return mesh;
}

// ── Markers ──────────────────────────────────────────────────────────────────

/** Round-arch tombstone silhouette (Shape in local XY, hem at y=0, crest at y=h). */
function tombstoneSilhouette(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, h * 0.55);
  shape.quadraticCurveTo(-hw, h, 0, h);
  shape.quadraticCurveTo(hw, h, hw, h * 0.55);
  shape.lineTo(hw, 0);
  shape.closePath();
  return shape;
}

/**
 * Cloth hood that drapes over the tombstone crest: a slightly expanded copy of
 * the upper silhouette with a gently scalloped hem. The hood is extruded across
 * the stone's depth plus an overhang on both sides so it visually wraps the top.
 */
function hoodSilhouette(stoneW: number, stoneH: number, hemFraction: number, crestFraction: number, widthFactor: number): { shape: THREE.Shape; hemY: number; topY: number } {
  const hemY = stoneH * hemFraction;
  const topY = stoneH * crestFraction;
  const hw = (stoneW * widthFactor) / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, hemY + 0.012);
  shape.lineTo(-hw, stoneH * 0.62);
  shape.quadraticCurveTo(-hw, topY, 0, topY);
  shape.quadraticCurveTo(hw, topY, hw, stoneH * 0.62);
  shape.lineTo(hw, hemY + 0.012);
  shape.quadraticCurveTo(hw * 0.55, hemY - 0.012, hw * 0.25, hemY + 0.005);
  shape.quadraticCurveTo(0, hemY + 0.018, -hw * 0.25, hemY + 0.005);
  shape.quadraticCurveTo(-hw * 0.55, hemY - 0.012, -hw, hemY + 0.012);
  shape.closePath();
  return { shape, hemY, topY };
}

/** Soil mound + two flanking rubble stones + a small pebble + two grass tufts. */
function addTombstoneBase(group: THREE.Group, w: number, d: number): void {
  const mound = shadowMesh(roundedBox(w + 0.10, 0.022, d + 0.08, 0.4), standard(BANNER.tombstoneMound));
  mound.position.y = 0.011;
  group.add(mound);

  const rubbleL = shadowMesh(roundedBox(0.045, 0.038, 0.04, 0.5), standard(BANNER.tombstoneRubble));
  rubbleL.position.set(-w * 0.62, 0.019, d * 0.45);
  rubbleL.rotation.y = 0.4;
  group.add(rubbleL);

  const rubbleR = shadowMesh(roundedBox(0.05, 0.032, 0.044, 0.5), standard('#a59c89'));
  rubbleR.position.set(w * 0.62, 0.016, d * 0.55);
  rubbleR.rotation.y = -0.6;
  group.add(rubbleR);

  const pebble = shadowMesh(new THREE.SphereGeometry(0.011, 8, 6), standard('#bfb6a3'));
  pebble.position.set(-w * 0.15, 0.011, d * 0.7);
  pebble.scale.set(1, 0.6, 1.2);
  group.add(pebble);

  const grassMat = new THREE.MeshStandardMaterial({ color: BANNER.tombstoneGrass, roughness: 0.95, flatShading: true });
  for (const [x, z, s] of [[-w * 0.4, d * 0.6, 1] as const, [w * 0.4, d * 0.7, 0.85] as const]) {
    const tuft = shadowMesh(new THREE.ConeGeometry(0.011 * s, 0.028 * s, 5), grassMat);
    tuft.position.set(x, 0.014 * s, z);
    group.add(tuft);
  }
}

/**
 * Field ownership marker: a weathered round-arched tombstone with a player-
 * coloured fabric hood draped over the crest and a meeple emblem on the front
 * of the hood. The hood is one continuous extruded solid (not a flat banner),
 * which reads as fabric thickness instead of a paper-thin pennant. Cities
 * still use the pole-and-cloth `playerGonfalon` below.
 */
export function playerTombstone([cx, cz]: World2, baseTop: number, color: string, scale: number, emblemColor: string = BANNER.meepleWhite): THREE.Group {
  const t = BANNER.tombstone;
  const group = new THREE.Group();

  // Tombstone slab.
  const stoneGeo = new THREE.ExtrudeGeometry(tombstoneSilhouette(t.stoneW, t.stoneH), {
    depth: t.stoneD, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 2, curveSegments: 18,
  });
  stoneGeo.translate(0, 0, -t.stoneD / 2);
  const stone = shadowMesh(stoneGeo, standard(BANNER.tombstoneStone));
  group.add(stone);

  addTombstoneBase(group, t.stoneW, t.stoneD);

  // Hood: one solid 3D cap wrapping the upper portion of the stone.
  const hood = hoodSilhouette(t.stoneW, t.stoneH, t.hemFraction, t.crestFraction, t.hoodWidthFactor);
  const hoodDepth = t.stoneD + 2 * t.hoodOverhangDepth;
  const hoodGeo = new THREE.ExtrudeGeometry(hood.shape, {
    depth: hoodDepth, bevelEnabled: true, bevelSize: t.hoodBevel, bevelThickness: t.hoodBevel, bevelSegments: 3, curveSegments: 24,
  });
  hoodGeo.translate(0, 0, -hoodDepth / 2);
  const hoodMat = new THREE.MeshStandardMaterial({ color, roughness: CLOTH_ROUGHNESS, metalness: 0 });
  const hoodMesh = shadowMesh(hoodGeo, hoodMat);
  group.add(hoodMesh);

  // Meeple emblem inset on the hood's front face.
  const emblem = meepleEmblem((hood.topY - hood.hemY) * t.emblemFraction, emblemColor);
  emblem.position.set(0, (hood.topY + hood.hemY) / 2, hoodDepth / 2 + t.hoodBevel + 0.001);
  group.add(emblem);

  group.scale.setScalar(scale);
  group.position.set(cx, baseTop, cz);
  return group;
}

/**
 * City ownership marker: a gonfalon — timber pole + crossbar + hanging cloth
 * (swallowtail hem) in the player colour, with a meeple emblem on the cloth.
 * Built around the origin, then positioned/scaled by the caller via the
 * returned group.
 */
export function playerGonfalon([cx, cz]: World2, baseTop: number, color: string, scale: number, emblemColor: string = BANNER.meepleWhite): THREE.Group {
  const g = BANNER.gonfalon;
  const group = new THREE.Group();
  const poleMat = standard(BANNER.pole);

  const pole = shadowMesh(
    new THREE.CylinderGeometry(g.poleRadius, g.poleRadius, g.poleHeight, 6), poleMat,
  );
  pole.position.y = g.poleHeight / 2;
  group.add(pole);

  const finial = shadowMesh(new THREE.SphereGeometry(g.poleRadius * 1.8, 6, 5), standard(BANNER.finial));
  finial.position.y = g.poleHeight;
  group.add(finial);

  const crossbar = shadowMesh(
    roundedBox(g.crossbarWidth, g.crossbarThickness, g.crossbarThickness, 0.3), poleMat,
  );
  crossbar.position.y = g.poleHeight - 0.01;
  group.add(crossbar);

  const clothTop = g.poleHeight - 0.02;
  const notch = g.clothHeight * g.tailNotch;
  const clothShape = new THREE.Shape();
  const hw = g.clothWidth / 2;
  clothShape.moveTo(-hw, 0);
  clothShape.lineTo(-hw, -g.clothHeight);
  clothShape.lineTo(-hw / 2, -g.clothHeight + notch);
  clothShape.lineTo(0, -g.clothHeight);
  clothShape.lineTo(hw / 2, -g.clothHeight + notch);
  clothShape.lineTo(hw, -g.clothHeight);
  clothShape.lineTo(hw, 0);
  clothShape.closePath();
  const clothGeo = new THREE.ExtrudeGeometry(clothShape, { depth: g.clothThickness, bevelEnabled: false });
  const cloth = new THREE.Mesh(clothGeo, standard(color));
  cloth.castShadow = true;
  cloth.position.set(0, clothTop, g.clothThickness / 2);
  group.add(cloth);

  const emblem = meepleEmblem(g.clothHeight * g.emblemFraction, emblemColor);
  emblem.position.set(0, clothTop - g.clothHeight * 0.5, g.clothThickness + 0.001);
  group.add(emblem);

  group.scale.setScalar(scale);
  group.position.set(cx, baseTop, cz);
  return group;
}

/**
 * A heraldic shield on a short stave: a rounded crest in the player colour with
 * a white meeple emblem. Used for monasteries, mounted at the roof apex.
 */
export function playerShield([cx, cz]: World2, baseTop: number, color: string, emblemColor: string = BANNER.meepleWhite): THREE.Group {
  const s = BANNER.shield;
  const group = new THREE.Group();

  const stave = shadowMesh(
    new THREE.CylinderGeometry(s.staveRadius, s.staveRadius, s.staveHeight, 6), standard(BANNER.pole),
  );
  stave.position.y = s.staveHeight / 2;
  group.add(stave);

  const crest = shadowMesh(roundedBox(s.width, s.height, s.thickness, 0.3), standard(color));
  crest.position.set(0, s.staveHeight + s.height * 0.45, 0);
  group.add(crest);

  const emblem = meepleEmblem(s.height * s.emblemFraction, emblemColor);
  emblem.position.set(0, s.staveHeight + s.height * 0.45, s.thickness / 2 + 0.001);
  group.add(emblem);

  group.position.set(cx, baseTop, cz);
  return group;
}

/** A small player pennant on a short crossarm, hung from the lantern post. */
function lanternPennant(color: string, emblemColor: string = BANNER.meepleWhite): THREE.Group {
  const L = BANNER.lantern;
  const b = L.banner;
  const group = new THREE.Group();
  const topY = L.postHeight * b.mountFraction;
  const clothX = L.postRadius + b.width / 2;

  const arm = shadowMesh(
    new THREE.CylinderGeometry(L.postRadius * 0.6, L.postRadius * 0.6, clothX + b.width / 2, 5),
    standard(BANNER.pole),
  );
  arm.rotation.z = Math.PI / 2;
  arm.position.set((clothX + b.width / 2) / 2, topY, 0);
  group.add(arm);

  const cloth = new THREE.Mesh(roundedBox(b.width, b.height, b.thickness, 0.12), standard(color));
  cloth.castShadow = true;
  cloth.position.set(clothX, topY - b.height / 2, b.thickness / 2);
  group.add(cloth);

  const emblem = meepleEmblem(b.height * b.emblemFraction, emblemColor);
  emblem.position.set(clothX, topY - b.height / 2, b.thickness + 0.001);
  group.add(emblem);

  return group;
}

/**
 * A wayside lantern that marks a road's ownership. The post + glowing housing
 * are always present (neutral when `color` is null); a non-null player colour
 * hangs a pennant on the post. Built around the origin, positioned by the
 * caller via the returned group's transform.
 */
export function roadLantern([cx, cz]: World2, color: string | null, emblemColor: string = BANNER.meepleWhite): THREE.Group {
  const L = BANNER.lantern;
  const group = new THREE.Group();

  const post = shadowMesh(
    new THREE.CylinderGeometry(L.postRadius, L.postRadius * 1.3, L.postHeight, 6),
    standard(BANNER.pole),
  );
  post.position.y = L.postHeight / 2;
  group.add(post);

  // Glowing housing — emissive so it reads as a lit lantern under the warm key light.
  const housingY = L.postHeight + L.bodySize / 2;
  const glow = new THREE.Mesh(
    roundedBox(L.bodySize, L.bodySize * 1.15, L.bodySize, 0.18),
    new THREE.MeshStandardMaterial({
      color: L.glow,
      emissive: new THREE.Color(L.glow),
      emissiveIntensity: L.glowIntensity,
      roughness: 0.5,
      metalness: 0,
    }),
  );
  glow.position.y = housingY;
  group.add(glow);

  // Iron cap roof + finial.
  const cap = pyramidRoof(L.bodySize * 1.25, L.capHeight, L.frame);
  cap.position.y = L.postHeight + L.bodySize * 1.15 + L.capHeight / 2;
  group.add(cap);

  if (color) {
    const pennant = lanternPennant(color, emblemColor);
    pennant.name = 'road-pennant';
    group.add(pennant);
  }

  group.position.set(cx, 0, cz);
  return group;
}
