import { useState, useRef, useEffect } from 'react';
import { ControllerContext } from './ui/hooks/useController';
import { useGameState } from './ui/hooks/useGameState';
import { createGameController } from './controller/GameController';
import { serializeState, deserializeState } from './core/serialize';
import {
  createGame,
  joinGame,
  createNetworkController,
} from './controller/NetworkController';
import type { NetworkController, NetworkSession, LobbyInfo } from './controller/NetworkController';
import { BoardView } from './ui/board/BoardView';
import { PlayerPanel } from './ui/hud/PlayerPanel';
import { TilePreview } from './ui/hud/TilePreview';
import { Controls } from './ui/hud/Controls';
import { EndGameScreen } from './ui/hud/EndGameScreen';
import { SetupScreen } from './ui/SetupScreen';
import { LobbyScreen } from './ui/LobbyScreen';
import type { GameController } from './controller/GameController';
import './ui/styles/game.css';

// ── Local game persistence ─────────────────────────────────────────────────

const LOCAL_SAVE_KEY = 'carc_local_game';

function saveLocalGame(state: Readonly<import('./core/game/GameState').GameState>): void {
  try { localStorage.setItem(LOCAL_SAVE_KEY, serializeState(state)); } catch { /* quota */ }
}

function loadLocalGame(): import('./core/game/GameState').GameState | null {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    return raw ? deserializeState(raw) : null;
  } catch { return null; }
}

function clearLocalGame(): void {
  localStorage.removeItem(LOCAL_SAVE_KEY);
}

// ── Network session persistence ────────────────────────────────────────────

function getGameIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('game');
}

function loadSession(gameId: string): NetworkSession | null {
  try {
    const raw = localStorage.getItem(`carc_session_${gameId}`);
    return raw ? (JSON.parse(raw) as NetworkSession) : null;
  } catch { return null; }
}

function saveSession(s: NetworkSession): void {
  localStorage.setItem(`carc_session_${s.gameId}`, JSON.stringify(s));
}

function pushUrl(gameId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('game', gameId);
  window.history.pushState({}, '', url.toString());
}

// ── Game view ──────────────────────────────────────────────────────────────

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
        <EndGameScreen players={state.players} onRestart={() => { clearLocalGame(); window.location.reload(); }} />
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

type Mode = 'setup' | 'connecting' | 'lobby' | 'game';

export default function App() {
  const urlGameId = getGameIdFromUrl();

  // Determine initial mode: if URL has a game id → try to reconnect
  // If no URL game id but local save exists → restore local game immediately
  const savedLocal = !urlGameId ? loadLocalGame() : null;
  const [mode, setMode] = useState<Mode>(() => {
    if (urlGameId) return 'connecting';
    if (savedLocal) return 'game';
    return 'setup';
  });

  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);

  const networkRef = useRef<NetworkController | null>(null);
  const localRef   = useRef<GameController | null>(null);

  // Restore local game from save
  if (savedLocal && !localRef.current) {
    localRef.current = createGameController(savedLocal);
    // auto-save on every subsequent change
    localRef.current.subscribe(saveLocalGame);
  }

  // Reconnect network game from URL + localStorage on mount
  useEffect(() => {
    if (!urlGameId) return;
    const session = loadSession(urlGameId);
    if (!session) { setMode('setup'); return; }

    const nc = createNetworkController(session);
    networkRef.current = nc;

    const unsubLobby = nc.subscribeLobby(info => {
      setLobbyInfo(info);
      setMode('lobby');
    });
    const unsubState = nc.subscribe(() => setMode('game'));

    return () => { unsubLobby(); unsubState(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreateGame(playerName: string): Promise<void> {
    const session = await createGame(playerName);
    saveSession(session);
    pushUrl(session.gameId);

    const nc = createNetworkController(session);
    networkRef.current = nc;
    nc.subscribeLobby(info => { setLobbyInfo(info); setMode('lobby'); });
    nc.subscribe(() => setMode('game'));
    setMode('connecting');
  }

  async function handleJoinGame(gameId: string, playerName: string): Promise<void> {
    const existing = loadSession(gameId);
    const session = await joinGame(gameId, playerName, existing?.sessionId);
    saveSession(session);
    pushUrl(session.gameId);

    const nc = createNetworkController(session);
    networkRef.current = nc;
    nc.subscribeLobby(info => { setLobbyInfo(info); setMode('lobby'); });
    nc.subscribe(() => setMode('game'));
    setMode('connecting');
  }

  function handleStartLocal(names: string[]): void {
    clearLocalGame();
    const ctrl = createGameController();
    ctrl.subscribe(saveLocalGame);
    ctrl.startGame(names);
    localRef.current = ctrl;
    setMode('game');
  }

  function handleStartNetworkGame(): void {
    networkRef.current?.startGame([]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (mode === 'setup') {
    return (
      <SetupScreen
        initialGameId={urlGameId ?? undefined}
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        onStartLocal={handleStartLocal}
      />
    );
  }

  if (mode === 'connecting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0e1a', color: '#ffd700', fontFamily: 'system-ui', fontSize: 18 }}>
        Connecting…
      </div>
    );
  }

  if (mode === 'lobby' && lobbyInfo && networkRef.current) {
    return (
      <LobbyScreen
        lobbyInfo={lobbyInfo}
        gameId={lobbyInfo.gameId}
        onStart={handleStartNetworkGame}
      />
    );
  }

  const controller = networkRef.current ?? localRef.current;
  if (!controller) return null;

  return (
    <ControllerContext.Provider value={controller}>
      <GameApp controller={controller} />
    </ControllerContext.Provider>
  );
}
