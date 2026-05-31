import type { SegmentShape } from './useTileSvgPaths';

interface Props {
  shapes: SegmentShape[];
  highlightLocalIds: number[];
  rotation: number;
  tileSize: number;
  playerColor: string;
}

export function FeatureHighlightZone({ shapes, highlightLocalIds, rotation, tileSize, playerColor }: Props) {
  if (highlightLocalIds.length === 0) return null;

  const highlighted = shapes
    .filter(s => highlightLocalIds.includes(s.localId))
    .sort((a, b) => (a.kind === 'FIELD' ? 0 : 1) - (b.kind === 'FIELD' ? 0 : 1));

  if (highlighted.length === 0) return null;

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
        pointerEvents: 'none',
      }}
    >
      {highlighted.map((shape, i) => {
        const { tagName, attrs } = shape;
        if (tagName === 'line') {
          return (
            <line
              key={i}
              x1={attrs.x1} y1={attrs.y1} x2={attrs.x2} y2={attrs.y2}
              stroke={playerColor}
              strokeWidth={20}
              opacity={0.4}
              pointerEvents="none"
            />
          );
        }
        const commonProps = { key: i, fill: playerColor, opacity: 0.4, pointerEvents: 'none' as const };
        if (tagName === 'rect') return <rect {...commonProps} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height} />;
        if (tagName === 'polygon') return <polygon {...commonProps} points={attrs.points} />;
        if (tagName === 'path') return <path {...commonProps} d={attrs.d} />;
        if (tagName === 'circle') return <circle {...commonProps} cx={attrs.cx} cy={attrs.cy} r={attrs.r} />;
        return null;
      })}
    </svg>
  );
}
