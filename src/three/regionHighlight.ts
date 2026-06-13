import * as THREE from 'three';
import type { SegmentKind } from '../core/types/tile';
import { SEGMENT_HIGHLIGHT, segmentElementId } from '../shared/segmentHighlight';
import type { TileRegions } from './svgRegions';
import { extrudeWorldPolygon, svgToWorld, type World2 } from './generators/util';
import { roadRibbon } from './generators/road';
import { DETAIL, PALETTE } from './palette';

export const SEGMENT_MESH_TAG = 'segmentLocalId' as const;

/** R3F event priority — higher wins when several hit meshes overlap in screen space. */
export const HIT_EVENT_PRIORITY: Record<SegmentKind, number> = {
  FIELD: 0,
  ROAD: 1,
  CITY: 2,
  MONASTERY: 3,
};

/**
 * Highlight shells sit on the segment footprint (like the 2D inline SVG shapes).
 * Monastery uses mesh emissive highlighting on the procedural building instead.
 */
const OVERLAY_TOP_Y: Record<Exclude<SegmentKind, 'MONASTERY'>, number> = {
  FIELD: PALETTE.FIELD.height + 0.01,
  ROAD: PALETTE.ROAD.height + 0.01,
  CITY: DETAIL.cityBaseHeight + 0.01,
};

/** Raycast priority among invisible hit meshes — higher layers win at overlaps. */
const HIT_TOP_Y: Record<SegmentKind, number> = {
  FIELD: OVERLAY_TOP_Y.FIELD + 0.01,
  ROAD: OVERLAY_TOP_Y.ROAD + 0.01,
  CITY: OVERLAY_TOP_Y.CITY + 0.01,
  MONASTERY: 0.05,
};

const HIT_THICKNESS = 0.04;
const OVERLAY_THICKNESS = 0.018;

const GLOW_COLOR = new THREE.Color(SEGMENT_HIGHLIGHT.glowColor);
const _glowScratch = new THREE.Color();

interface SavedMaterialHighlight {
  emissive: number;
  emissiveIntensity: number;
  color: number;
}

const MATERIAL_HL_KEY = '_segmentHl';

export interface RegionHitTarget {
  localId: number;
  kind: SegmentKind;
  mesh: THREE.Mesh;
}

export interface RegionHighlightShell {
  localId: number;
  kind: SegmentKind;
  mesh: THREE.Mesh;
}

function hitMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function highlightMaterial(): THREE.MeshBasicMaterial {
  const color = new THREE.Color(SEGMENT_HIGHLIGHT.glowColor);
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: SEGMENT_HIGHLIGHT.glowOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function liftMesh(mesh: THREE.Mesh, topY: number, thickness: number): THREE.Mesh {
  mesh.position.y = topY - thickness;
  return mesh;
}

function polygonHitMesh(points: World2[], kind: SegmentKind, localId: number): THREE.Mesh {
  const mesh = extrudeWorldPolygon(points, HIT_THICKNESS, hitMaterial());
  mesh.name = `hit-${kind}-${localId}`;
  mesh.userData = { localId, kind, role: 'hit' };
  return liftMesh(mesh, HIT_TOP_Y[kind], HIT_THICKNESS);
}

function polygonHighlightMesh(points: World2[], kind: Exclude<SegmentKind, 'MONASTERY'>, localId: number): THREE.Mesh {
  const mesh = extrudeWorldPolygon(points, OVERLAY_THICKNESS, highlightMaterial());
  mesh.name = `hl-${kind}-${localId}`;
  mesh.userData = { localId, kind, role: 'highlight' };
  mesh.visible = false;
  return liftMesh(mesh, OVERLAY_TOP_Y[kind], OVERLAY_THICKNESS);
}

function roadHitMesh(centerline: World2[], width: number, localId: number): THREE.Mesh | null {
  if (centerline.length < 2) return null;
  const poly = roadRibbon(centerline, width);
  return polygonHitMesh(poly, 'ROAD', localId);
}

function roadHighlightMesh(centerline: World2[], width: number, localId: number): THREE.Mesh | null {
  if (centerline.length < 2) return null;
  const poly = roadRibbon(centerline, width);
  return polygonHighlightMesh(poly, 'ROAD', localId);
}

function monasteryHitDisc(
  pos: World2,
  radius: number,
  localId: number,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius, HIT_THICKNESS, 24);
  const mesh = new THREE.Mesh(geometry, hitMaterial());
  mesh.name = `hit-MONASTERY-${localId}`;
  mesh.userData = { localId, kind: 'MONASTERY' as SegmentKind, role: 'hit' };
  mesh.position.set(pos[0], HIT_TOP_Y.MONASTERY - HIT_THICKNESS / 2, pos[1]);
  return mesh;
}

/** Tags generated segment content so mesh highlights can target the visible geometry. */
export function tagSegmentMeshes(root: THREE.Object3D, localId: number, kind: SegmentKind): void {
  root.name = segmentElementId(kind, localId);
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.userData[SEGMENT_MESH_TAG] = localId;
      obj.userData.segmentKind = kind;
    }
  });
}

