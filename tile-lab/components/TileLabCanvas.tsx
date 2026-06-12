import type { ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';

/**
 * Shared lab scene scaffold — camera, lighting, grid, ground shadows and orbit
 * controls — so every 3D panel (reference, topology, claim-test) renders the
 * tile under identical conditions.
 */
export function TileLabCanvas({ children }: { children: ReactNode }) {
  return (
    <Canvas
      shadows
      camera={{ position: [1.3, 1.25, 1.3], fov: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
    >
      <color attach="background" args={['#b6c4d0']} />
      <fog attach="fog" args={['#b6c4d0', 4, 9]} />
      <hemisphereLight args={['#e4ecff', '#6a7a4a', 0.6]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[2.5, 4, 2]}
        color="#fff2da"
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
      />
      <Grid
        args={[6, 6]}
        cellSize={0.25}
        sectionSize={1}
        cellColor="#93a6b8"
        sectionColor="#7e93a8"
        infiniteGrid
        fadeDistance={7}
        fadeStrength={2}
      />
      {children}
      <ContactShadows
        position={[0, 0.001, 0]}
        scale={2.2}
        resolution={1024}
        blur={2.4}
        opacity={0.5}
        far={1.2}
      />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.8}
        maxDistance={4}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
