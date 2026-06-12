import { useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Coord } from '../../core/types';
import type { Rotation, TilePrototype } from '../../core/types/tile';
import { layoutRegions } from '../../three/layoutRegions';
import { generateTile } from '../../three/generateTile';
import { disableTileContentRaycast } from '../../three/regionHighlight';
import { disposeObject, setGroupOpacity } from './board3d';

const IDLE_OPACITY = 0.35;
const HOVER_OPACITY = 0.6;

interface Props {
  proto: TilePrototype;
  rotation: Rotation;
  coord: Coord;
  onPlace: () => void;
}

/**
 * A translucent preview of the pending tile at one valid slot. Hovering lifts
 * the opacity; clicking commits the placement. A flat invisible box catches the
 * pointer so the procedural meshes (raycast disabled) don't swallow events.
 */
export function GhostTile3D({ proto, rotation, coord, onPlace }: Props) {
  const seed = proto.id;
  const regions = useMemo(() => layoutRegions(proto, seed), [proto, seed]);
  const ghost = useMemo(() => {
    const group = generateTile(proto, regions, seed);
    disableTileContentRaycast(group);
    setGroupOpacity(group, IDLE_OPACITY);
    return group;
  }, [proto, regions, seed]);
  useEffect(() => () => disposeObject(ghost), [ghost]);

  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    setGroupOpacity(ghost, hovered ? HOVER_OPACITY : IDLE_OPACITY);
  }, [ghost, hovered]);

  const rotationY = -(rotation * Math.PI) / 180;

  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); };
  const out = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(false); };
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPlace(); };

  return (
    <group position={[coord.x, 0, coord.y]} rotation={[0, rotationY, 0]}>
      <primitive object={ghost} />
      <mesh position={[0, 0.12, 0]} onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[1, 0.25, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
