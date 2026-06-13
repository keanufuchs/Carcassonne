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
import { disableTileContentRaycast } from '../../three/regionHighlight';
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
}

const EMPTY: ReadonlySet<number> = new Set();
const _markerWorld = new THREE.Vector3();

/**
 * One placed tile: procedural geometry + per-feature ownership markers, with a
 * full hover/click interaction layer. Hovering reports the feature upward so the
 * board can light the whole feature across tiles; player markers billboard to the
 * camera each frame. The last tile additionally accepts meeple-target clicks.
 */
export function PlacedTile3D({ placed, registry, players, controller, hover, onHoverFeature, targets }: Props) {
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

  const reportHover = (localId: number | null) => {
    if (localId === null) return onHoverFeature(null);
    const fid = registry.segmentToFeature.get(segmentKey({ tileId: placed.tileId, localId }));
    onHoverFeature(fid ?? null);
  };

  return (
    <group position={[placed.coord.x, 0, placed.coord.y]} rotation={[0, rotationY, 0]}>
      <primitive object={tileGroup} />
      <primitive object={markers} />
      <RegionInteractionLayer
        tileGroup={tileGroup}
        regions={regions}
        highlightLocalIds={activeLocalIds}
        highlightColor={hover?.color ?? ''}
        onHoverLocalId={reportHover}
        clickableLocalIds={clickableLocalIds}
        onClickLocalId={
          targets ? (localId) => controller.placeMeeple({ tileId: placed.tileId, localId }) : undefined
        }
      />
    </group>
  );
}
