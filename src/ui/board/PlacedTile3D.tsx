import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { PlacedTile } from '../../core/tile/Tile';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { FeatureId, Player, SegmentRef } from '../../core/types';
import { segmentKey } from '../../core/types';
import type { GameController } from '../../controller/GameController';
import { layoutRegions } from '../../three/layoutRegions';
import { generateTile } from '../../three/generateTile';
import { buildClaimMarkers } from '../../three/claimMarkers';
import {
  buildRegionHighlightShells,
  disableTileContentRaycast,
  setTileRegionHighlight,
  type RegionHighlightShell,
} from '../../three/regionHighlight';
import { SEGMENT_HIGHLIGHT } from '../../shared/segmentHighlight';
import { RegionInteractionLayer } from '../../three/RegionInteractionLayer';
import {
  claimsSignature,
  disposeObject,
  featureLocalIdsOnTile,
  getPrototype,
  tileClaims,
} from './board3d';

/** Board-level hover: which feature is lit and in what colour. */
export interface BoardHover {
  featureId: FeatureId;
  color: string;
}

interface Props {
  placed: PlacedTile;
  registry: FeatureRegistry;
  players: Player[];
  controller: GameController;
  /** Current board hover; this tile lights up its own segments in that feature. */
  hover: BoardHover | null;
  /** Reports the feature under the pointer (or null on leave) to the board. */
  onHoverFeature: (featureId: FeatureId | null) => void;
  /** Valid meeple targets — only passed to the last placed tile during PLACING_MEEPLE. */
  targets?: SegmentRef[];
  /** When false the interaction/highlight layer is skipped entirely (non-meeple phases). */
  interactive?: boolean;
}

const EMPTY: ReadonlySet<number> = new Set();
const _markerWorld = new THREE.Vector3();

/**
 * One placed tile: procedural geometry + per-feature ownership markers, with a
 * full hover/click interaction layer. Hovering reports the feature upward so the
 * board can light the whole feature across tiles; player markers billboard to the
 * camera each frame. The last tile additionally accepts meeple-target clicks.
 */
export function PlacedTile3D({ placed, registry, players, controller, hover, onHoverFeature, targets, interactive = false }: Props) {
  const proto = useMemo(() => getPrototype(placed.prototypeId), [placed.prototypeId]);
  const seed = placed.prototypeId;
  const regions = useMemo(() => layoutRegions(proto, seed), [proto, seed]);

  const tileGroup = useMemo(() => {
    const group = generateTile(proto, regions, seed);
    disableTileContentRaycast(group);
    return group;
  }, [proto, regions, seed]);
  useEffect(() => () => disposeObject(tileGroup), [tileGroup]);

  const claims = tileClaims(placed, registry, players);
  const claimSig = claimsSignature(claims);
  const markers = useMemo(
    () => buildClaimMarkers(regions, claims),
    // claims is rederived every render; claimSig captures the only relevant change.
    [regions, claimSig], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => disposeObject(markers), [markers]);

  const rotationY = -(placed.rotation * Math.PI) / 180;

  // Player-coloured markers always face the camera (locked isometric view).
  useFrame(({ camera }) => {
    markers.traverse((obj) => {
      if (!obj.userData.billboard) return;
      obj.getWorldPosition(_markerWorld);
      const angle = Math.atan2(camera.position.x - _markerWorld.x, camera.position.z - _markerWorld.z);
      obj.rotation.y = angle - rotationY;
    });
  });

  // Which of this tile's localIds belong to the hovered feature.
  const activeLocalIds = useMemo(() => {
    if (!hover) return EMPTY;
    const feature = registry.features.get(hover.featureId);
    return feature ? featureLocalIdsOnTile(feature, placed.tileId) : EMPTY;
  }, [hover, registry, placed.tileId]);

  const clickableLocalIds = useMemo(
    () => (targets ? new Set(targets.map((t) => t.localId)) : undefined),
    [targets],
  );

  // Highlight shells for this tile — always built so the feature glow can span
  // all tiles, not just the interactive one.
  const highlightShells = useMemo(() => buildRegionHighlightShells(regions), [regions]);

  // Drive the shell visibility + emissive highlight whenever the active set or
  // colour changes. Runs on every tile so the whole feature lights up.
  useEffect(() => {
    setTileRegionHighlight(tileGroup, highlightShells, activeLocalIds, hover?.color ?? SEGMENT_HIGHLIGHT.glowColor);
  }, [tileGroup, highlightShells, activeLocalIds, hover?.color]);

  // Clean up shells on unmount.
  useEffect(() => () => {
    setTileRegionHighlight(tileGroup, highlightShells, EMPTY);
    disposeShells(highlightShells);
  }, [tileGroup, highlightShells]);

  // Only report hover for claimable segments so the highlight only fires on
  // features the player can actually join.
  const reportHover = (localId: number | null) => {
    if (localId === null) return onHoverFeature(null);
    if (clickableLocalIds && !clickableLocalIds.has(localId)) return onHoverFeature(null);
    const fid = registry.segmentToFeature.get(segmentKey({ tileId: placed.tileId, localId }));
    onHoverFeature(fid ?? null);
  };

  return (
    <group position={[placed.coord.x, 0, placed.coord.y]} rotation={[0, rotationY, 0]}>
      <primitive object={tileGroup} />
      <primitive object={markers} />
      {highlightShells.map((shell) => (
        <primitive key={shell.mesh.uuid} object={shell.mesh} />
      ))}
      {interactive && (
        <RegionInteractionLayer
          regions={regions}
          onHoverLocalId={reportHover}
          clickableLocalIds={clickableLocalIds}
          onClickLocalId={
            targets ? (localId) => controller.placeMeeple({ tileId: placed.tileId, localId }) : undefined
          }
        />
      )}
    </group>
  );
}

function disposeShells(shells: RegionHighlightShell[]): void {
  for (const shell of shells) {
    shell.mesh.geometry.dispose();
    (shell.mesh.material as THREE.MeshBasicMaterial).dispose();
  }
}
