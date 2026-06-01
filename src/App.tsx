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
import { TurnTimeline } from './ui/hud/TurnTimeline';
import type { MoveRecord } from './ui/hud/TurnTimeline';
import { SetupScreen } from './ui/SetupScreen';
import { LobbyScreen } from './ui/LobbyScreen';
import type { GameController } from './controller/GameController';
import { executeAITurn } from './ai';
import type { AIMode as RuntimeAIMode } from './ai';
import type { AIMode as PlayerAIMode } from './ui/SetupScreen';
import type { HeuristicAnalysis } from './ai/heuristic';
import { accumulateToolCall } from './ui/hud/toolCallAccumulator';
import type { ToolCallEntry } from './ui/hud/toolCallAccumulator';
import './ui/styles/game.css';

// ── Local game persistence ─────────────────────────────────────────────────

const LOCAL_SAVE_KEY = 'carc_local_game';
const LOCAL_SAVE_AI_KEY = 'carc_local_game_ai';

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
  try { localStorage.removeItem(LOCAL_SAVE_AI_KEY); } catch {}
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

function GameApp({ controller, aiModes }: { controller: GameController; aiModes?: PlayerAIMode[] }) {
  const state = useGameState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  const aiRunning = useRef(false);
  const activeAiRunRef = useRef(0);
  const pendingReasoningRef = useRef<string | null>(null);
  const pendingReasoningUnavailableRef = useRef<MoveRecord['reasoningUnavailableReason'] | null>(null);
  const pendingToolCallsRef = useRef<ToolCallEntry[]>([]);
  const pendingHeuristicRef = useRef<HeuristicAnalysis | null>(null);
  const [moveLog, setMoveLog] = useState<MoveRecord[]>([]);
  const [highlightedCoord, setHighlightedCoord] = useState<{ x: number; y: number } | null>(null);
  const [highlightKey, setHighlightKey] = useState(0);
  const highlightTimerRef = useRef<number | null>(null);
  const prevTileKeysRef = useRef<Set<string>>(new Set());

  // Auto-draw tile at the start of every turn
  useEffect(() => {
    if (state.phase === 'PLACING_TILE' && state.pendingTile === null) {
      controller.drawTile();
    }
  }, [state.phase, state.pendingTile, state.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track move history via direct controller subscription so we never miss a
  // placement that _advanceTurn() resolves inline (before publish() fires).
  useEffect(() => {
    prevTileKeysRef.current = new Set(controller.getState().board.tiles.keys());
    return controller.subscribe((s) => {
      if (s.board.tiles.size <= prevTileKeysRef.current.size) return;
      let newKey: string | undefined;
      for (const key of s.board.tiles.keys()) {
        if (!prevTileKeysRef.current.has(key)) { newKey = key; break; }
      }
      prevTileKeysRef.current = new Set(s.board.tiles.keys());
      if (!newKey) return;
      const placed = s.board.tiles.get(newKey);
      if (!placed) return;
      // currentPlayerIndex already advanced in PLACING_TILE; still the placer in PLACING_MEEPLE / GAME_OVER
      const placerIndex = (s.phase === 'PLACING_MEEPLE' || s.phase === 'GAME_OVER')
        ? s.currentPlayerIndex
        : (s.currentPlayerIndex - 1 + s.players.length) % s.players.length;
      const player = s.players[placerIndex];
      const aiMode = aiModes?.[placerIndex];
      const reasoning = pendingReasoningRef.current ?? undefined;
      const reasoningUnavailableReason = aiMode === 'intelligent' && !reasoning
        ? pendingReasoningUnavailableRef.current ?? 'missing'
        : undefined;
      const toolCalls = pendingToolCallsRef.current.length > 0 ? [...pendingToolCallsRef.current] : undefined;
      const heuristicAnalysis = pendingHeuristicRef.current ?? undefined;
      pendingReasoningRef.current = null;
      pendingReasoningUnavailableRef.current = null;
      pendingToolCallsRef.current = [];
      pendingHeuristicRef.current = null;
      setMoveLog(prev => {
        const turn = prev.length + 1;
        if (aiMode === 'intelligent' && !reasoning) {
          console.warn('[MoveHistory] Missing reasoning for Reasoning AI move', {
            turn,
            playerName: player.name,
            coord: placed.coord,
            rotation: placed.rotation,
            prototypeId: placed.prototypeId,
            reason: reasoningUnavailableReason,
          });
        }
        return [...prev, {
          turn,
          playerName: player.name,
          playerColor: player.color,
          prototypeId: placed.prototypeId,
          coord: placed.coord,
          rotation: placed.rotation,
          aiMode,
          toolCalls,
          reasoning,
          reasoningUnavailableReason,
          heuristicAnalysis,
        }];
      });
    });
  }, [controller, aiModes]);

  // Auto-execute AI turns
  useEffect(() => {
    if (!aiModes || state.phase === 'GAME_OVER') return;
    const currentMode = aiModes[state.currentPlayerIndex];
    if (!currentMode || currentMode === 'human') return;
    if (aiRunning.current) return;

    aiRunning.current = true;
    const runId = activeAiRunRef.current + 1;
    activeAiRunRef.current = runId;
    const run = async () => {
      try {
        await executeAITurn(controller, currentMode as RuntimeAIMode, (event) => {
          if (activeAiRunRef.current !== runId) return;
          if (event.type === 'reasoning') {
            pendingReasoningRef.current = event.text;
            pendingReasoningUnavailableRef.current = null;
          }
          if (event.type === 'fallback') {
            pendingReasoningUnavailableRef.current = event.reason;
          }
          if (event.type === 'heuristic_analysis') {
            pendingHeuristicRef.current = event.analysis;
          }
          pendingToolCallsRef.current = accumulateToolCall(pendingToolCallsRef.current, event);
        });
      } finally {
        if (activeAiRunRef.current === runId) {
          activeAiRunRef.current = 0;
        }
        aiRunning.current = false;
      }
    };
    run();
  }, [state.phase, state.currentPlayerIndex, state.version, aiModes]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleHighlight(coord: { x: number; y: number }) {
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    setHighlightedCoord(coord);
    setHighlightKey(k => k + 1);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedCoord(null);
      highlightTimerRef.current = null;
    }, 3000);
  }

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
      <BoardView state={state} controller={controller} isAiTurn={!!aiModes && aiModes[state.currentPlayerIndex] !== 'human'} highlightedCoord={highlightedCoord} highlightKey={highlightKey} />
      <div className="game-timeline">
        <TurnTimeline moves={moveLog} onHighlight={handleHighlight} />
      </div>
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

  type AIController = { start(): void; stop(): void };

  const networkRef = useRef<NetworkController | null>(null);
  const localRef   = useRef<GameController | null>(null);
  const aiRef = useRef<AIController | null>(null);

  // Restore local game from save (controller only)
  if (savedLocal && !localRef.current) {
    localRef.current = createGameController(savedLocal);
    // auto-save on every subsequent change
    localRef.current.subscribe(saveLocalGame);
  }

  // Restore aiModes from localStorage after page reload
  useEffect(() => {
    if (!localRef.current) return;
    try {
      const raw = localStorage.getItem(LOCAL_SAVE_AI_KEY);
      if (!raw) return;
      const modes = JSON.parse(raw);
      if (Array.isArray(modes)) setAiModes(modes);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleStartLocal(players: import('./ui/SetupScreen').PlayerSetup[]): void {
    clearLocalGame();
    aiRef.current?.stop?.();
    aiRef.current = null;
    const ctrl = createGameController();
    ctrl.subscribe(saveLocalGame);
    ctrl.startGame(players.map(p => p.name));
    localRef.current = ctrl;
    const modes = players.map(p => p.aiMode);
    setAiModes(modes);
    try { localStorage.setItem(LOCAL_SAVE_AI_KEY, JSON.stringify(modes)); } catch { /* quota */ }
    setMode('game');
  }

  const [aiModes, setAiModes] = useState<PlayerAIMode[] | undefined>();

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
      <GameApp controller={controller} aiModes={aiModes} />
    </ControllerContext.Provider>
  );
}
