interface Props {
  size: number;
  legal: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  imageSrc?: string;
  rotation: number;
}

export function GhostTile({ size, legal, onClick, onHover, onLeave, imageSrc, rotation }: Props) {
  return (
    <div
      data-testid="ghost-tile"
      data-legal={legal ? 'true' : 'false'}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        width: size, height: size,
        position: 'relative',
        cursor: legal ? 'pointer' : 'not-allowed',
        border: `2px dashed ${legal ? '#4ade80' : '#f87171'}`,
        boxSizing: 'border-box',
        opacity: 0.65,
        background: legal ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.06)',
      }}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt="preview"
          style={{
            width: '100%', height: '100%',
            transform: `rotate(${rotation}deg)`,
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
