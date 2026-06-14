import { useState } from 'react';
import type { Player } from '../../core/types';

interface Props {
  players: Player[];
  onRestart: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function EndGameScreen({ players, onRestart }: Props) {
  const [showMap, setShowMap] = useState(false);
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (showMap) {
    return (
      <button className="btn btn-gold exit-fab" onClick={onRestart}>Exit</button>
    );
  }

  return (
    <div className="endgame-overlay">
      <div className="card endgame-card">
        <div className="endgame-trophy">🏆</div>
        <h2 className="endgame-title">Game Over</h2>
        <p className="endgame-winner">
          <b>{sorted[0].name}</b> wins with {sorted[0].score} points!
        </p>
        <div className="score-table">
          {sorted.map((p, i) => (
            <div key={p.id} className={`score-row${i === 0 ? ' first' : ''}`}>
              <span className="rank">{MEDALS[i] ?? `${i + 1}`}</span>
              <span className="sdot" style={{ background: p.color }} />
              <span className="sname">{p.name}</span>
              <span className="sscore">{p.score}</span>
            </div>
          ))}
        </div>
        <div className="endgame-actions">
          <button className="btn btn-ghost btn-block" onClick={() => setShowMap(true)}>View Map</button>
          <button className="btn btn-primary btn-block" onClick={onRestart}>Play Again</button>
        </div>
      </div>
    </div>
  );
}
