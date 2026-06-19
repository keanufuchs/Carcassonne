import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Coord } from '../../core/types';

/** Lifetime of the highlight pulse in seconds — matches the 2D CSS animation. */
const HIGHLIGHT_DURATION = 3;
/** Blue ring colour, matching the 2D `.tile-history-highlight` glow (#63b3ed). */
const HIGHLIGHT_COLOR = '#63b3ed';

interface Props {
  coord: Coord;
}

/**
 * A pulsing emissive ring laid flat on the highlighted tile. Mirrors the 2D
 * Placement-History highlight (issue #39): hold a bright glow, then fade out
 * over the last third of the 3s lifetime. Keyed by the caller on `highlightKey`
 * so re-selecting the same tile restarts the pulse from the top.
 */
export function HighlightMarker3D({ coord }: Props) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    elapsedRef.current += delta;
    const t = Math.min(elapsedRef.current / HIGHLIGHT_DURATION, 1);
    // Steady gentle pulse for the first 70%, then fade to nothing — same shape
    // as the 2D keyframes (opacity 1 held to 70%, easing to 0 at 100%).
    const pulse = 0.75 + 0.25 * Math.sin(elapsedRef.current * 6);
    const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    material.opacity = pulse * fade;
  });

  return (
    <mesh position={[coord.x, 0.06, coord.y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
      <ringGeometry args={[0.54, 0.72, 48]} />
      <meshBasicMaterial
        ref={materialRef}
        color={HIGHLIGHT_COLOR}
        transparent
        opacity={1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
