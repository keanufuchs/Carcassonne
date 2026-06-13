import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { SegmentKind } from '../core/types/tile';
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
  /** Controlled: localIds on this tile to light up (computed from feature membership). */
  highlightLocalIds: ReadonlySet<number>;
  /** Colour for the active highlight (gold during meeple placement, owner colour otherwise). */
  highlightColor: string;
  onHoverLocalId: (localId: number | null) => void;
  /** When set, only these localIds are clickable (e.g. valid meeple targets). */
  clickableLocalIds?: ReadonlySet<number>;
  onClickLocalId?: (localId: number, kind: SegmentKind) => void;
}

/**
 * Invisible hit meshes over every region of one tile, plus the highlight shells.
 * Hover reports the region's localId upward; the board resolves it to a feature
 * and feeds back the localIds (across all its tiles) to light up. Clicking is
 * gated by `clickableLocalIds` so only valid meeple targets commit a placement.
 */
export function RegionInteractionLayer({
  tileGroup,
  regions,
  highlightLocalIds,
  highlightColor,
  onHoverLocalId,
  clickableLocalIds,
  onClickLocalId,
}: Props) {
  const { gl } = useThree();
  const hitTargets = useMemo(() => buildRegionHitTargets(regions), [regions]);
  const highlightShells = useMemo(() => buildRegionHighlightShells(regions), [regions]);

  useEffect(() => {
    setTileRegionHighlight(tileGroup, highlightShells, highlightLocalIds, highlightColor);
  }, [tileGroup, highlightShells, highlightLocalIds, highlightColor]);

  useEffect(() => () => {
    setTileRegionHighlight(tileGroup, highlightShells, EMPTY);
    gl.domElement.style.cursor = 'auto';
    disposeShells(highlightShells);
    disposeMeshes(hitTargets.map((t) => t.mesh));
  }, [gl, tileGroup, highlightShells, hitTargets]);

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
          onClick={handleClick(localId, kind)}
        />
      ))}
    </group>
  );
}

const EMPTY: ReadonlySet<number> = new Set();

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
