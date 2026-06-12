import { useEffect, useMemo, useState } from 'react';
import type { PlacedTile } from '../../core/tile/Tile';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player, SegmentRef } from '../../core/types';
import type { GameController } from '../../controller/GameController';
import { layoutRegions } from '../../three/layoutRegions';
import { generateTile } from '../../three/generateTile';
import { buildClaimMarkers } from '../../three/claimMarkers';
import { disableTileContentRaycast } from '../../three/regionHighlight';
import { RegionInteractionLayer } from '../../three/RegionInteractionLayer';
import {
  disposeObject,
  filterRegions,
  getPrototype,
  meeplesSignature,
  segmentCentroid,
  tileMeeples,
  toClaimMap,
} from './board3d';

const MEEPLE_Y = 0.12;

/** A single 3D meeple — low-poly capsule in the owner's colour. */
function MeepleCapsule({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position} castShadow>
      <capsuleGeometry args={[0.06, 0.08, 4, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

interface Props {
  placed: PlacedTile;
  registry: FeatureRegistry;
  players: Player[];
  controller: GameController;
  /** Valid meeple targets — only passed to the last placed tile during PLACING_MEEPLE. */
  targets?: SegmentRef[];
}

/**
 * One placed tile: procedural geometry (`generateTile`) + ownership markers
 * (`buildClaimMarkers`) + meeple capsules, wrapped in a group positioned at the
 * board coord and spun to the tile's rotation. During meeple placement the last
 * tile also mounts the shared RegionInteractionLayer over its valid targets.
 */
export function PlacedTile3D({ placed, registry, players, controller, targets }: Props) {
  const proto = useMemo(() => getPrototype(placed.prototypeId), [placed.prototypeId]);
  const seed = placed.prototypeId;
  const regions = useMemo(() => layoutRegions(proto, seed), [proto, seed]);

  const tileGroup = useMemo(() => {
    const group = generateTile(proto, regions, seed);
    disableTileContentRaycast(group);
    return group;
  }, [proto, regions, seed]);
  useEffect(() => () => disposeObject(tileGroup), [tileGroup]);

  const meeples = tileMeeples(placed, registry, players);
  const claimSig = meeplesSignature(meeples);
  const markers = useMemo(
    () => buildClaimMarkers(regions, toClaimMap(meeples)),
    // meeples is rederived every render; claimSig captures the only relevant change.
    [regions, claimSig], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => disposeObject(markers), [markers]);

  const [hoveredLocalId, setHoveredLocalId] = useState<number | null>(null);

  const hitRegions = useMemo(() => {
    if (!targets || targets.length === 0) return null;
    return filterRegions(regions, new Set(targets.map((t) => t.localId)));
  }, [regions, targets]);

  const rotationY = -(placed.rotation * Math.PI) / 180;

  return (
    <group position={[placed.coord.x, 0, placed.coord.y]} rotation={[0, rotationY, 0]}>
      <primitive object={tileGroup} />
      <primitive object={markers} />
      {meeples.map((m) => {
        const [cx, cz] = segmentCentroid(regions, m.localId, m.kind);
        return <MeepleCapsule key={m.localId} position={[cx, MEEPLE_Y, cz]} color={m.color} />;
      })}
      {hitRegions && (
        <RegionInteractionLayer
          tileGroup={tileGroup}
          regions={hitRegions}
          hoveredLocalId={hoveredLocalId}
          onHoverLocalId={setHoveredLocalId}
          onClickLocalId={(localId) => controller.placeMeeple({ tileId: placed.tileId, localId })}
        />
      )}
    </group>
  );
}
