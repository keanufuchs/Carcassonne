import { useEffect, useState } from 'react';
import type { GameController } from '../../controller/GameController';
import type { GamePhase } from '../../core/types';

interface Props {
  phase: GamePhase;
  currentPlayerName: string;
  controller: GameController;
  canInteract?: boolean;
  viewMode?: '2d' | '3d';
}

/** How long the player may sit idle in the meeple phase before we nudge them. */
const MEEPLE_IDLE_MS = 5000;
/** How long the reminder blinks for attention before settling into a calm, static notice. */
const MEEPLE_BLINK_MS = 6000;

type ReminderState = 'hidden' | 'blinking' | 'static';

/**
 * Drives a reminder so players don't forget that placing (or skipping) a meeple
 * is required. While it's the player's turn to place a meeple:
 *  - any pointer/keyboard activity keeps the reminder hidden;
 *  - after `MEEPLE_IDLE_MS` of inactivity it appears and starts blinking;
 *  - once shown it stays visible regardless of further activity, and after
 *    `MEEPLE_BLINK_MS` it stops blinking but remains as a calm static notice.
 * It only resets to hidden when the meeple phase ends.
 */
function useMeepleIdleReminder(armed: boolean): ReminderState {
  const [state, setState] = useState<ReminderState>('hidden');

  useEffect(() => {
    if (!armed) {
      setState('hidden');
      return;
    }
    let idleTimer = 0;
    let blinkTimer = 0;
    let shown = false;
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel'];

    const reveal = () => {
      shown = true;
      window.clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      setState('blinking');
      blinkTimer = window.setTimeout(() => setState('static'), MEEPLE_BLINK_MS);
    };
    const onActivity = () => {
      if (shown) return; // once revealed it stays — don't restart the idle timer
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(reveal, MEEPLE_IDLE_MS);
    };

    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    idleTimer = window.setTimeout(reveal, MEEPLE_IDLE_MS);

    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(blinkTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [armed]);

  return state;
}

export function Controls({ phase, currentPlayerName, controller, canInteract = true, viewMode = '3d' }: Props) {
  const active = phase === 'PLACING_TILE' || phase === 'PLACING_MEEPLE';
  const [showHints, setShowHints] = useState(false);
  const meepleReminder = useMeepleIdleReminder(phase === 'PLACING_MEEPLE' && canInteract);
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
      {meepleReminder !== 'hidden' && (
        <div
          className={`meeple-reminder${meepleReminder === 'blinking' ? ' is-blinking' : ''}`}
          role="alert"
          data-testid="meeple-reminder"
        >
          <span className="meeple-reminder__icon" aria-hidden="true">⚠</span>
          <span>Don't forget — place a meeple or skip to continue.</span>
        </div>
      )}
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
          <div className="control-hints__row"><kbd>LClick</kbd><kbd>Drag</kbd> Move board</div>
          {viewMode === '2d' ? (
            <div className="control-hints__row"><kbd>Wheel</kbd> Zoom board</div>
          ) : (
            <>
              <div className="control-hints__row"><kbd>Shift</kbd><kbd>LClick</kbd><kbd>Drag</kbd> Rotate camera</div>
              <div className="control-hints__row"><kbd>R</kbd> Reset camera</div>
              <div className="control-hints__row"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> N / E / S / W</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