/** Applies or removes an emissive highlight (default gold) on a tagged mesh material. */
export function setMeshHighlight(mesh: THREE.Mesh, on: boolean, color?: string): void {
  const glow = color ? _glowScratch.set(color) : GLOW_COLOR;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (!(material instanceof THREE.MeshStandardMaterial)) continue;
    if (on) {
      if (!material.userData[MATERIAL_HL_KEY]) {
        material.userData[MATERIAL_HL_KEY] = {
          emissive: material.emissive.getHex(),
          emissiveIntensity: material.emissiveIntensity,
          color: material.color.getHex(),
        } satisfies SavedMaterialHighlight;
      }
      material.emissive.copy(glow);
      material.emissiveIntensity = 0.52;
      const saved = material.userData[MATERIAL_HL_KEY] as SavedMaterialHighlight;
      material.color.setHex(saved.color);
      material.color.multiplyScalar(SEGMENT_HIGHLIGHT.brightness);
    } else if (material.userData[MATERIAL_HL_KEY]) {
      const saved = material.userData[MATERIAL_HL_KEY] as SavedMaterialHighlight;
      material.emissive.setHex(saved.emissive);
      material.emissiveIntensity = saved.emissiveIntensity;
      material.color.setHex(saved.color);
      delete material.userData[MATERIAL_HL_KEY];
    }
  }
}

/** Procedural tile meshes must not steal pointer events from the hit layer. */
export function disableTileContentRaycast(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.raycast = () => {};
  });
}

/**
 * Invisible hit targets for each authored region. FIELD targets are registered
 * first so CITY/ROAD/MONASTERY layers above them receive pointer events when
 * regions overlap — mirroring the 2D SegmentHitZone paint order.
 */
export function buildRegionHitTargets(regions: TileRegions): RegionHitTarget[] {
  const targets: RegionHitTarget[] = [];

  for (const region of regions.polygons.filter((r) => r.kind === 'FIELD')) {
    const points = region.points.map(svgToWorld);
    targets.push({ localId: region.localId, kind: region.kind, mesh: polygonHitMesh(points, region.kind, region.localId) });
  }
  for (const region of regions.polygons.filter((r) => r.kind !== 'FIELD')) {
    const points = region.points.map(svgToWorld);
    targets.push({ localId: region.localId, kind: region.kind, mesh: polygonHitMesh(points, region.kind, region.localId) });
  }
  for (const road of regions.roads) {
    const centerline = road.centerline.map(svgToWorld);
    const width = road.width / 100;
    const mesh = roadHitMesh(centerline, width, road.localId);
    if (mesh) targets.push({ localId: road.localId, kind: 'ROAD', mesh });
  }
  for (const marker of regions.markers) {
    const pos = svgToWorld(marker.pos);
    const radius = marker.radius / 100;
    targets.push({
      localId: marker.localId,
      kind: 'MONASTERY',
      mesh: monasteryHitDisc(pos, radius, marker.localId),
    });
  }

  return targets;
}

/** Footprint highlight shells for field, road and city regions. */
export function buildRegionHighlightShells(regions: TileRegions): RegionHighlightShell[] {
  const shells: RegionHighlightShell[] = [];

  for (const region of regions.polygons) {
    if (region.kind === 'MONASTERY') continue;
    const points = region.points.map(svgToWorld);
    shells.push({ localId: region.localId, kind: region.kind, mesh: polygonHighlightMesh(points, region.kind, region.localId) });
  }
  for (const road of regions.roads) {
    const centerline = road.centerline.map(svgToWorld);
    const width = road.width / 100;
    const mesh = roadHighlightMesh(centerline, width, road.localId);
    if (mesh) shells.push({ localId: road.localId, kind: 'ROAD', mesh });
  }

  return shells;
}

/**
 * Lights up exactly `activeLocalIds` in `color`: shows their footprint overlays
 * and applies the emissive mesh highlight. The active set is computed by the
 * board from feature membership, so a feature spanning several tiles glows whole.
 */
export function setTileRegionHighlight(
  tileGroup: THREE.Object3D,
  shells: readonly RegionHighlightShell[],
  activeLocalIds: ReadonlySet<number>,
  color: string = SEGMENT_HIGHLIGHT.glowColor,
): void {
  setHighlightedLocalIds(shells, activeLocalIds, color);
  tileGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const segId = obj.userData[SEGMENT_MESH_TAG] as number | undefined;
    if (segId === undefined) return;
    setMeshHighlight(obj, activeLocalIds.has(segId), color);
  });
}

/** Shows the highlight shells whose localId is active (in `color`); hides the rest. */
export function setHighlightedLocalIds(
  shells: readonly RegionHighlightShell[],
  activeLocalIds: ReadonlySet<number>,
  color: string = SEGMENT_HIGHLIGHT.glowColor,
): void {
  for (const shell of shells) {
    const on = activeLocalIds.has(shell.localId);
    shell.mesh.visible = on;
    if (on) (shell.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
}
