import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { TileRegions } from './svgRegions';
import {
  buildRegionHighlightShells,
  buildRegionHitTargets,
  HIT_EVENT_PRIORITY,
  setTileRegionHighlight,
  type RegionHighlightShell,
} from './regionHighlight';

interface Props {
  tileGroup: THREE.Object3D;
  regions: TileRegions;
  hoveredLocalId: number | null;
  onHoverLocalId: (localId: number | null) => void;
}

/**
 * Invisible hit meshes plus gold highlight overlays for tile regions.
 * Interaction mirrors the 2D SegmentHitZone + InlineTile highlight: hover a
 * region on the tile to light up every shape that shares its localId.
 */
export function RegionInteractionLayer({ tileGroup, regions, hoveredLocalId, onHoverLocalId }: Props) {
  const { gl } = useThree();
  const hitTargets = useMemo(() => buildRegionHitTargets(regions), [regions]);
  const highlightShells = useMemo(() => buildRegionHighlightShells(regions), [regions]);

  useEffect(() => {
    setTileRegionHighlight(tileGroup, highlightShells, hoveredLocalId);
  }, [tileGroup, highlightShells, hoveredLocalId]);

  useEffect(() => () => {
    setTileRegionHighlight(tileGroup, highlightShells, null);
    gl.domElement.style.cursor = 'auto';
    disposeShells(highlightShells);
    disposeMeshes(hitTargets.map((t) => t.mesh));
  }, [gl, tileGroup, highlightShells, hitTargets]);

  const handlePointerOver = (localId: number) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    gl.domElement.style.cursor = 'pointer';
    onHoverLocalId(localId);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    gl.domElement.style.cursor = 'auto';
    onHoverLocalId(null);
  };

  return (
    <group name="region-interaction">
      {highlightShells.map((shell) => (
        <primitive key={shell.mesh.uuid} object={shell.mesh} />
      ))}
      {hitTargets.map(({ localId, kind, mesh }) => (
        <primitive
          key={mesh.uuid}
          object={mesh}
          eventPriority={HIT_EVENT_PRIORITY[kind]}
          onPointerOver={handlePointerOver(localId)}
          onPointerOut={handlePointerOut}
        />
      ))}
    </group>
  );
}

function disposeMeshes(meshes: THREE.Mesh[]): void {
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    const { material } = mesh;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  }
}

function disposeShells(shells: RegionHighlightShell[]): void {
  disposeMeshes(shells.map((s) => s.mesh));
}
