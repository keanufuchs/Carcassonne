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
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#aaa', fontSize: 12, textAlign: 'center', lineHeight: 1.4 }}>
        {phase === 'PLACING_TILE'   && <>{currentPlayerName}<br />Place the tile</>}
        {phase === 'PLACING_MEEPLE' && <>{currentPlayerName}<br />Place a meeple or skip</>}
        {phase === 'GAME_OVER'      && 'Game over!'}
      </div>
      {phase === 'PLACING_MEEPLE' && (
        <button
          data-testid="skip-meeple-btn"
          onClick={() => controller.skipMeeple()}
          style={{ background: '#3a3a5a', color: '#ccc', border: '1px solid #555', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          Skip Meeple
        </button>
      )}
      {active && (
        <button
          data-testid="end-game-btn"
          onClick={() => controller.endGame()}
          style={{ background: '#3a1a1a', color: '#f87171', border: '1px solid #5a2a2a', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 12, marginTop: 4 }}
        >
          End Game
        </button>
      )}
    </div>
  );
}
