import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

const TWO_PI = Math.PI * 2;

/** Signed shortest angular distance from `from` to `to`, in (-π, π]. */
function shortestDelta(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d <= -Math.PI) d += TWO_PI;
  return d;
}

/**
 * Drives a group's Y rotation smoothly toward `targetY` (radians) on every frame,
 * always taking the shortest path so a 270°→0° step spins the short way. Returns a
 * ref to attach to the animated `<group>`.
 *
 * `resetKey` snaps instantly (no spin) when it changes — pass the tile id so a
 * freshly drawn tile appears at its rotation instead of spinning in from the old
 * one. Under a `demand` frameloop it re-requests frames itself until settled.
 */
export function useSmoothRotationY(targetY: number, resetKey?: unknown) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(targetY);
  const targetRef = useRef(targetY);
  const invalidate = useThree((s) => s.invalidate);

  // Keep the animation target current without touching refs during render.
  useEffect(() => {
    targetRef.current = targetY;
    invalidate();
  }, [targetY, invalidate]);

  // A new tile (resetKey change) appears at its angle instead of spinning in.
  useEffect(() => {
    current.current = targetY;
    targetRef.current = targetY;
    if (ref.current) ref.current.rotation.y = targetY;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    const target = targetRef.current;
    const d = shortestDelta(current.current, target);
    if (Math.abs(d) < 0.001) {
      if (group.rotation.y !== target) {
        current.current = target;
        group.rotation.y = target;
      }
      return;
    }
    // Frame-rate independent exponential smoothing.
    const k = 1 - Math.exp(-12 * delta);
    current.current += d * k;
    group.rotation.y = current.current;
    invalidate();
  });

  return ref;
}
