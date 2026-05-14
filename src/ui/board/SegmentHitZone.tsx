import type { SegmentRef } from '../../core/types';
import type { SegmentShape } from './useTileSvgPaths';

interface HitShapeProps {
  shape: SegmentShape;
  playerColor: string;
  onPlace: () => void;
  onMouseEnter?: () => void;
}

function SegmentHitShape({ shape, playerColor, onPlace, onMouseEnter }: HitShapeProps) {
  const { tagName, attrs } = shape;
  const sharedProps = {
    className: 'segment-hit',
    style: { '--player-color': playerColor } as React.CSSProperties,
    pointerEvents: 'all' as const,
    'data-testid': 'meeple-target',
    onClick: onPlace,
    onMouseEnter,
  };

  if (tagName === 'rect') {
    return <rect {...sharedProps} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height} />;
  }
  if (tagName === 'polygon') {
    return <polygon {...sharedProps} points={attrs.points} />;
  }
  if (tagName === 'path') {
    return <path {...sharedProps} d={attrs.d} />;
  }
  if (tagName === 'circle') {
    return <circle {...sharedProps} cx={attrs.cx} cy={attrs.cy} r={attrs.r} />;
  }
  if (tagName === 'line') {
    return (
      <line
        className="segment-hit-line segment-hit-pulse"
        style={{ '--player-color': playerColor } as React.CSSProperties}
        pointerEvents="all"
        data-testid="meeple-target"
        onClick={onPlace}
        x1={attrs.x1} y1={attrs.y1} x2={attrs.x2} y2={attrs.y2}
        strokeWidth={20}
      />
    );
  }
  return null;
}

interface Props {
  shapes: SegmentShape[];
  targets: SegmentRef[];
  rotation: number;
  tileSize: number;
  playerColor: string;
  onPlace: (ref: SegmentRef) => void;
  targetFeatureIds?: Map<number, string>;
  onHoverFeature?: (id: string | null) => void;
}

export function SegmentHitZone({ shapes, targets, rotation, tileSize, playerColor, onPlace, targetFeatureIds, onHoverFeature }: Props) {
  // Render FIELD shapes first (below) so CITY/ROAD shapes receive clicks in their areas.
  const sorted = [...targets].sort((a, b) => {
    const kindOf = (ref: SegmentRef) =>
      shapes.find(s => s.localId === ref.localId)?.kind === 'FIELD' ? 0 : 1;
    return kindOf(a) - kindOf(b);
  });

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        position: 'absolute',
        inset: 0,
        width: tileSize,
        height: tileSize,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center',
        overflow: 'visible',
        pointerEvents: 'auto',
        cursor: 'default',
      }}
      onMouseLeave={onHoverFeature ? () => onHoverFeature(null) : undefined}
    >
      {sorted.flatMap(ref => {
        const featureId = targetFeatureIds?.get(ref.localId);
        return shapes
          .filter(s => s.localId === ref.localId)
          .map((shape, i) => (
            <SegmentHitShape
              key={`${ref.localId}-${i}`}
              shape={shape}
              playerColor={playerColor}
              onPlace={() => onPlace(ref)}
              onMouseEnter={featureId && onHoverFeature ? () => onHoverFeature(featureId) : undefined}
            />
          ));
      })}
    </svg>
  );
}
