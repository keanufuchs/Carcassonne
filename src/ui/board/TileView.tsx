import type { PlacedTile, SegmentInstance } from '../../core/tile/Tile';
import type { FeatureRegistry } from '../../core/feature/segments';
import type { Player } from '../../core/types';
import type { SegmentRef } from '../../core/types';
import { segmentPosition } from './segmentPosition';
import { useTileSvgPaths, useInlineTileSvg } from './useTileSvgPaths';
import { SegmentHitZone } from './SegmentHitZone';
import { InlineTile } from './InlineTile';
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
  targets?: SegmentRef[];
  currentPlayerColor?: string;
  onPlace?: (ref: SegmentRef) => void;
  featureHighlightIds?: number[];
  targetFeatureIds?: Map<number, string>;
  onHoverFeature?: (id: string | null) => void;
}

export function TileView({ placed, registry, players, size = 80, targets = [], currentPlayerColor, onPlace, featureHighlightIds = [], targetFeatureIds, onHoverFeature }: Props) {
  const imgSrc = tileImageMap[placed.prototypeId] ?? '';
  const shapes = useTileSvgPaths(imgSrc);
  const markup = useInlineTileSvg(imgSrc);

  // Unrotated centroid per segment, used as the fallback meeple hit area.
  // Rotation is applied by the SegmentHitZone <svg> container, so centers must
  // stay unrotated (rotation = 0) here to avoid being rotated twice.
  const segmentCenters = new Map<number, { x: number; y: number }>();
  for (const seg of placed.segmentInstances) {
    segmentCenters.set(seg.ref.localId, segmentPosition(seg.kind, seg.edgeSlots, 0));
  }

  const targetLocalIds = targets.map(t => t.localId);

  const meeples = placed.segmentInstances.flatMap((seg: SegmentInstance) => {
    const key = `${seg.ref.tileId}#${seg.ref.localId}`;
    const fid = registry.segmentToFeature.get(key);
    const feature = fid ? registry.features.get(fid) : undefined;
    return (feature?.meeples ?? [])
      .filter(m => m.segmentRef.tileId === placed.tileId && m.segmentRef.localId === seg.ref.localId)
      .map(m => ({ playerId: m.playerId, seg }));
  });

  return (
    <div className="placed-tile-shell" style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {markup ? (
        <InlineTile
          markup={markup}
          rotation={placed.rotation}
          size={size}
          targetLocalIds={targetLocalIds}
          highlightLocalIds={featureHighlightIds}
          altText={placed.prototypeId}
        />
      ) : (
        <img
          src={imgSrc}
          alt={placed.prototypeId}
          draggable={false}
          style={{ width: '100%', height: '100%', transform: `rotate(${placed.rotation}deg)`, display: 'block' }}
        />
      )}
      {meeples.map((m, i) => {
        const player = players.find(p => p.id === m.playerId);
        const pos = segmentPosition(m.seg.kind, m.seg.edgeSlots, placed.rotation);
        return (
          <div
            key={i}
            className="meeple-piece"
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
      {targets.length > 0 && shapes && onPlace && currentPlayerColor && (
        <SegmentHitZone
          shapes={shapes}
          targets={targets}
          rotation={placed.rotation}
          tileSize={size}
          playerColor={currentPlayerColor}
          onPlace={onPlace}
          centers={segmentCenters}
          targetFeatureIds={targetFeatureIds}
          onHoverFeature={onHoverFeature}
        />
      )}
    </div>
  );
}
