import type { GameController } from '../../controller/GameController';
import type { GamePhase } from '../../core/types';

interface Props {
  phase: GamePhase;
  currentPlayerName: string;
  controller: GameController;
}

export function Controls({ phase, currentPlayerName, controller }: Props) {
  const active = phase === 'PLACING_TILE' || phase === 'PLACING_MEEPLE';
  return (
    <div className="hud-pad controls">
      <div className="prompt">
        {phase === 'PLACING_TILE' && (
          <><div className="who">{currentPlayerName}</div><div className="what">Place your tile</div></>
        )}
        {phase === 'PLACING_MEEPLE' && (
          <><div className="who">{currentPlayerName}</div><div className="what">Place a meeple or skip</div></>
        )}
        {phase === 'GAME_OVER' && <div className="who">Game Over</div>}
      </div>
      {phase === 'PLACING_MEEPLE' && (
        <button data-testid="skip-meeple-btn" className="btn btn-sm btn-ghost btn-block" onClick={() => controller.skipMeeple()}>
          Skip Meeple
        </button>
      )}
      {active && (
        <button data-testid="end-game-btn" className="btn btn-sm btn-danger btn-block" onClick={() => controller.endGame()}>
          End Game
        </button>
      )}
    </div>
  );
}
