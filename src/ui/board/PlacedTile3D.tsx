import { useEffect, useMemo, useRef, useState } from 'react';
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
import { DustBurst } from './DustBurst';
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
  /** Play the drop-in + dust impact once when this tile first mounts (the freshly placed tile). */
  animateDrop?: boolean;
}

const EMPTY: ReadonlySet<number> = new Set();
const _markerWorld = new THREE.Vector3();

/** Height above the board the tile starts at before falling into place. */
const DROP_HEIGHT = 3.2;
/** Fall time in seconds; the squash that follows is a short settle. */
const DROP_DURATION = 0.4;
const SETTLE_DURATION = 0.18;

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

type DropPhase = 'fall' | 'settle' | 'done';

/**
 * One placed tile: procedural geometry + per-feature ownership markers, with a
 * full hover/click interaction layer. Hovering reports the feature upward so the
 * board can light the whole feature across tiles; player markers billboard to the
 * camera each frame. The last tile additionally accepts meeple-target clicks.
 */
export function PlacedTile3D({ placed, registry, players, controller, hover, onHoverFeature, targets, interactive = false, animateDrop = false }: Props) {
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

  // Objects tagged `billboard` always face the camera: player claim markers plus
  // the shielded-city banner baked into the tile. Collected once per group so the
  // per-frame loop iterates a short list instead of traversing every tile mesh.
  const billboardTargets = useMemo(() => {
    const out: THREE.Object3D[] = [];
    const collect = (root: THREE.Object3D) => root.traverse((o) => { if (o.userData.billboard) out.push(o); });
    collect(tileGroup);
    collect(markers);
    return out;
  }, [tileGroup, markers]);

  useFrame(({ camera }) => {
    for (const obj of billboardTargets) {
      obj.getWorldPosition(_markerWorld);
      const angle = Math.atan2(camera.position.x - _markerWorld.x, camera.position.z - _markerWorld.z);
      obj.rotation.y = angle - rotationY;
    }
  });

  // Drop-in + landing squash, played once on the freshly placed tile. We capture
  // `animateDrop` at mount: each placed tile is keyed by tileId and mounts once,
  // so the newly placed tile falls while the rest of the board sits still.
  const shouldDrop = useRef(animateDrop).current;
  const dropGroupRef = useRef<THREE.Group>(null);
  const dropState = useRef<{ phase: DropPhase; elapsed: number }>({
    phase: shouldDrop ? 'fall' : 'done',
    elapsed: 0,
  });
  const [showDust, setShowDust] = useState(false);

  useFrame((_, delta) => {
    const st = dropState.current;
    const group = dropGroupRef.current;
    if (st.phase === 'done' || !group) return;
    st.elapsed += delta;

    if (st.phase === 'fall') {
      const t = Math.min(st.elapsed / DROP_DURATION, 1);
      // Accelerating, gravity-like fall: most of the drop happens late for a snappy impact.
      group.position.y = DROP_HEIGHT * (1 - t * t);
      if (t >= 1) {
        group.position.y = 0;
        st.phase = 'settle';
        st.elapsed = 0;
        setShowDust(true);
      }
    } else {
      const e = easeOut(Math.min(st.elapsed / SETTLE_DURATION, 1));
      // Brief squash-and-recover at the moment of impact.
      group.scale.set(1.09 - 0.09 * e, 0.86 + 0.14 * e, 1.09 - 0.09 * e);
      if (e >= 1) {
        group.scale.set(1, 1, 1);
        st.phase = 'done';
      }
    }
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
      <group ref={dropGroupRef} position={[0, shouldDrop ? DROP_HEIGHT : 0, 0]}>
        <primitive object={tileGroup} />
        <primitive object={markers} />
        {highlightShells.map((shell) => (
          <primitive key={shell.mesh.uuid} object={shell.mesh} />
        ))}
      </group>
      {showDust && <DustBurst onComplete={() => setShowDust(false)} />}
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
