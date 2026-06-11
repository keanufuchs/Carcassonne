import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
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

// ── Iteration 4: rounded geometry + instancing ──────────────────────────────

/** A soft, Townscaper-style rounded box. */
export function roundedBox(w: number, h: number, d: number, radiusFactor = 0.16): THREE.BufferGeometry {
  const radius = Math.min(w, h, d) * radiusFactor;
  return new RoundedBoxGeometry(w, h, d, 2, radius);
}

/** A unit (1×1×1) rounded box for use as instanced geometry (scaled per instance). */
export function unitRoundedBox(radiusFactor = 0.16): THREE.BufferGeometry {
  return new RoundedBoxGeometry(1, 1, 1, 2, radiusFactor);
}

/** A unit 4-sided pyramid (radius/height = 1), pre-aligned to a square base. */
export function unitPyramid(): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(0.72, 1, 4);
  geometry.rotateY(Math.PI / 4);
  return geometry;
}

export interface Instance {
  pos: [number, number, number];
  scale: [number, number, number];
  rotationY?: number;
  color?: string | number;
}

/**
 * Builds a single `InstancedMesh` from per-instance transforms (and optional
 * per-instance colour) — one draw call for many houses/trees. Returns null for
 * an empty set. The base material colour is forced to white when instance
 * colours are supplied so they aren't double-tinted.
 */
export function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  instances: Instance[],
): THREE.InstancedMesh | null {
  if (instances.length === 0) return null;
  const hasColor = instances.some((i) => i.color !== undefined);
  if (hasColor) material.color.set('#ffffff');

  const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  instances.forEach((inst, i) => {
    euler.set(0, inst.rotationY ?? 0, 0);
    quat.setFromEuler(euler);
    pos.set(inst.pos[0], inst.pos[1], inst.pos[2]);
    scale.set(inst.scale[0], inst.scale[1], inst.scale[2]);
    mesh.setMatrixAt(i, matrix.compose(pos, quat, scale));
    if (hasColor) mesh.setColorAt(i, color.set(inst.color ?? '#ffffff'));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Average of a polygon's vertices (used for placing city banners/shields). */
export function centroid(poly: World2[]): World2 {
  let x = 0;
  let z = 0;
  for (const [px, pz] of poly) {
    x += px;
    z += pz;
  }
  return [x / poly.length, z / poly.length];
}
