import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

// 👤 Human Icon: Sleek outline silhouette of a profile or a medieval crest/shield
export function HumanIcon({ size = 16, color = 'var(--slate)', className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'block', ...style }}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" fill="rgba(77, 98, 117, 0.12)" />
      <circle cx="12" cy="7" r="4" fill="rgba(77, 98, 117, 0.08)" />
    </svg>
  );
}

// 🎲 Random AI Icon: Stylized 3D isometric die (cube)
export function DiceIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="var(--slate)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'block', ...style }}
    >
      {/* Isometric cube faces */}
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(77, 98, 117, 0.08)" />
      <path d="M2 17l10 5V12L2 7v10z" fill="rgba(77, 98, 117, 0.15)" />
      <path d="M22 17l-10 5V12l10-5v10z" fill="rgba(77, 98, 117, 0.22)" />
      
      {/* Die Dots */}
      {/* Top face center dot */}
      <circle cx="12" cy="7" r="1" fill="var(--terracotta)" stroke="none" />
      {/* Left face dots */}
      <circle cx="7" cy="13" r="0.8" fill="var(--slate)" stroke="none" />
      <circle cx="7" cy="17" r="0.8" fill="var(--slate)" stroke="none" />
      {/* Right face dots */}
      <circle cx="17" cy="12" r="0.8" fill="var(--slate)" stroke="none" />
      <circle cx="17" cy="15" r="0.8" fill="var(--slate)" stroke="none" />
      <circle cx="17" cy="18" r="0.8" fill="var(--slate)" stroke="none" />
    </svg>
  );
}

// 🧠 Heuristic AI Icon: Stylized brain
export function BrainIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="var(--slate)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'block', ...style }}
    >
      {/* Left hemisphere */}
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" fill="rgba(77, 98, 117, 0.08)" />
      {/* Right hemisphere */}
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" fill="rgba(77, 98, 117, 0.15)" />
      
      {/* Inner folds */}
      <path d="M12 5v13" strokeWidth="1.5" />
      <path d="M12 10h-2c-1 0-1.5 1-1 2s1.5.5 1 1.5" strokeWidth="1.2" />
      <path d="M12 10h2c1 0 1.5 1 1 2s-1.5.5-1 1.5" strokeWidth="1.2" />
      <path d="M12 14h-3a1 1 0 0 0-1 1v1" strokeWidth="1.2" />
      <path d="M12 14h3a1 1 0 0 1 1 1v1" strokeWidth="1.2" />
    </svg>
  );
}

// 🤖 Reasoning AI Icon: Stylized robot head/AI node
export function RobotIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="var(--slate)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'block', ...style }}
    >
      {/* Robot Head Body */}
      <rect x="4" y="6" width="16" height="12" rx="3" fill="rgba(77, 98, 117, 0.08)" />
      {/* Eyes */}
      <circle cx="9" cy="11" r="1.2" fill="var(--terracotta)" stroke="none" />
      <circle cx="15" cy="11" r="1.2" fill="var(--terracotta)" stroke="none" />
      {/* Mouth */}
      <path d="M9 15h6" strokeWidth="1.5" />
      {/* Antenna */}
      <path d="M12 6V3" strokeWidth="1.5" />
      <circle cx="12" cy="2" r="1" fill="var(--slate)" stroke="none" />
      {/* Side Bolts / Ears */}
      <path d="M4 12H2m18 0h2" strokeWidth="1.5" />
    </svg>
  );
}

// 🏆 Trophy Icon: Styled medieval/classic gold cup with gradients and soft glow
export function TrophyIcon({ size = 52, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe699" />
          <stop offset="35%" stopColor="#d8a93f" />
          <stop offset="75%" stopColor="#b78525" />
          <stop offset="100%" stopColor="#8a6212" />
        </linearGradient>
      </defs>
      <g>
        {/* Dark base stand */}
        <path d="M20 52h24v4a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2v-4z" fill="var(--ink)" />
        <path d="M25 44h14v8H25v-8z" fill="var(--ink-soft)" />
        
        {/* Stem */}
        <path d="M29 36h6v8h-6v-8z" fill="url(#goldGrad)" />
        
        {/* Cup Bowl */}
        <path d="M14 14h36v12c0 9.941-8.059 18-18 18S14 35.941 14 26V14z" fill="url(#goldGrad)" stroke="var(--ink)" strokeWidth="1" />
        <path d="M14 14h36v3H14v-3z" fill="#ffe699" opacity="0.4" />
        
        {/* Handles */}
        <path d="M14 18H8a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h6v-3h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6v-3z" fill="url(#goldGrad)" stroke="var(--ink)" strokeWidth="0.5" />
        <path d="M50 18h6a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6v-3h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-6v-3z" fill="url(#goldGrad)" stroke="var(--ink)" strokeWidth="0.5" />

        {/* Embossed Crown or Star on the trophy bowl */}
        <path d="M32 20l2 4.5 4.5.5-3.5 3 1.5 4.5-4.5-2.5-4.5 2.5 1.5-4.5-3.5-3 4.5-.5z" fill="#fff9ee" opacity="0.9" />
      </g>
    </svg>
  );
}

// 🥇 Medal Icon: Stylized rank awards (1st, 2nd, 3rd)
export function MedalIcon({ rank, size = 20, className, style }: { rank: number; size?: number; className?: string; style?: React.CSSProperties }) {
  const ribbonColorLeft = rank === 0 ? '#c4583a' : rank === 1 ? '#4d6275' : '#5f9444'; // Red-orange, Slate blue, Green
  const ribbonColorRight = rank === 0 ? '#a3472d' : rank === 1 ? '#3a4a58' : '#497233';
  
  // Custom metal gradients
  const gradients = [
    // Gold
    { stop1: '#fff9ee', stop2: '#d8a93f', stop3: '#b78525' },
    // Silver
    { stop1: '#f8fafc', stop2: '#cbd5e1', stop3: '#64748b' },
    // Bronze
    { stop1: '#ffedd5', stop2: '#d97706', stop3: '#78350f' },
  ];
  
  const grad = gradients[rank] ?? gradients[0];
  const gradId = `medalGrad-${rank}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={grad.stop1} />
          <stop offset="45%" stopColor={grad.stop2} />
          <stop offset="100%" stopColor={grad.stop3} />
        </linearGradient>
      </defs>
      
      {/* Ribbons hanging down */}
      <path d="M11 2 L14 14 L17 14 L14 2 Z" fill={ribbonColorLeft} />
      <path d="M21 2 L18 14 L15 14 L18 2 Z" fill={ribbonColorRight} />
      <path d="M14 2 L18 2 L16 14 Z" fill="#fff9ee" opacity="0.3" />
      
      {/* Outer border rim */}
      <circle cx="16" cy="19" r="10" fill="var(--ink)" />
      
      {/* Inner medal face */}
      <circle cx="16" cy="19" r="8.5" fill={`url(#${gradId})`} />
      
      {/* Embossed Ring */}
      <circle cx="16" cy="19" r="6" fill="none" stroke="rgba(58, 44, 30, 0.2)" strokeWidth="1" />
      
      {/* Rank number text */}
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fill="var(--ink)"
        fontSize="10"
        fontWeight="900"
        fontFamily="var(--font-ui)"
      >
        {rank + 1}
      </text>
    </svg>
  );
}
