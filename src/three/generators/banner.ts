import * as THREE from 'three';
import { BANNER } from '../palette';
import {
  type World2, standard, shadowMesh, roundedBox, centroid, pyramidRoof,
  polygonBounds, pointInPolygon, distToPolygonEdge,
} from './util';

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

/** A thin extruded white meeple silhouette, `height` tall, centred on the origin. */
export function meepleEmblem(height: number): THREE.Mesh {
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
  const mesh = new THREE.Mesh(geo, standard(BANNER.meepleWhite));
  mesh.castShadow = true;
  return mesh;
}

// ── Markers ──────────────────────────────────────────────────────────────────

/**
 * A gonfalon: timber pole + crossbar + hanging cloth (swallowtail hem) in the
 * player colour, with a white meeple emblem on the cloth. Built around the
 * origin, then positioned/scaled by the caller via the returned group.
 */
export function playerGonfalon([cx, cz]: World2, baseTop: number, color: string, scale: number): THREE.Group {
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

  // Hanging cloth: a thin box with a swallowtail notch cut from the bottom.
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

  const emblem = meepleEmblem(g.clothHeight * g.emblemFraction);
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
export function playerShield([cx, cz]: World2, baseTop: number, color: string): THREE.Group {
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

  const emblem = meepleEmblem(s.height * s.emblemFraction);
  emblem.position.set(0, s.staveHeight + s.height * 0.45, s.thickness / 2 + 0.001);
  group.add(emblem);

  group.position.set(cx, baseTop, cz);
  return group;
}

/** A small player pennant on a short crossarm, hung from the lantern post. */
function lanternPennant(color: string): THREE.Group {
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

  const emblem = meepleEmblem(b.height * b.emblemFraction);
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
export function roadLantern([cx, cz]: World2, color: string | null): THREE.Group {
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

  if (color) group.add(lanternPennant(color));

  group.position.set(cx, 0, cz);
  return group;
}
