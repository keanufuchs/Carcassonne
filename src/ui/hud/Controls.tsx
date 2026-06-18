import { useState } from 'react';
import type { GameController } from '../../controller/GameController';
import type { GamePhase } from '../../core/types';

interface Props {
  phase: GamePhase;
  currentPlayerName: string;
  controller: GameController;
  canInteract?: boolean;
}

export function Controls({ phase, currentPlayerName, controller, canInteract = true }: Props) {
  const active = phase === 'PLACING_TILE' || phase === 'PLACING_MEEPLE';
  const [showHints, setShowHints] = useState(false);
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
      {phase === 'PLACING_MEEPLE' && canInteract && (
        <button data-testid="skip-meeple-btn" className="btn btn-sm btn-ghost btn-block" onClick={() => controller.skipMeeple()}>
          Skip Meeple
        </button>
      )}
      {active && (
        <button data-testid="end-game-btn" className="btn btn-sm btn-danger btn-block" onClick={() => controller.endGame()}>
          End Game
        </button>
      )}

      <button
        type="button"
        className="control-hints__toggle"
        onClick={() => setShowHints(s => !s)}
        aria-expanded={showHints}
      >
        <span>{showHints ? 'Hide Shortcuts' : 'Open Shortcuts'}</span>
        <span className={`control-hints__chevron${showHints ? ' is-open' : ''}`}>▼</span>
      </button>

      <div className={`control-hints__collapse${showHints ? ' is-open' : ''}`}>
        <div className="control-hints">
          <div className="control-hints__row"><kbd>A</kbd><kbd>D</kbd> Rotate tile</div>
          <div className="control-hints__row"><kbd>Esc</kbd> Skip meeple</div>
          <div className="control-hints__row"><kbd>LClick</kbd> Place tile</div>
          <div className="control-hints__row"><kbd>LClick</kbd><kbd>Drag</kbd> Move camera</div>
          <div className="control-hints__row"><kbd>Shift</kbd><kbd>LClick</kbd><kbd>Drag</kbd> Rotate camera</div>
          <div className="control-hints__row"><kbd>R</kbd> Reset camera</div>
          <div className="control-hints__row"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> N / E / S / W</div>
        </div>
      </div>
    </div>
  );
}
