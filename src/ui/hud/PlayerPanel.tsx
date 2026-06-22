import type { Player } from '../../core/types';
import { MeepleIcon } from '../board/MeepleIcon';

interface Props {
  players: Player[];
  currentPlayerIndex: number;
}

export function PlayerPanel({ players, currentPlayerIndex }: Props) {
  return (
    <div className="hud-pad player-panel">
      <div className="hud-label">Players</div>
      {players.map((p, i) => {
        const active = i === currentPlayerIndex;
        return (
          <div
            key={p.id}
            className={`player-chip${active ? ' active' : ''}`}
            data-testid="player-chip"
            data-player-id={p.id}
            data-score={p.score}
            data-meeples={p.meeplesAvailable}
            style={active ? { borderColor: p.color, background: `color-mix(in srgb, ${p.color} 12%, var(--cream))` } : undefined}
          >
            <span className="pmeeple-token" title={`${p.meeplesAvailable} meeples available`}>
              <MeepleIcon color={p.color} size={18} />
              <span className="pmeeple-badge">{p.meeplesAvailable}</span>
            </span>
            <span className="pname">{p.name}</span>
            {active && <span className="turn-flag" style={{ color: p.color }}>Turn</span>}
            <span className="pscore">{p.score}</span>
            <span className="pmeeples" title="Meeples available">
              <MeepleIcon color={p.color} size={12} opacity={0.65} />
              {p.meeplesAvailable}
            </span>
          </div>
        );
      })}
    </div>
  );
}
