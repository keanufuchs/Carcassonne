import { Text } from '@react-three/drei';
import type { EdgeSide } from '../../src/core/types/tile';
import { TILE_SIZE } from '../../src/three/palette';

const HALF = TILE_SIZE / 2;
const LABEL_OFFSET = 0.07;
const LABEL_Y = 0.035;

/** Game-facing edge colours — consistent across all tile-lab previews. */
const SIDE_COLOR: Record<EdgeSide, string> = {
  N: '#ff6b6b',
  E: '#ffd166',
  S: '#4dabf7',
  W: '#69db7c',
};

interface MarkerSpec {
  side: EdgeSide;
  label: string;
  position: [number, number, number];
  /** Flat on the XZ plane, readable from the default lab camera. */
  rotation: [number, number, number];
}

const MARKERS: MarkerSpec[] = [
  {
    side: 'N',
    label: 'N',
    position: [0, LABEL_Y, -HALF - LABEL_OFFSET],
    rotation: [-Math.PI / 2, 0, Math.PI],
  },
  {
    side: 'E',
    label: 'E',
    position: [HALF + LABEL_OFFSET, LABEL_Y, 0],
    rotation: [-Math.PI / 2, 0, -Math.PI / 2],
  },
  {
    side: 'S',
    label: 'S',
    position: [0, LABEL_Y, HALF + LABEL_OFFSET],
    rotation: [-Math.PI / 2, 0, 0],
  },
  {
    side: 'W',
    label: 'W',
    position: [-HALF - LABEL_OFFSET, LABEL_Y, 0],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
  },
];

/**
 * N/E/S/W markers aligned to the tile's local axes (SVG/game convention:
 * N = −Z, E = +X, S = +Z, W = −X). Parent this under the same group as the
 * tile mesh so it rotates with the model.
 */
export function CompassMarkers() {
  return (
    <group name="compass-markers">
      {MARKERS.map(({ side, label, position, rotation }) => (
        <Text
          key={side}
          position={position}
          rotation={rotation}
          fontSize={0.11}
          color={SIDE_COLOR[side]}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#1a1f2e"
        >
          {label}
        </Text>
      ))}
    </group>
  );
}
