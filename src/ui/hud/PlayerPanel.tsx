import type { Player } from '../../core/types';

interface Props {
  players: Player[];
  currentPlayerIndex: number;
}

export function PlayerPanel({ players, currentPlayerIndex }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Players</div>
      {players.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6,
            background: i === currentPlayerIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: `2px solid ${i === currentPlayerIndex ? p.color : 'transparent'}`,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: '#eee', fontSize: 13, fontWeight: i === currentPlayerIndex ? 700 : 400 }}>
            {p.name}
          </span>
          <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 14 }}>{p.score}</span>
          <span style={{ color: '#777', fontSize: 11 }} title="Meeples available">×{p.meeplesAvailable}</span>
        </div>
      ))}
    </div>
  );
}
