import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import type { GameState } from '../../core/game/GameState';
import type { GameController } from '../../controller/GameController';
import type { Coord, FeatureId, SegmentRef } from '../../core/types';
import { coordKey, segmentKey } from '../../core/types';
import { PlacedTile3D, type BoardHover } from './PlacedTile3D';
import { GhostTile3D } from './GhostTile3D';
import { HighlightMarker3D } from './HighlightMarker3D';
import { featureHighlightColor } from './board3d';
import { playTilePlacementSound } from '../sound/tileSound';

interface Props {
  state: GameState;
  controller: GameController;
  canInteract?: boolean;
  /** Tile coord to highlight (e.g. clicked in the Placement History), or null. */
  highlightedCoord?: { x: number; y: number } | null;
  /** Bumped each time a highlight is (re-)triggered so the pulse restarts. */
  highlightKey?: number;
  /**
   * Meeple target selected from the mobile choice list (issue #34). When set,
   * its feature is highlighted on the board so the list selection has a visible
   * reference, just like hovering a region with a mouse does.
   */
  previewMeepleRef?: SegmentRef | null;
  /**
   * Decorative background mode (menu showcase): drops the expensive render
   * passes — soft shadows, retina DPR, antialias — since the board sits behind
   * a veil and is never interacted with. Cuts GPU cost dramatically on the
   * Home menu without a visible quality loss.
   */
  decorative?: boolean;
  /**
   * Touch drag-to-place (mobile): the live finger position in client
   * pixels while the player drags the pending tile out of the bottom bar, or
   * null when no drag is in progress. The board raycasts this point onto the
   * grid so the ghost follows the finger.
   */
  dragPointer?: { clientX: number; clientY: number } | null;
  /**
   * Reports the cell currently under the drag finger and whether the pending
   * tile can legally be placed there, so the parent can drop it on release.
   * Called with null when the finger is off the board.
   */
  onDragHoverChange?: (result: { coord: Coord; legal: boolean } | null) => void;
}

/**
 * Maps a client-pixel point onto the board grid by raycasting the camera ray
 * against the ground plane (y = 0). Mounted only while a touch drag is active;
 * on unmount it clears the hover so the ghost disappears. Lives inside <Canvas>
 * so it can read the live camera via useThree.
 */
