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

// 🏰 City Icon: Fortress / castle walls and towers with a slate/terracotta gradient
export function CityIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <linearGradient id="carcCityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5eedc" />
          <stop offset="50%" stopColor="#d9c191" />
          <stop offset="100%" stopColor="#b15a3c" />
        </linearGradient>
      </defs>
      <path
        d="M 2 21 L 2 8 L 3 8 L 3 10 L 5 10 L 5 8 L 6 8 L 6 13 L 10 13 L 10 5 L 11 5 L 11 7 L 13 7 L 13 5 L 14 5 L 14 13 L 18 13 L 18 8 L 19 8 L 19 10 L 21 10 L 21 8 L 22 8 L 22 21 Z"
        fill="url(#carcCityGrad)"
        stroke="var(--slate)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Arch Gate */}
      <path
        d="M 9 21 v -3 a 3 3 0 0 1 6 0 v 3"
        fill="rgba(40, 30, 18, 0.2)"
        stroke="var(--slate)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Small slit windows */}
      <rect x="3.5" y="12" width="1" height="3" rx="0.5" fill="var(--slate)" stroke="none" />
      <rect x="19.5" y="12" width="1" height="3" rx="0.5" fill="var(--slate)" stroke="none" />
      <rect x="11.5" y="9" width="1" height="3" rx="0.5" fill="var(--slate)" stroke="none" />
    </svg>
  );
}

// 🛣️ Road Icon: Winding cobblestone path with perspective
export function RoadIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <linearGradient id="carcRoadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdfbf7" />
          <stop offset="50%" stopColor="#efe7d3" />
          <stop offset="100%" stopColor="#cfc6b0" />
        </linearGradient>
      </defs>
      {/* Road border / background shape */}
      <path
        d="M 2 22 Q 10 14 6 7 T 18 2"
        fill="none"
        stroke="var(--slate)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Road itself with warm sand gradient */}
      <path
        d="M 2 22 Q 10 14 6 7 T 18 2"
        fill="none"
        stroke="url(#carcRoadGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Winding dashed center line */}
      <path
        d="M 2 22 Q 10 14 6 7 T 18 2"
        fill="none"
        stroke="var(--slate)"
        strokeWidth="1"
        strokeDasharray="2,3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ⛪ Monastery Icon: Medieval church / cathedral with a steep roof and cross
export function MonasteryIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <linearGradient id="carcMonasteryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f9f8f5" />
          <stop offset="60%" stopColor="#e9e3d6" />
          <stop offset="100%" stopColor="#9c4a32" />
        </linearGradient>
      </defs>
      {/* Cross on top of the roof */}
      <path d="M 12 2 v 4 M 10 4 h 4" stroke="var(--slate)" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Main building body and roof */}
      <path
        d="M 5 21 L 5 13 L 12 7 L 19 13 L 19 21 Z"
        fill="url(#carcMonasteryGrad)"
        stroke="var(--slate)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      
      {/* Arched entryway */}
      <path
        d="M 10 21 v -3 a 2 2 0 0 1 4 0 v 3"
        fill="rgba(40, 30, 18, 0.2)"
        stroke="var(--slate)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Rose window / Circular window above gate */}
      <circle
        cx="12"
        cy="12.5"
        r="2"
        fill="rgba(196, 88, 58, 0.15)"
        stroke="var(--slate)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

// 🌾 Field Icon: Stalk of wheat / crop with a golden-meadow gradient
export function FieldIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <linearGradient id="carcFieldGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#5f9e4a" />
          <stop offset="50%" stopColor="#8cc06b" />
          <stop offset="100%" stopColor="#d8b85a" />
        </linearGradient>
      </defs>
      
      {/* Wheat Stem */}
      <path d="M 12 22 V 4" stroke="var(--slate)" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Wheat Kernels / Leaves alternating up the stem */}
      {/* Left 1 */}
      <path d="M 12 18 C 9 17, 8 15, 9 13 C 10 13, 11 14, 12 16 Z" fill="url(#carcFieldGrad)" stroke="var(--slate)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Right 1 */}
      <path d="M 12 16 C 15 15, 16 13, 15 11 C 14 11, 13 12, 12 14 Z" fill="url(#carcFieldGrad)" stroke="var(--slate)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Left 2 */}
      <path d="M 12 13 C 9 12, 8 10, 9 8 C 10 8, 11 9, 12 11 Z" fill="url(#carcFieldGrad)" stroke="var(--slate)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Right 2 */}
      <path d="M 12 11 C 15 10, 16 8, 15 6 C 14 6, 13 7, 12 9 Z" fill="url(#carcFieldGrad)" stroke="var(--slate)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Left 3 */}
      <path d="M 12 8 C 9 7, 8 5, 9 3 C 10 3, 11 4, 12 6 Z" fill="url(#carcFieldGrad)" stroke="var(--slate)" strokeWidth="1.2" strokeLinejoin="round" />
      
      {/* Top tip kernel */}
      <path d="M 12 4 C 11 2, 12 1, 12 1 C 12 1, 13 2, 12 4 Z" fill="url(#carcFieldGrad)" stroke="var(--slate)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
