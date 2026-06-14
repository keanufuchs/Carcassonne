import type { SegmentRef } from '../../core/types';
import type { SegmentShape } from './useTileSvgPaths';
import { buildHitGroups } from './hitGroups';

/** Renders the raw SVG geometry of one shape as a transparent, clickable area. */
function HitShape({ shape }: { shape: SegmentShape }) {
  const { tagName, attrs } = shape;
  const common = { className: 'segment-hit', 'data-testid': 'meeple-target' as const };

  if (tagName === 'rect') {
    return <rect {...common} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height} />;
  }
  if (tagName === 'polygon') {
    return <polygon {...common} points={attrs.points} />;
  }
  if (tagName === 'path') {
    return <path {...common} d={attrs.d} />;
  }
  if (tagName === 'circle') {
    return <circle {...common} cx={attrs.cx} cy={attrs.cy} r={attrs.r} />;
  }
  if (tagName === 'line') {
    return (
      <line
        className="segment-hit-line"
        data-testid="meeple-target"
        x1={attrs.x1} y1={attrs.y1} x2={attrs.x2} y2={attrs.y2}
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
  /** unrotated tile-percentage centroid per segment localId (fallback hit area) */
  centers?: Map<number, { x: number; y: number }>;
  targetFeatureIds?: Map<number, string>;
  onHoverFeature?: (id: string | null) => void;
}

export function SegmentHitZone({
  shapes, targets, rotation, tileSize, playerColor,
  onPlace, centers, targetFeatureIds, onHoverFeature,
}: Props) {
  const groups = buildHitGroups(shapes, targets, centers ?? new Map());

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
      {groups.map(({ ref, shapes: groupShapes, center }) => {
        const featureId = targetFeatureIds?.get(ref.localId);
        // One <g> per feature: hovering any part lights the whole feature
        // (see .segment-hit-group:hover in board.css), and clicks anywhere
        // in the group place the meeple on the same segment.
        return (
          <g
            key={ref.localId}
            className="segment-hit-group"
            style={{ '--player-color': playerColor } as React.CSSProperties}
            onClick={() => onPlace(ref)}
            onMouseEnter={featureId && onHoverFeature ? () => onHoverFeature(featureId) : undefined}
          >
            {groupShapes.map((shape, i) => (
              <HitShape key={`${ref.localId}-${i}`} shape={shape} />
            ))}
            {/* Always-present fallback hit area at the segment centroid so the
                feature stays selectable even if its SVG shape is missing or
                fully covered. Visible only when the feature has no shape. */}
            <circle
              className={groupShapes.length === 0 ? 'segment-hit-fallback segment-hit-fallback--bare' : 'segment-hit-fallback'}
              data-testid="meeple-target"
              cx={center.x}
              cy={center.y}
              r={5}
            />
          </g>
        );
      })}
    </svg>
  );
}
