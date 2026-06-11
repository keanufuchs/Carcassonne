import * as THREE from 'three';
import type { TilePrototype } from '../core/types/tile';
import type { TileRegions, Vec2 } from './svgRegions';
import { PALETTE, BASE_COLOR, TILE_SIZE } from './palette';

/**
 * Iteration 1 — procedural 3D generation (feasibility):
 * turns the TS topology + normalised SVG regions into a `THREE.Group` of flat,
 * coloured, extruded zones. This proves the regions are interpreted and located
 * correctly before procedural detail (houses, walls, trees) is layered on in
 * later iterations.
 *
 * Per-kind procedural generators (city/field/road/monastery) will be split into
 * `src/three/generators/*` in iteration 3; for now the dispatch lives here.
 */

/**
 * Maps a raw SVG point (0..100, y-down) into the 2D shape plane used for
 * extrusion. The shape's Y is negated so that after `rotateX(-90°)` the tile
 * lands the right way round in world XZ (world Z = svgY/100 − 0.5).
 */
function toShape2D([sx, sy]: Vec2): Vec2 {
  return [sx / 100 - TILE_SIZE / 2, TILE_SIZE / 2 - sy / 100];
}

function makeMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

/** Extrudes a closed 2D polygon (shape-space points) upward by `height`. */
function extrudePolygon(shapePoints: Vec2[], height: number, color: string): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(shapePoints[0][0], shapePoints[0][1]);
  for (let i = 1; i < shapePoints.length; i++) shape.lineTo(shapePoints[i][0], shapePoints[i][1]);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2); // shape XY plane → world XZ, extrude depth → world +Y
  return new THREE.Mesh(geometry, makeMaterial(color));
}

/** Builds a flat ribbon polygon from a centreline by offsetting ±width/2. */
function roadRibbon(centerlineShape: Vec2[], width: number): Vec2[] {
  const half = width / 2;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < centerlineShape.length; i++) {
    const prev = centerlineShape[Math.max(0, i - 1)];
    const nextPt = centerlineShape[Math.min(centerlineShape.length - 1, i + 1)];
    let dx = nextPt[0] - prev[0];
    let dy = nextPt[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy; // unit normal
    const ny = dx;
    const [cx, cy] = centerlineShape[i];
    left.push([cx + nx * half, cy + ny * half]);
    right.push([cx - nx * half, cy - ny * half]);
  }
  return [...left, ...right.reverse()];
}

/** The ground plate the tile sits on (slightly inset below y=0). */
function basePlate(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(TILE_SIZE, 0.04, TILE_SIZE);
  geometry.translate(0, -0.02, 0);
  return new THREE.Mesh(geometry, makeMaterial(BASE_COLOR));
}

/**
 * Generates the 3D representation of a tile. `proto` carries the topology
 * (kinds, shield, monastery); `regions` carries the SVG-derived boundaries.
 */
export function generateTile(proto: TilePrototype, regions: TileRegions): THREE.Group {
  const group = new THREE.Group();
  group.name = `tile-${proto.id}`;
  group.add(basePlate());

  // CITY / FIELD — extruded area zones.
  for (const region of regions.polygons) {
    const style = PALETTE[region.kind];
    const mesh = extrudePolygon(region.points.map(toShape2D), style.height, style.color);
    mesh.name = `segment-${region.kind}-${region.localId}`;
    group.add(mesh);
  }

  // ROAD — extruded ribbon along the centreline.
  for (const road of regions.roads) {
    if (road.centerline.length < 2) continue;
    const centerlineShape = road.centerline.map(toShape2D);
    const ribbon = roadRibbon(centerlineShape, road.width / 100);
    const style = PALETTE.ROAD;
    const mesh = extrudePolygon(ribbon, style.height, style.color);
    mesh.name = `segment-ROAD-${road.localId}`;
    group.add(mesh);
  }

  // MONASTERY — a building block placed at the marker point.
  for (const marker of regions.markers) {
    const style = PALETTE.MONASTERY;
    const footprint = (marker.radius / 100) * 1.4;
    const geometry = new THREE.BoxGeometry(footprint, style.height, footprint);
    const mesh = new THREE.Mesh(geometry, makeMaterial(style.color));
    const [wx, wz] = [marker.pos[0] / 100 - TILE_SIZE / 2, marker.pos[1] / 100 - TILE_SIZE / 2];
    mesh.position.set(wx, style.height / 2, wz);
    mesh.name = `segment-MONASTERY-${marker.localId}`;
    group.add(mesh);
  }

  return group;
}
