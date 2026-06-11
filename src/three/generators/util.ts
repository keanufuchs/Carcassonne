import * as THREE from 'three';
import type { Vec2 } from '../svgRegions';
import { TILE_SIZE, BEVEL } from '../palette';

/** World-space 2D point on the tile's ground plane: [x, z] (y is up). */
export type World2 = [number, number];

/** Maps a raw SVG point (0..100, y-down) to the 1×1 world footprint [x, z]. */
export function svgToWorld([sx, sy]: Vec2): World2 {
  return [sx / 100 - TILE_SIZE / 2, sy / 100 - TILE_SIZE / 2];
}

// ── Deterministic RNG (so detail is stable across re-renders) ────────────────

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Seeded PRNG in [0,1) — mulberry32. */
export function makeRng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ── Polygon helpers (world space) ────────────────────────────────────────────

export interface Bounds { minX: number; minZ: number; maxX: number; maxZ: number }

export function polygonBounds(poly: World2[]): Bounds {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, minZ, maxX, maxZ };
}

export function pointInPolygon([x, z]: World2, poly: World2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    const hit = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly: World2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

function distToSegment([px, pz]: World2, [ax, az]: World2, [bx, bz]: World2): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

/** Shortest distance from a point to the polygon's boundary. */
export function distToPolygonEdge(p: World2, poly: World2[]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    min = Math.min(min, distToSegment(p, poly[j], poly[i]));
  }
  return min;
}

/**
 * Samples jittered grid points that lie inside the polygon and at least
 * `margin` from its boundary — the placement basis for houses/trees.
 */
export function scatterInside(
  poly: World2[],
  rng: () => number,
  opts: { step: number; margin: number; probability: number },
): World2[] {
  const { minX, minZ, maxX, maxZ } = polygonBounds(poly);
  const { step, margin, probability } = opts;
  const points: World2[] = [];
  for (let x = minX + step / 2; x < maxX; x += step) {
    for (let z = minZ + step / 2; z < maxZ; z += step) {
      if (rng() > probability) continue;
      const p: World2 = [x + range(rng, -step / 3, step / 3), z + range(rng, -step / 3, step / 3)];
      if (pointInPolygon(p, poly) && distToPolygonEdge(p, poly) >= margin) points.push(p);
    }
  }
  return points;
}

// ── Mesh helpers ─────────────────────────────────────────────────────────────

export function standard(color: string | number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
}

export function shadowMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Extrudes a closed world-space polygon upward by `height`. The shape's Y uses
 * −z so that after `rotateX(-90°)` the geometry lands the right way round
 * (world Z = polygon z), with a small bevel for soft edges.
 */
export function extrudeWorldPolygon(
  poly: World2[],
  height: number,
  material: THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(poly[0][0], -poly[0][1]);
  for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], -poly[i][1]);
  shape.closePath();

  const bevelThickness = Math.min(BEVEL.size, height * 0.45);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevelThickness,
    bevelEnabled: true,
    bevelThickness,
    bevelSize: BEVEL.size,
    bevelSegments: BEVEL.segments,
    bevelOffset: 0,
  });
  geometry.rotateX(-Math.PI / 2);
  return shadowMesh(geometry, material);
}

/** A square pyramid roof (4-sided cone) sized to cap a `width`×`width` body. */
export function pyramidRoof(width: number, height: number, color: string): THREE.Mesh {
  const radius = width * 0.72; // circumradius so the square base covers the body
  const geometry = new THREE.ConeGeometry(radius, height, 4);
  geometry.rotateY(Math.PI / 4); // align flat faces with the body
  return shadowMesh(geometry, standard(color));
}