function DragHoverRaycaster({
  pointer,
  onCoord,
}: {
  pointer: { clientX: number; clientY: number };
  onCoord: (coord: Coord | null) => void;
}) {
  const { camera, gl } = useThree();
  const tools = useRef({
    raycaster: new THREE.Raycaster(),
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit: new THREE.Vector3(),
  });

  useEffect(() => {
    const rect = gl.domElement.getBoundingClientRect();
    const inside =
      pointer.clientX >= rect.left && pointer.clientX <= rect.right &&
      pointer.clientY >= rect.top && pointer.clientY <= rect.bottom;
    if (!inside) {
      onCoord(null);
      return;
    }
    const ndc = new THREE.Vector2(
      ((pointer.clientX - rect.left) / rect.width) * 2 - 1,
      -((pointer.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const { raycaster, plane, hit } = tools.current;
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) {
      onCoord(null);
      return;
    }
    onCoord({ x: Math.round(hit.x), y: Math.round(hit.z) });
  }, [pointer, camera, gl, onCoord]);

  // Clear the hover when the drag ends (this component unmounts).
  useEffect(() => () => onCoord(null), [onCoord]);

  return null;
}

const POLAR_MIN_FREE = Math.PI / 6;   // ~30° — upper tilt limit
const POLAR_MAX_FREE = Math.PI / 2.2; // ~82° — lower tilt limit

// Derive initial azimuth + pitch from the starting camera position so R resets
// to exactly those angles regardless of the current zoom level.
const _initOffset = new THREE.Vector3(12, 14, 12); // INIT_POS - origin
const _initSph    = new THREE.Spherical().setFromVector3(_initOffset);
const INIT_THETA  = _initSph.theta; // azimuth  ≈ π/4
const INIT_PHI    = _initSph.phi;   // polar    ≈ 50°

/**
 * Keyboard shortcuts for camera angle presets (inside Canvas to access useThree).
 *   R       — reset azimuth + pitch to initial isometric angles, zoom unchanged
 *   1/2/3/4 — rotate to North / East / South / West, zoom + pitch unchanged
 */
function CameraHotkeys() {
  const { camera, controls } = useThree();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = controls as any;
      if (!ctrl?.update) return;

      // Reorient to a new azimuth (and optionally pitch), preserving distance.
      const applyAngle = (theta: number, phi?: number) => {
        const offset = new THREE.Vector3().subVectors(camera.position, ctrl.target);
        const sph = new THREE.Spherical().setFromVector3(offset);
        sph.theta = theta;
        if (phi !== undefined) sph.phi = phi;
        sph.makeSafe();
        offset.setFromSpherical(sph);
        camera.position.copy(ctrl.target).add(offset);
        ctrl.update();
      };

      switch (e.key) {
        case 'r': case 'R': applyAngle(INIT_THETA, INIT_PHI); break;
        case '1': applyAngle(Math.PI);        break; // North
        case '2': applyAngle(Math.PI / 2);    break; // East
        case '3': applyAngle(0);              break; // South
        case '4': applyAngle(-Math.PI / 2);   break; // West
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [camera, controls]);

  return null;
}

/** Lab-matched lighting + a directional light whose shadow frustum covers a board. */
function SceneLighting({ shadows = true }: { shadows?: boolean }) {
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
        castShadow={shadows}
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
export function Board3DView({ state, controller, canInteract = true, highlightedCoord, highlightKey, previewMeepleRef, decorative = false, dragPointer, onDragHoverChange }: Props) {
  // state.version is required: board.tiles is mutated in place (same Map ref),
  // so version is the only signal that the placed-tile set changed.
  const placedTiles = useMemo(
    () => [...state.board.tiles.values()],
    [state.board.tiles, state.version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Play the same wooden placement click as the 2D view whenever a new tile
  // lands on the board (matches the drop animation keyed on lastPlacedTileId).
  const previousPlacedTileIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentTileId = state.lastPlacedTileId;
    const previousTileId = previousPlacedTileIdRef.current;
    previousPlacedTileIdRef.current = currentTileId ?? null;
    if (!currentTileId || currentTileId === previousTileId) return;
    playTilePlacementSound();
  }, [state.lastPlacedTileId]);

  const placing = state.phase === 'PLACING_TILE' && !!state.pendingTile && canInteract;

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

  // While a touch drag is active, report the cell under the finger and whether
  // the pending tile fits there, so the parent can place/reject it on release.
  // previewPlacement already returns false for occupied cells.
  useEffect(() => {
    if (!onDragHoverChange) return;
    if (!dragPointer || !hoverCoord) {
      onDragHoverChange(null);
      return;
    }
    const legal = controller.previewPlacement(hoverCoord, state.pendingRotation).legal;
    onDragHoverChange({ coord: hoverCoord, legal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragPointer, hoverCoord, state.pendingRotation, state.version, controller, onDragHoverChange]);

  const isMeeplePhase = state.phase === 'PLACING_MEEPLE';
  const meepleTargets = isMeeplePhase && canInteract ? controller.getMeepleTargetsForLastTile() : [];

  const [hover, setHover] = useState<BoardHover | null>(null);
  // Nullify hover outside meeple phase so stale state never leaks into highlights.
  const effectiveHover = isMeeplePhase ? hover : null;
  const handleHoverFeature = useCallback(
    (featureId: FeatureId | null) => {
      if (featureId === null) return setHover(null);
      const feature = state.board.registry.features.get(featureId);
      if (!feature) return setHover(null);
      setHover({ featureId, color: featureHighlightColor(feature, state.players, isMeeplePhase) });
    },
    [state.board.registry, state.players, isMeeplePhase],
  );

  // Drive the board highlight from the mobile list selection: look up the
  // feature behind the chosen segment and light it the same way a hover would.
  useEffect(() => {
    if (!isMeeplePhase || !previewMeepleRef) return;
    const fid = state.board.registry.segmentToFeature.get(segmentKey(previewMeepleRef));
    handleHoverFeature(fid ?? null);
  }, [isMeeplePhase, previewMeepleRef, state.board.registry, handleHoverFeature]);

  const pendingProto = state.pendingTile;

  // Camera rotation via Shift + left-drag.
  // three-stdlib OrbitControls already inverts LEFT when a modifier key is held:
  //   LEFT=PAN + shift → rotate (if enableRotate)
  //   LEFT=PAN + no modifier → pan
  // So we only need to gate enableRotate on shiftHeld — no mouseButtons override needed.
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    if (!canInteract) return;

    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const onKeyUp   = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [canInteract]);

  // Track the last cell + the pointer-down position so we only re-render on a
  // cell change and don't place a tile at the end of a camera drag.
  const lastCellRef = useRef('');
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const onHoverPlane = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const x = Math.round(e.point.x);
    const y = Math.round(e.point.z);
    const key = `${x},${y}`;
    if (key === lastCellRef.current) return; // same cell — no re-render
    lastCellRef.current = key;
    setHoverCoord({ x, y });
  }, []);

  const onLeavePlane = useCallback(() => {
    lastCellRef.current = '';
    setHoverCoord(null);
  }, []);

  const onPlaneDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    downPosRef.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }, []);

  const onPlaneClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const down = downPosRef.current;
    const dragged = down && Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > 5;
    if (dragged || !ghost || ghost.illegal) return;
    controller.placeTile(ghost.coord);
  }, [ghost, controller]);

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', cursor: canInteract && shiftHeld ? 'crosshair' : undefined }}>
      <Canvas
        shadows={decorative ? false : 'percentage'}
        // Cap DPR: retina (2–3×) is invisible behind the menu veil and wasteful
        // in-game. [1, 2] is the R3F-recommended default; decorative pins to 1.
        dpr={decorative ? 1 : [1, 2]}
        camera={{ position: [12, 14, 12], fov: 40 }}
        gl={{ antialias: !decorative, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
      >
        <SceneLighting shadows={!decorative} />
        {canInteract && <CameraHotkeys />}
        {/* gridHelper(size, divisions, colorCenterLine, colorGrid) — uniform color, no axis highlight */}
        <gridHelper args={[300, 300, '#4a6070', '#4a6070']} position={[0.5, -0.02, 0.5]} />

        {placedTiles.map((tile) => (
          <PlacedTile3D
            key={tile.tileId}
            placed={tile}
            registry={state.board.registry}
            players={state.players}
            controller={controller}
            hover={effectiveHover}
            onHoverFeature={handleHoverFeature}
            targets={tile.tileId === state.lastPlacedTileId ? meepleTargets : undefined}
            interactive={canInteract && isMeeplePhase && tile.tileId === state.lastPlacedTileId}
            animateDrop={tile.tileId === state.lastPlacedTileId}
          />
        ))}

        {highlightedCoord && (
          <HighlightMarker3D key={highlightKey} coord={highlightedCoord} />
        )}

        {/* Invisible ground plane: maps the cursor to a grid cell and owns the
            placement click. Sole pointer target so the ghost never flickers. */}
        {placing && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={onHoverPlane}
            onPointerOut={onLeavePlane}
            onPointerDown={onPlaneDown}
            onClick={onPlaneClick}
          >
            <planeGeometry args={[400, 400]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Touch drag-to-place: raycast the finger position onto the grid so the
            ghost follows it. Mounted only during an active drag. */}
        {placing && dragPointer && (
          <DragHoverRaycaster pointer={dragPointer} onCoord={setHoverCoord} />
        )}

        {/* One persistent ghost; it repositions/recolours instead of remounting. */}
        {placing && pendingProto && (
          <GhostTile3D
            proto={pendingProto}
            rotation={state.pendingRotation}
            coord={ghost?.coord ?? null}
            illegal={ghost?.illegal ?? false}
          />
        )}

        <MapControls
          makeDefault
          enabled={canInteract}
          target={[0, 0, 0]}
          enablePan={canInteract}
          enableZoom={canInteract}
          enableRotate={canInteract && shiftHeld}
          minPolarAngle={POLAR_MIN_FREE}
          maxPolarAngle={POLAR_MAX_FREE}
          minAzimuthAngle={-Infinity}
          maxAzimuthAngle={Infinity}
          minDistance={2}
          maxDistance={30}
        />
      </Canvas>

    </div>
  );
}
