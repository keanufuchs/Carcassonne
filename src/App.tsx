import { useState, useRef } from 'react';
import { ControllerContext } from './ui/hooks/useController';
import { useGameState } from './ui/hooks/useGameState';
import { createGameController } from './controller/GameController';
import { BoardView } from './ui/board/BoardView';
import { PlayerPanel } from './ui/hud/PlayerPanel';
import { TilePreview } from './ui/hud/TilePreview';
import { Controls } from './ui/hud/Controls';
import { EndGameScreen } from './ui/hud/EndGameScreen';
import { SetupScreen } from './ui/SetupScreen';
import type { GameController } from './controller/GameController';
import './ui/styles/game.css';

function GameApp({ controller }: { controller: GameController }) {
  const state = useGameState();
  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="game-layout">
      <div className="game-sidebar">
        <div className="sidebar-section">
          <PlayerPanel players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
        </div>
        <div className="sidebar-section">
          <TilePreview
            tile={state.pendingTile}
            rotation={state.pendingRotation}
            controller={controller}
            canDraw={state.phase === 'PLACING_TILE' && state.pendingTile === null}
            deckSize={state.deck.remaining.length}
          />
        </div>
        <div className="sidebar-section">
          <Controls
            phase={state.phase}
            currentPlayerName={currentPlayer?.name ?? ''}
            controller={controller}
          />
        </div>
      </div>
      <BoardView state={state} controller={controller} />
      {state.phase === 'GAME_OVER' && (
        <EndGameScreen players={state.players} onRestart={() => window.location.reload()} />
      )}
    </div>
  );
}

export default function App() {
  const controllerRef = useRef<GameController | null>(null);
  const [started, setStarted] = useState(false);

  if (!controllerRef.current) controllerRef.current = createGameController();
  const controller = controllerRef.current;

  if (!started) {
    return <SetupScreen onStart={names => { controller.startGame(names); setStarted(true); }} />;
  }

  return (
    <ControllerContext.Provider value={controller}>
      <GameApp controller={controller} />
    </ControllerContext.Provider>
  );
}
