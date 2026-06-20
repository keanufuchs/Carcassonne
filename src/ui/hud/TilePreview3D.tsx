import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import type { TilePrototype } from '../../core/types/tile';
import type { Rotation } from '../../core/types';
import { layoutRegions } from '../../three/layoutRegions';
import { generateTile } from '../../three/generateTile';
import { disposeObject } from '../board/board3d';
import { useSmoothRotationY } from '../board/useSmoothRotationY';

/**
 * The same procedurally generated tile geometry the board renders, shown in the
 * HUD draw pile. Viewed from a fixed 45° tilt so the relief reads clearly, and
 * spun in-plane to mirror the pending rotation (matching `PlacedTile3D`).
 */
function TileMesh({ proto, rotation, cameraSpin }: { proto: TilePrototype; rotation: Rotation; cameraSpin: number }) {
  const seed = proto.id;
  const group = useMemo(() => generateTile(proto, layoutRegions(proto, seed), seed), [proto, seed]);
  useEffect(() => () => disposeObject(group), [group]);
  // Mirror the board: clockwise rotation steps map to negative Y rotation.
  // Subtracting the camera spin reproduces how a world-fixed board tile appears
  // to rotate as the camera orbits, so the preview matches the live view (#45).
  const rotationY = -(rotation * Math.PI) / 180 - cameraSpin;
  const rotRef = useSmoothRotationY(rotationY, proto.id);
  return (
    <group ref={rotRef}>
      <primitive object={group} />
    </group>
  );
}

/** Soft lighting tuned for a single tile on a transparent background. */
function PreviewLighting() {
  return (
    <>
      <hemisphereLight args={['#e4ecff', '#6a7a4a', 0.7]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 4, 3]} color="#fff2da" intensity={1.5} />
    </>
  );
}

interface Props {
  proto: TilePrototype;
  rotation: Rotation;
  /** Camera azimuth offset (radians) so the preview mirrors the board view (#45). */
  cameraSpin?: number;
}

export function TilePreview3D({ proto, rotation, cameraSpin = 0 }: Props) {
  return (
    <Canvas
      // Low (~30°) 3/4 view so the tile is seen from the side and its relief stands out.
      camera={{ position: [0.95, 1.3, 2.05], fov: 35 }}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
      frameloop="demand"
      style={{ width: '100%', height: '100%' }}
    >
      <PreviewLighting />
      <TileMesh proto={proto} rotation={rotation} cameraSpin={cameraSpin} />
    </Canvas>
  );
}
