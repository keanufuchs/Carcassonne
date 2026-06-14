import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { SegmentKind } from '../core/types/tile';
import type { TileRegions } from './svgRegions';
import { buildRegionHitTargets, HIT_EVENT_PRIORITY } from './regionHighlight';

interface Props {
  regions: TileRegions;
  onHoverLocalId: (localId: number | null) => void;
  /** When set, only these localIds are clickable (e.g. valid meeple targets). */
  clickableLocalIds?: ReadonlySet<number>;
  onClickLocalId?: (localId: number, kind: SegmentKind) => void;
}

/**
 * Invisible hit meshes over every region of one tile. Hover reports the
 * region's localId upward so the board can resolve it to a feature and drive
 * the highlight shells (which live in PlacedTile3D and span all tiles of the
 * feature). Clicking is gated by `clickableLocalIds`.
 */
export function RegionInteractionLayer({
  regions,
  onHoverLocalId,
  clickableLocalIds,
  onClickLocalId,
}: Props) {
  const { gl } = useThree();
  const hitTargets = useMemo(() => buildRegionHitTargets(regions), [regions]);

  useEffect(() => () => {
    gl.domElement.style.cursor = 'auto';
    disposeMeshes(hitTargets.map((t) => t.mesh));
  }, [gl, hitTargets]);

  const clickable = (localId: number) => clickableLocalIds === undefined || clickableLocalIds.has(localId);

  const handlePointerOver = (localId: number) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (onClickLocalId && clickable(localId)) gl.domElement.style.cursor = 'pointer';
    onHoverLocalId(localId);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    gl.domElement.style.cursor = 'auto';
    onHoverLocalId(null);
  };

  const handleClick = (localId: number, kind: SegmentKind) => (event: ThreeEvent<MouseEvent>) => {
    if (!onClickLocalId || !clickable(localId)) return;
    event.stopPropagation();
    onClickLocalId(localId, kind);
  };

  return (
    <group name="region-hit">
      {hitTargets.map(({ localId, kind, mesh }) => (
        <primitive
          key={mesh.uuid}
          object={mesh}
          eventPriority={HIT_EVENT_PRIORITY[kind]}
          onPointerOver={handlePointerOver(localId)}
          onPointerOut={handlePointerOut}
          onClick={handleClick(localId, kind)}
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
