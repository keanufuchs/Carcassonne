import type { PlacedTile, SegmentInstance } from '../../core/tile/Tile';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player } from '../../core/types';
import { segmentPosition } from './segmentPosition';
import tileDistribution from '../../core/deck/tileDistribution.json';
import { MeepleIcon } from './MeepleIcon';

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

interface Props {
  placed: PlacedTile;
  registry: FeatureRegistry;
  players: Player[];
  size?: number;
}

export function TileView({ placed, registry, players, size = 80 }: Props) {
  const imgSrc = tileImageMap[placed.prototypeId] ?? '';

  const meeples = placed.segmentInstances.flatMap((seg: SegmentInstance) => {
    const key = `${seg.ref.tileId}#${seg.ref.localId}`;
    const fid = registry.segmentToFeature.get(key);
    const feature = fid ? registry.features.get(fid) : undefined;
    return (feature?.meeples ?? [])
      .filter(m => m.segmentRef.tileId === placed.tileId && m.segmentRef.localId === seg.ref.localId)
      .map(m => ({ playerId: m.playerId, seg }));
  });

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <img
        src={imgSrc}
        alt={placed.prototypeId}
        style={{ width: '100%', height: '100%', transform: `rotate(${placed.rotation}deg)`, display: 'block' }}
      />
      {meeples.map((m, i) => {
        const player = players.find(p => p.id === m.playerId);
        const pos = segmentPosition(m.seg.kind, m.seg.edgeSlots, placed.rotation);
        return (
          <div
            key={i}
            title={`${player?.name ?? 'Meeple'} on ${m.seg.kind}`}
            style={{
              position: 'absolute',
              top: `${pos.y}%`, left: `${pos.x}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              cursor: 'default',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            }}
          >
            <MeepleIcon color={player?.color ?? '#888'} size={18} />
          </div>
        );
      })}
    </div>
  );
}
