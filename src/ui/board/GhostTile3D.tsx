import { useEffect, useMemo } from 'react';
import type { Coord } from '../../core/types';
import type { Rotation, TilePrototype } from '../../core/types/tile';
import { layoutRegions } from '../../three/layoutRegions';
import { generateTile } from '../../three/generateTile';
import { disableTileContentRaycast } from '../../three/regionHighlight';
import { disposeObject, setGroupOpacity, setGroupTint } from './board3d';

const IDLE_OPACITY = 0.45;
const ILLEGAL_COLOR = '#d23b3b';

interface Props {
  proto: TilePrototype;
  rotation: Rotation;
  /** Grid cell under the cursor, or null when the cursor is off the board / over a tile. */
  coord: Coord | null;
  /** Current rotation can't be legally placed here — render red. */
  illegal: boolean;
}

/**
 * A single translucent preview of the pending tile that follows the cursor. It
 * is purely visual (raycast disabled) — the board's hover plane owns pointer
 * move/click — and stays mounted across cell changes: only its position, colour
 * and visibility update, so it never flashes or lags behind a remount. It is
 * hidden (not unmounted) when `coord` is null.
 */
export function GhostTile3D({ proto, rotation, coord, illegal }: Props) {
  const seed = proto.id;
  const regions = useMemo(() => layoutRegions(proto, seed), [proto, seed]);
  const ghost = useMemo(() => {
    const group = generateTile(proto, regions, seed);
    disableTileContentRaycast(group);
    setGroupOpacity(group, IDLE_OPACITY);
    return group;
  }, [proto, regions, seed]);
  useEffect(() => () => disposeObject(ghost), [ghost]);

  // Reversible tint — flips red/normal without rebuilding the geometry.
  useEffect(() => {
    setGroupTint(ghost, illegal ? ILLEGAL_COLOR : null);
  }, [ghost, illegal]);

  const rotationY = -(rotation * Math.PI) / 180;

  return (
    <group
      visible={coord !== null}
      position={[coord?.x ?? 0, 0, coord?.y ?? 0]}
      rotation={[0, rotationY, 0]}
    >
      <primitive object={ghost} />
    </group>
  );
}
