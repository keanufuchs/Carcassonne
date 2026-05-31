interface MeepleIconProps {
  color: string;
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

export function MeepleIcon({ color, size = 20, opacity = 1, style }: MeepleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ opacity, display: 'block', ...style }}
    >
      <path
        d="M 35 90 L 15 90 L 22 60 L 5 50 L 10 35 L 30 35 C 30 10, 70 10, 70 35 L 90 35 L 95 50 L 78 60 L 85 90 L 65 90 L 50 70 Z"
        fill={color}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
