import type { Player } from '../../core/types';
import { TrophyIcon, MedalIcon } from '../icons/Icons';

interface Props {
  players: Player[];
  onRestart: () => void;
  showMap: boolean;
  onShowMap: () => void;
}



export function EndGameScreen({ players, onRestart, showMap, onShowMap }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (showMap) return null;

  return (
    <div className="endgame-overlay">
      <div className="card endgame-card">
        <div className="endgame-trophy">
          <TrophyIcon size={72} style={{ margin: '0 auto' }} />
        </div>
        <h2 className="endgame-title">Game Over</h2>
        <p className="endgame-winner">
          <b>{sorted[0].name}</b> wins with {sorted[0].score} points!
        </p>
        <div className="score-table">
          {sorted.map((p, i) => (
            <div key={p.id} className={`score-row${i === 0 ? ' first' : ''}`}>
              <span className="rank" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < 3 ? <MedalIcon rank={i} size={22} /> : `${i + 1}`}
              </span>
              <span className="sdot" style={{ background: p.color }} />
              <span className="sname">{p.name}</span>
              <span className="sscore">{p.score}</span>
            </div>
          ))}
        </div>
        <div className="endgame-actions">
          <button
            type="button"
            className="btn btn-ghost btn-block"
            data-testid="view-map-btn"
            onClick={onShowMap}
          >
            View Map
          </button>
          <button className="btn btn-primary btn-block" onClick={onRestart}>Menu</button>
        </div>
      </div>
    </div>
  );
}
