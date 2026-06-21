import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  setTileMeepleTargets,
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

/** Duration of the meeple banner's "plant" pop-in, in seconds. */
const MEEPLE_POP_DURATION = 0.45;

/** Ease-out-back: settles past 1 then back, giving the banner a lively snap. */
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
};

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

  // Banner "plant" pop-in: when a claim newly appears on this tile — i.e. a
  // meeple was just placed on one of its features — the new marker scales up
  // from the ground with a lively snap. The baseline is captured on the first
  // render so pre-existing claims (a restored game, a tile that already carries
  // banners) never animate; only genuine in-play additions do. Multi-tile
  // features add a banner to every member tile, so each pops in together.
  const prevClaimIdsRef = useRef<Set<number> | null>(null);
  const bannerAnimsRef = useRef<{ obj: THREE.Object3D; elapsed: number; baseScale: number }[]>([]);
  useLayoutEffect(() => {
    const currentIds = new Set(claims.keys());
    const prev = prevClaimIdsRef.current;
    prevClaimIdsRef.current = currentIds;
    if (prev === null) return; // first render: establish baseline only, no animation
    const anims: { obj: THREE.Object3D; elapsed: number; baseScale: number }[] = [];
    for (const [id, claim] of claims) {
      if (prev.has(id)) continue;
      // Roads keep their already-standing lantern; only the new pennant rises.
      const obj = claim.kind === 'ROAD'
        ? markers.getObjectByName(`road-lantern-${id}`)?.getObjectByName('road-pennant')
        : markers.getObjectByName(`claim-marker-${claim.kind}-${id}`);
      if (!obj) continue;
      // Capture the marker's intended scale (e.g. 0.4 for tombstones) before hiding it,
      // so the animation restores the correct final size instead of always landing at 1.
      const baseScale = obj.scale.x;
      obj.scale.setScalar(0.0001); // hide until the first animated frame to avoid a one-frame pop
      anims.push({ obj, elapsed: 0, baseScale });
    }
    bannerAnimsRef.current = anims;
    // claims is rederived every render; markers identity tracks the only relevant change.
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const anims = bannerAnimsRef.current;
    if (anims.length === 0) return;
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.elapsed += delta;
      const t = Math.min(a.elapsed / MEEPLE_POP_DURATION, 1);
      a.obj.scale.setScalar(easeOutBack(t) * a.baseScale);
      if (t >= 1) {
        a.obj.scale.setScalar(a.baseScale);
        anims.splice(i, 1);
      }
    }
  });

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
  // colour changes. On the tile being claimed (it has meeple `targets`), every
  // placeable segment keeps a subtle persistent glow and the hovered feature is
  // emphasised; all other tiles just light up the hovered feature.
  useEffect(() => {
    const hoverColor = hover?.color ?? SEGMENT_HIGHLIGHT.glowColor;
    if (clickableLocalIds) {
      setTileMeepleTargets(tileGroup, highlightShells, clickableLocalIds, activeLocalIds, hoverColor);
    } else {
      setTileRegionHighlight(tileGroup, highlightShells, activeLocalIds, hoverColor);
    }
  }, [tileGroup, highlightShells, clickableLocalIds, activeLocalIds, hover?.color]);

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
