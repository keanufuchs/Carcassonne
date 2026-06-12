import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { TileRegions } from '../../src/three/svgRegions';
import {
  buildRegionHitTargets,
  buildRegionHighlightShells,
  SEGMENT_MESH_TAG,
  setHighlightedLocalId,
  setMeshHighlight,
  setTileRegionHighlight,
  tagSegmentMeshes,
} from '../../src/three/regionHighlight';

const sampleRegions: TileRegions = {
  polygons: [
    { localId: 0, kind: 'FIELD', points: [[0, 0], [100, 0], [100, 100], [0, 100]] },
    { localId: 1, kind: 'CITY', points: [[0, 0], [100, 0], [100, 50], [0, 50]] },
  ],
  roads: [{ localId: 2, centerline: [[50, 0], [50, 100]], width: 10 }],
  markers: [{ localId: 3, pos: [50, 50], radius: 12 }],
};

describe('buildRegionHitTargets', () => {
  it('registers FIELD targets before other kinds for paint-order parity', () => {
    const targets = buildRegionHitTargets(sampleRegions);
    const kinds = targets.map((t) => t.kind);
    const firstField = kinds.indexOf('FIELD');
    const firstCity = kinds.indexOf('CITY');
    const firstRoad = kinds.indexOf('ROAD');
    expect(firstField).toBeLessThan(firstCity);
    expect(firstCity).toBeLessThan(firstRoad);
  });

  it('creates one hit mesh per authored region shape', () => {
    expect(buildRegionHitTargets(sampleRegions)).toHaveLength(4);
  });
});

describe('buildRegionHighlightShells', () => {
  it('creates footprint shells for polygons and roads only', () => {
    expect(buildRegionHighlightShells(sampleRegions)).toHaveLength(3);
  });

  it('starts with all highlight shells hidden', () => {
    for (const shell of buildRegionHighlightShells(sampleRegions)) {
      expect(shell.mesh.visible).toBe(false);
    }
  });

  it('keeps city highlights on the tile footprint, not above buildings', () => {
    const city = buildRegionHighlightShells(sampleRegions).find((s) => s.kind === 'CITY')!;
    expect(city.mesh.position.y).toBeLessThan(0.1);
  });
});

describe('setHighlightedLocalId', () => {
  it('reveals only shells for the hovered localId', () => {
    const shells = buildRegionHighlightShells(sampleRegions);
    setHighlightedLocalId(shells, 1);
    const visible = shells.filter((s) => s.mesh.visible);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.localId).toBe(1);
  });

  it('hides every shell when hover clears', () => {
    const shells = buildRegionHighlightShells(sampleRegions);
    setHighlightedLocalId(shells, 2);
    setHighlightedLocalId(shells, null);
    expect(shells.every((s) => !s.mesh.visible)).toBe(true);
  });
});

describe('setMeshHighlight', () => {
  it('applies and restores emissive state on tagged monastery meshes', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: '#ccc' }),
    );
    group.add(mesh);
    tagSegmentMeshes(group, 3, 'MONASTERY');

    const mat = mesh.material as THREE.MeshStandardMaterial;
    const originalEmissive = mat.emissive.getHex();
    const originalIntensity = mat.emissiveIntensity;

    setMeshHighlight(mesh, true);
    expect(mat.emissiveIntensity).toBeGreaterThan(0.5);

    setMeshHighlight(mesh, false);
    expect(mat.emissive.getHex()).toBe(originalEmissive);
    expect(mat.emissiveIntensity).toBe(originalIntensity);
  });
});

describe('setTileRegionHighlight', () => {
  it('highlights tagged meshes instead of footprint shells for monastery', () => {
    const tileGroup = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.1),
      new THREE.MeshStandardMaterial({ color: '#ddd' }),
    );
    tileGroup.add(mesh);
    tagSegmentMeshes(tileGroup, 3, 'MONASTERY');

    const shells = buildRegionHighlightShells(sampleRegions);
    setTileRegionHighlight(tileGroup, shells, 3);

    expect(shells.every((s) => !s.mesh.visible)).toBe(true);
    expect((mesh.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0);
    expect(mesh.userData[SEGMENT_MESH_TAG]).toBe(3);
  });
});
