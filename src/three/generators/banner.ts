import * as THREE from 'three';
import { BANNER } from '../palette';
import {
  type World2, standard, shadowMesh, roundedBox, centroid,
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
 * Field marker anchor: the "visual center" — the sampled interior point farthest
 * from the boundary (pole of inaccessibility). Guarantees the pole lands inside
 * even for concave fields, where the plain centroid can fall in a notch.
 */
export function fieldAnchor(poly: World2[]): World2 {
  const { minX, minZ, maxX, maxZ } = polygonBounds(poly);
  const steps = 16;
  let best: World2 = centroid(poly);
  let bestDist = pointInPolygon(best, poly) ? distToPolygonEdge(best, poly) : -Infinity;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const p: World2 = [minX + ((maxX - minX) * i) / steps, minZ + ((maxZ - minZ) * j) / steps];
      if (!pointInPolygon(p, poly)) continue;
      const d = distToPolygonEdge(p, poly);
      if (d > bestDist) { bestDist = d; best = p; }
    }
  }
  return best;
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
