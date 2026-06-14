import { useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import type { GameState } from '../../core/game/GameState';
import type { GameController } from '../../controller/GameController';
import type { Coord, FeatureId } from '../../core/types';
import { coordKey } from '../../core/types';
import { PlacedTile3D, type BoardHover } from './PlacedTile3D';
import { GhostTile3D } from './GhostTile3D';
import { featureHighlightColor } from './board3d';

interface Props {
  state: GameState;
  controller: GameController;
  isAiTurn?: boolean;
}

const POLAR = Math.PI / 3; // ~60° — locked, no orbit
const AZIMUTH = -Math.PI / 4; // fixed isometric diagonal

/** Lab-matched lighting + a directional light whose shadow frustum covers a board. */
function SceneLighting() {
  return (
    <>
      <color attach="background" args={['#b6c4d0']} />
      <fog attach="fog" args={['#b6c4d0', 22, 60]} />
      <hemisphereLight args={['#e4ecff', '#6a7a4a', 0.6]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[14, 22, 12]}
        color="#fff2da"
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={0.5}
        shadow-camera-far={70}
      />
    </>
  );
}

/**
 * Full 3D board. A single locked-isometric R3F scene renders every placed tile
 * (geometry + ownership markers + meeples) and a translucent ghost at each valid
 * slot for the pending tile. Replaces the 2D SVG/CSS BoardView.
 */
export function Board3DView({ state, controller, isAiTurn = false }: Props) {
  // state.version is required: board.tiles is mutated in place (same Map ref),
  // so version is the only signal that the placed-tile set changed.
  const placedTiles = useMemo(
    () => [...state.board.tiles.values()],
    [state.board.tiles, state.version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const placing = state.phase === 'PLACING_TILE' && !!state.pendingTile && !isAiTurn;

  // The grid cell under the cursor, snapped from the hover plane (or null).
  const [hoverCoord, setHoverCoord] = useState<Coord | null>(null);

  // A single ghost follows the cursor over any empty cell (not over an existing
  // tile); it renders red wherever the current rotation can't legally be placed
  // there — which includes every non-neighbour cell.
  const ghost = useMemo(() => {
    if (!placing || !hoverCoord || state.board.tiles.has(coordKey(hoverCoord))) return null;
    const illegal = !controller.previewPlacement(hoverCoord, state.pendingRotation).legal;
    return { coord: hoverCoord, illegal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing, hoverCoord, state.board, state.pendingRotation, state.version]);

  const isMeeplePhase = state.phase === 'PLACING_MEEPLE';
  const meepleTargets = isMeeplePhase && !isAiTurn ? controller.getMeepleTargetsForLastTile() : [];

  const [hover, setHover] = useState<BoardHover | null>(null);
  const handleHoverFeature = useCallback(
    (featureId: FeatureId | null) => {
      if (featureId === null) return setHover(null);
      const feature = state.board.registry.features.get(featureId);
      if (!feature) return setHover(null);
      setHover({ featureId, color: featureHighlightColor(feature, state.players, isMeeplePhase) });
    },
    [state.board.registry, state.players, isMeeplePhase],
  );

  const pendingProto = state.pendingTile;

  const onHoverPlane = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoverCoord({ x: Math.round(e.point.x), y: Math.round(e.point.z) });
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [12, 14, 12], fov: 40 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
      >
        <SceneLighting />
        {/* gridHelper(size, divisions, colorCenterLine, colorGrid) — uniform color, no axis highlight */}
        <gridHelper args={[300, 300, '#4a6070', '#4a6070']} position={[0.5, -0.02, 0.5]} />

        {placedTiles.map((tile) => (
          <PlacedTile3D
            key={tile.tileId}
            placed={tile}
            registry={state.board.registry}
            players={state.players}
            controller={controller}
            hover={hover}
            onHoverFeature={handleHoverFeature}
            targets={tile.tileId === state.lastPlacedTileId ? meepleTargets : undefined}
          />
        ))}

        {/* Invisible ground plane that maps the cursor to a grid cell. */}
        {placing && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={onHoverPlane}
            onPointerOut={() => setHoverCoord(null)}
          >
            <planeGeometry args={[400, 400]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )}

        {pendingProto && ghost && (
          <GhostTile3D
            key={`${ghost.coord.x},${ghost.coord.y}`}
            proto={pendingProto}
            rotation={state.pendingRotation}
            coord={ghost.coord}
            illegal={ghost.illegal}
            onPlace={() => controller.placeTile(ghost.coord)}
          />
        )}

        <MapControls
          makeDefault
          target={[0, 0, 0]}
          enableRotate={false}
          minPolarAngle={POLAR}
          maxPolarAngle={POLAR}
          minAzimuthAngle={AZIMUTH}
          maxAzimuthAngle={AZIMUTH}
          minDistance={2}
          maxDistance={30}
        />
      </Canvas>
    </div>
  );
}
