import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * A short-lived ground impact effect: a ring of soft dust puffs that are pushed
 * outward from the tile centre and fade out, played once when a tile lands. It
 * is purely cosmetic (raycast irrelevant — flat planes lying on the ground) and
 * disposes its shared geometry/material on unmount. The parent unmounts it via
 * `onComplete` so no dust lingers in the scene.
 */

/** Warm, dusty tan that reads against both the field and road palette. */
const DUST_COLOR = '#d8c7a0';
const PUFF_COUNT = 9;
/** Whole burst lifetime in seconds. */
const DURATION = 0.55;
/** Ground radius the ring expands across (tile footprint is 1×1). */
const START_RADIUS = 0.06;
const END_RADIUS = 0.66;

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/** Lazily-built soft radial alpha so a puff fades smoothly at its edges. */
let _puffTexture: THREE.Texture | null = null;
function puffTexture(): THREE.Texture {
  if (_puffTexture) return _puffTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  _puffTexture = texture;
  return texture;
}

interface Props {
  /** Called once when the burst has fully faded, so the parent can unmount it. */
  onComplete: () => void;
}

export function DustBurst({ onComplete }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const finished = useRef(false);

  const texture = useMemo(() => puffTexture(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        color: new THREE.Color(DUST_COLOR),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [texture],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.34, 0.34), []);

  // Deterministic-enough per-puff variation: an angle around the ring plus a
  // little jitter, individual size and a gentle in-plane spin.
  const puffs = useMemo(
    () =>
      Array.from({ length: PUFF_COUNT }, (_, i) => ({
        angle: (i / PUFF_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        size: 0.7 + Math.random() * 0.6,
        spin: (Math.random() - 0.5) * 2.4,
      })),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((_, delta) => {
    if (finished.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / DURATION, 1);

    const radius = START_RADIUS + (END_RADIUS - START_RADIUS) * easeOut(t);
    const group = groupRef.current;
    if (group) {
      for (let i = 0; i < group.children.length; i++) {
        const child = group.children[i];
        const p = puffs[i];
        child.position.set(Math.cos(p.angle) * radius, 0.012, Math.sin(p.angle) * radius);
        child.scale.setScalar(p.size * (0.45 + 0.85 * easeOut(t)));
        child.rotation.z = p.spin * t;
      }
    }
    // Snap to opacity quickly, then ease out — a soft puff, not a hard flash.
    material.opacity = Math.min(t * 5, 1) * (1 - t) * 0.7;

    if (t >= 1) {
      finished.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef}>
      {puffs.map((_, i) => (
        <mesh key={i} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}
