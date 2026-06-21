import { useState, useRef, useEffect, useMemo, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { ControllerContext } from './ui/hooks/useController';
import { useGameState } from './ui/hooks/useGameState';
import { useIsMobile } from './ui/hooks/useIsMobile';
import { createGameController } from './controller/GameController';
import { startGame as startGameCore } from './core/game/Game';
import { getPrototype } from './core/deck/baseGameTiles';
import { buildSummary } from './test-bridge/scenarioBridge';
import { autoPlayToEnd as runAutoPlay } from './test-bridge/autoPlay';
import { serializeState, deserializeState } from './core/serialize';
import {
  createGame,
  joinGame,
  createNetworkController,
} from './controller/NetworkController';
import type { NetworkController, NetworkSession, LobbyInfo } from './controller/NetworkController';
import { Board3DView } from './ui/board/Board3DView';
import { BoardView } from './ui/board/BoardView';
import { PlayerPanel } from './ui/hud/PlayerPanel';
import { TilePreview } from './ui/hud/TilePreview';
import { getTilePreviewDisplay } from './ui/hud/tilePreviewDisplay';
import { Controls } from './ui/hud/Controls';
import { EndGameScreen } from './ui/hud/EndGameScreen';
import { TurnTimeline } from './ui/hud/TurnTimeline';
import type { MoveRecord } from './ui/hud/TurnTimeline';
import { MeepleChoiceList } from './ui/hud/MeepleChoiceList';
import { buildMeepleChoices, type MeepleChoice } from './ui/hud/meepleChoices';
import type { SegmentRef } from './core/types';
import { segmentKey } from './core/types';
import { SetupScreen } from './ui/SetupScreen';
import { LobbyScreen } from './ui/LobbyScreen';
import type { GameController } from './controller/GameController';
import type { GameState } from './core/game/GameState';
import { executeAITurn } from './ai';
import type { AIMode as RuntimeAIMode } from './ai';
import type { AIMode as PlayerAIMode } from './ui/SetupScreen';
import type { HeuristicAnalysis } from './ai/heuristic';
import { accumulateToolCall } from './ui/hud/toolCallAccumulator';
import type { ToolCallEntry } from './ui/hud/toolCallAccumulator';
import tileDistribution from './core/deck/tileDistribution.json';
import './ui/styles/game.css';

// Tile id → image path, used by the mobile drag overlay.
const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

// ── Local game persistence ─────────────────────────────────────────────────

const LOCAL_SAVE_KEY = 'carc_local_game';
const LOCAL_SAVE_AI_KEY = 'carc_local_game_ai';
const LOCAL_SAVE_AI_MODELS_KEY = 'carc_local_game_ai_models';
const LOCAL_SAVE_MOVELOG_KEY = 'carc_local_game_movelog';

function saveLocalGame(state: Readonly<import('./core/game/GameState').GameState>): void {
  try { localStorage.setItem(LOCAL_SAVE_KEY, serializeState(state)); } catch { /* quota */ }
}

function loadLocalGame(): import('./core/game/GameState').GameState | null {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    return raw ? deserializeState(raw) : null;
  } catch { return null; }
}

function saveLocalMoveLog(log: import('./ui/hud/TurnTimeline').MoveRecord[]): void {
  try { localStorage.setItem(LOCAL_SAVE_MOVELOG_KEY, JSON.stringify(log)); } catch { /* quota */ }
}

function loadLocalMoveLog(): import('./ui/hud/TurnTimeline').MoveRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_MOVELOG_KEY);
    return raw ? (JSON.parse(raw) as import('./ui/hud/TurnTimeline').MoveRecord[]) : [];
  } catch { return []; }
}

function clearLocalGame(): void {
  localStorage.removeItem(LOCAL_SAVE_KEY);
  localStorage.removeItem(LOCAL_SAVE_MOVELOG_KEY);
  try { localStorage.removeItem(LOCAL_SAVE_AI_KEY); } catch {}
  try { localStorage.removeItem(LOCAL_SAVE_AI_MODELS_KEY); } catch {}
  try { localStorage.removeItem(BOARD_VIEW_KEY); } catch {}
}

// ── Board view-mode (2D / 3D) persistence ───────────────────────────────────

type BoardViewMode = '2d' | '3d';
const BOARD_VIEW_KEY = 'carc_board_view';

function loadBoardViewMode(): BoardViewMode {
  try {
    return localStorage.getItem(BOARD_VIEW_KEY) === '2d' ? '2d' : '3d';
  } catch { return '3d'; }
}

function saveBoardViewMode(mode: BoardViewMode): void {
  try { localStorage.setItem(BOARD_VIEW_KEY, mode); } catch { /* quota */ }
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

function clearUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('game');
  window.history.pushState({}, '', url.toString());
}

function removeSession(gameId: string): void {
  try { localStorage.removeItem(`carc_session_${gameId}`); } catch { /* ignore */ }
}

// ── Game view ──────────────────────────────────────────────────────────────

/** Local hot-seat / AI: human at the table. Network: this client's assigned seat. */
function canInteract(
  controller: GameController,
  state: GameState,
  aiModes?: PlayerAIMode[],
): boolean {
  const isHumanTurn = !aiModes || aiModes[state.currentPlayerIndex] === 'human';
  if (!isHumanTurn) return false;
  if ('playerIndex' in controller) {
    return (controller as NetworkController).playerIndex === state.currentPlayerIndex;
  }
  return true;
}

function GameApp({ controller, aiModes, aiModels }: { controller: GameController; aiModes?: PlayerAIMode[]; aiModels?: (string | undefined)[] }) {
  const state = useGameState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  const interactive = canInteract(controller, state, aiModes);
  const aiRunning = useRef(false);
  const activeAiRunRef = useRef(0);
  const pendingReasoningRef = useRef<string | null>(null);
  const pendingReasoningUnavailableRef = useRef<MoveRecord['reasoningUnavailableReason'] | null>(null);
  const pendingToolCallsRef = useRef<ToolCallEntry[]>([]);
  const pendingHeuristicRef = useRef<HeuristicAnalysis | null>(null);
  const [moveLog, setMoveLog] = useState<MoveRecord[]>(loadLocalMoveLog);
  useEffect(() => { saveLocalMoveLog(moveLog); }, [moveLog]);
  const isMobile = useIsMobile();
  const [boardView, setBoardView] = useState<BoardViewMode>(loadBoardViewMode);
  const effectiveBoardView: BoardViewMode = isMobile ? '3d' : boardView;
  // How far the 3D board camera has orbited from its initial view (radians).
  // Drives the HUD preview tile so it spins to match the live view (issue #45).
  const [cameraSpin, setCameraSpin] = useState(0);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const [showMap, setShowMap] = useState(false);
  // Confirmation before ending the match — the End Game icon reads as "leave",
  // so the dialog spells out that it ends the game for everyone.
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  // Mobile meeple placement: the segment picked from the choice list (issue #34).
  const [selectedMeepleRef, setSelectedMeepleRef] = useState<SegmentRef | null>(null);
  // Mobile drag-to-place: live finger position while dragging the
  // pending tile out of the bottom bar, the board's reported drop target, and a
  // transient "doesn't fit" toast.
  const [dragPointer, setDragPointer] = useState<{ clientX: number; clientY: number } | null>(null);
  const dragHoverRef = useRef<{ coord: { x: number; y: number }; legal: boolean } | null>(null);
  const [dropToast, setDropToast] = useState<string | null>(null);
  const dropToastTimerRef = useRef<number | null>(null);
  const [discardToast, setDiscardToast] = useState<string | null>(null);
  const discardToastTimerRef = useRef<number | null>(null);
  const [highlightedCoord, setHighlightedCoord] = useState<{ x: number; y: number } | null>(null);
  const [highlightKey, setHighlightKey] = useState(0);
  const highlightTimerRef = useRef<number | null>(null);
  const prevTileKeysRef = useRef<Set<string>>(new Set());
  const tilePreview = useMemo(() => getTilePreviewDisplay(state), [
    state.pendingTile,
    state.pendingRotation,
    state.phase,
    state.lastPlacedTileId,
    state.version,
  ]);
  const canRotatePreview = state.phase === 'PLACING_TILE' && tilePreview.tile !== null;

  // Valid meeple placements on the last tile, enriched with each segment's kind
  // so the mobile choice list can label them (issue #34).
  const meepleChoices = useMemo<MeepleChoice[]>(() => {
    if (state.phase !== 'PLACING_MEEPLE' || !interactive) return [];
    const placed = state.lastPlacedTileId
      ? [...state.board.tiles.values()].find(t => t.tileId === state.lastPlacedTileId)
      : undefined;
    if (!placed) return [];
    return buildMeepleChoices(controller.getMeepleTargetsForLastTile(), placed.segmentInstances);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.lastPlacedTileId, state.version, interactive, controller]);

  // Derive the active selection so a stale pick (after the tile/phase changed)
  // simply falls away instead of needing an effect to reset it.
  const selectedKey = selectedMeepleRef ? segmentKey(selectedMeepleRef) : null;
  const activeMeepleRef = meepleChoices.some(c => segmentKey(c.ref) === selectedKey)
    ? selectedMeepleRef
    : null;

  function toggleBoardView() {
    setBoardView(prev => {
      const next: BoardViewMode = prev === '3d' ? '2d' : '3d';
      saveBoardViewMode(next);
      return next;
    });
  }

  function handleHighlight(coord: { x: number; y: number }) {
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    setHighlightedCoord(coord);
    setHighlightKey(k => k + 1);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedCoord(null);
      highlightTimerRef.current = null;
    }, 3000);
  }

  // ── Mobile drag-to-place ───────────────────────────────────────
  const showDropToast = useCallback((message: string) => {
    if (dropToastTimerRef.current !== null) window.clearTimeout(dropToastTimerRef.current);
    setDropToast(message);
    dropToastTimerRef.current = window.setTimeout(() => {
      setDropToast(null);
      dropToastTimerRef.current = null;
    }, 1800);
  }, []);

  const handleDragHoverChange = useCallback(
    (result: { coord: { x: number; y: number }; legal: boolean } | null) => {
      dragHoverRef.current = result;
    },
    [],
  );

  function handleTileDragStart(e: ReactPointerEvent) {
    if (!isMobile || !interactive) return;
    if (state.phase !== 'PLACING_TILE' || !state.pendingTile) return;
    e.preventDefault();
    dragHoverRef.current = null;
    setDragPointer({ clientX: e.clientX, clientY: e.clientY });
  }

  // Track the finger globally during a drag so it keeps following even when it
  // leaves the small tile handle, and resolve the drop on release.
  const isDragging = dragPointer !== null;
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      setDragPointer({ clientX: e.clientX, clientY: e.clientY });
    };
    const onUp = () => {
      const hover = dragHoverRef.current;
      dragHoverRef.current = null;
      setDragPointer(null);
      if (hover && hover.legal) {
        controller.placeTile(hover.coord);
      } else if (hover) {
        // Finger was over the board but the tile can't go there.
        showDropToast('Hier passt das Plättchen nicht');
      }
      // hover === null → released off the board: silently cancel.
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging, controller, showDropToast]);

  useEffect(() => () => {
    if (dropToastTimerRef.current !== null) window.clearTimeout(dropToastTimerRef.current);
  }, []);

  useEffect(() => {
    const count = state.lastDrawDiscardedCount;
    if (count <= 0) return;
    if (discardToastTimerRef.current !== null) window.clearTimeout(discardToastTimerRef.current);
    const noun = count === 1 ? 'Kachel' : 'Kacheln';
    setDiscardToast(`${count} ${noun} ohne Platz verworfen`);
    discardToastTimerRef.current = window.setTimeout(() => {
      setDiscardToast(null);
      discardToastTimerRef.current = null;
    }, 3000);
  }, [state.lastDrawDiscardedCount, state.version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (discardToastTimerRef.current !== null) window.clearTimeout(discardToastTimerRef.current);
  }, []);

  // Auto-draw tile at the start of every turn (active player only in network games)
  useEffect(() => {
    if (!interactive) return;
    if (state.phase === 'PLACING_TILE' && state.pendingTile === null) {
      controller.drawTile();
    }
  }, [interactive, state.phase, state.pendingTile, state.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts (A/D rotate, Esc skip meeple)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!interactive) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = event.key.toLowerCase();
      if (key === 'a') {
        if (state.phase === 'PLACING_TILE' && state.pendingTile) {
          controller.rotatePending('CCW');
          event.preventDefault();
        }
        return;
      }
      if (key === 'd') {
        if (state.phase === 'PLACING_TILE' && state.pendingTile) {
          controller.rotatePending('CW');
          event.preventDefault();
        }
        return;
      }
      if (event.key === 'Escape') {
        if (state.phase === 'PLACING_MEEPLE') {
          controller.skipMeeple();
          event.preventDefault();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controller, interactive, state.phase, state.pendingTile]);

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
        }, aiModels?.[state.currentPlayerIndex]);
      } finally {
        if (activeAiRunRef.current === runId) {
          activeAiRunRef.current = 0;
        }
        aiRunning.current = false;
      }
    };
    run();
  }, [state.phase, state.currentPlayerIndex, state.version, aiModes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scrolling on mobile while the game is mounted; the CSS rule keyed
  // on this class fixes the page to the viewport so nothing scrolls (issue #37).
  useEffect(() => {
    if (!isMobile) return;
    document.body.classList.add('carc-game-active');
    return () => document.body.classList.remove('carc-game-active');
  }, [isMobile]);

  const canEndGame = state.phase === 'PLACING_TILE' || state.phase === 'PLACING_MEEPLE';

  return (
    <div className={`game-layout${isMobile ? ' is-mobile' : ''}`} data-testid="game-layout">
      {isMobile ? (
        <div className="mobile-topbar">
          <PlayerPanel players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
          {canEndGame && (
            <button
              type="button"
              data-testid="end-game-btn"
              className="mobile-endgame-btn"
              onClick={() => setConfirmEndOpen(true)}
              aria-label="Spiel verlassen"
              title="Spiel verlassen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
          {state.phase === 'GAME_OVER' && showMap && (
            <button
              type="button"
              data-testid="mobile-exit-btn"
              className="mobile-endgame-btn"
              onClick={() => { clearLocalGame(); window.location.reload(); }}
              aria-label="Exit"
              title="Exit"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      ) : (
      <div className="game-sidebar">
        <div className="game-brand">
          <img src="/favicon.svg" className="mark" alt="Carcassonne Logo" />
          <span className="name">Carcassonne</span>
        </div>
        <div className="sidebar-section">
          <PlayerPanel players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
        </div>
        <div className="sidebar-section">
          <TilePreview
            tile={tilePreview.tile}
            rotation={tilePreview.rotation}
            controller={controller}
            deckSize={state.deck.remaining.length}
            canInteract={interactive}
            canRotate={canRotatePreview}
            viewMode={effectiveBoardView}
            cameraSpin={cameraSpin}
          />
        </div>
        <div className="sidebar-section">
          <Controls
            phase={state.phase}
            currentPlayerName={currentPlayer?.name ?? ''}
            controller={controller}
            canInteract={interactive}
            viewMode={effectiveBoardView}
          />
        </div>
        {state.phase === 'GAME_OVER' && showMap && (
          <div className="sidebar-exit">
            <button
              type="button"
              className="btn btn-gold btn-block"
              onClick={() => { clearLocalGame(); window.location.reload(); }}
            >
              Exit
            </button>
          </div>
        )}
      </div>
      )}
      <div className="board-area">
        {!isMobile && (
          <button
            type="button"
            className="board-view-toggle"
            onClick={toggleBoardView}
            aria-label={boardView === '3d' ? 'Zur 2D-Ansicht wechseln' : 'Zur 3D-Ansicht wechseln'}
            title={boardView === '3d' ? 'Zur 2D-Ansicht wechseln' : 'Zur 3D-Ansicht wechseln'}
          >
            <span className={boardView === '2d' ? 'is-active' : ''}>2D</span>
            <span className={boardView === '3d' ? 'is-active' : ''}>3D</span>
          </button>
        )}
        {effectiveBoardView === '3d' && isMobile && (
          <button
            type="button"
            className="board-recenter-btn"
            onClick={() => resetCameraRef.current?.()}
            aria-label="Kamera zurücksetzen"
            title="Kamera zurücksetzen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="18" height="18" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="7" />
              <line x1="12" y1="17" x2="12" y2="22" />
              <line x1="2" y1="12" x2="7" y2="12" />
              <line x1="17" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        )}
        {effectiveBoardView === '3d' ? (
          <Board3DView state={state} controller={controller} canInteract={interactive} highlightedCoord={highlightedCoord} highlightKey={highlightKey} previewMeepleRef={activeMeepleRef} dragPointer={dragPointer} onDragHoverChange={handleDragHoverChange} onCameraSpinChange={setCameraSpin} resetCameraRef={resetCameraRef} />
        ) : (
          <BoardView state={state} controller={controller} canInteract={interactive} highlightedCoord={highlightedCoord} highlightKey={highlightKey} />
        )}
      </div>
      {!isMobile && (
        <div className="game-timeline">
          <TurnTimeline moves={moveLog} onHighlight={handleHighlight} viewMode={effectiveBoardView} />
        </div>
      )}
      {isMobile && (
        <div className="mobile-bottombar">
          {state.phase === 'PLACING_MEEPLE' && interactive ? (
            <MeepleChoiceList
              choices={meepleChoices}
              selectedKey={activeMeepleRef ? segmentKey(activeMeepleRef) : null}
              onSelect={setSelectedMeepleRef}
              onConfirm={() => {
                if (activeMeepleRef) controller.placeMeeple(activeMeepleRef);
              }}
              onSkip={() => controller.skipMeeple()}
            />
          ) : (
            <TilePreview
              tile={tilePreview.tile}
              rotation={tilePreview.rotation}
              controller={controller}
              deckSize={state.deck.remaining.length}
              canInteract={interactive}
              canRotate={canRotatePreview}
              viewMode={effectiveBoardView}
              cameraSpin={cameraSpin}
              onTileDragStart={handleTileDragStart}
            />
          )}
        </div>
      )}
      {/* Floating 2D tile follows the finger only in the 2D view. In 3D the
          in-scene translucent ghost tile is the drag indicator, so we must not
          overlay the flat SVG on top of it. */}
      {dragPointer && state.pendingTile && effectiveBoardView === '2d' && (
        <div
          className="tile-drag-overlay"
          data-testid="tile-drag-overlay"
          style={{ left: dragPointer.clientX, top: dragPointer.clientY }}
        >
          <img
            src={tileImageMap[state.pendingTile.id] ?? ''}
            alt=""
            draggable={false}
            style={{ transform: `rotate(${state.pendingRotation}deg)` }}
          />
        </div>
      )}
      {dropToast && (
        <div className="mobile-toast" role="status" data-testid="drop-toast">{dropToast}</div>
      )}
      {discardToast && (
        <div className="mobile-toast" role="status" data-testid="discard-toast">{discardToast}</div>
      )}
      {state.phase === 'GAME_OVER' && (
        <EndGameScreen
          players={state.players}
          onRestart={() => { clearLocalGame(); window.location.reload(); }}
          showMap={showMap}
          onShowMap={() => setShowMap(true)}
        />
      )}
      {confirmEndOpen && (
        <div
          className="confirm-overlay"
          data-testid="end-game-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-end-title"
          onClick={() => setConfirmEndOpen(false)}
        >
          <div className="card confirm-card" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-end-title" className="confirm-title">Spiel verlassen?</h2>
            <p className="confirm-text">
              Möchtest du das Spiel wirklich verlassen? Es beendet das Spiel für alle.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-ghost btn-block"
                data-testid="end-game-cancel"
                onClick={() => setConfirmEndOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-danger btn-block"
                data-testid="end-game-confirm-btn"
                onClick={() => { setConfirmEndOpen(false); controller.endGame(); }}
              >
                Spiel beenden
              </button>
            </div>
          </div>
        </div>
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
      const rawModels = localStorage.getItem(LOCAL_SAVE_AI_MODELS_KEY);
      if (rawModels) {
        const models = JSON.parse(rawModels);
        if (Array.isArray(models)) setAiModels(models);
      }
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
    try { localStorage.removeItem(BOARD_VIEW_KEY); } catch {}
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

  function handleLeaveLobby(): void {
    const nc = networkRef.current;
    nc?.leave();
    networkRef.current = null;
    if (lobbyInfo) removeSession(lobbyInfo.gameId);
    clearUrl();
    setLobbyInfo(null);
    setMode('setup');
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
    const models = players.map(p => p.aiModel);
    setAiModes(modes);
    setAiModels(models);
    try { localStorage.setItem(LOCAL_SAVE_AI_KEY, JSON.stringify(modes)); } catch { /* quota */ }
    try { localStorage.setItem(LOCAL_SAVE_AI_MODELS_KEY, JSON.stringify(models)); } catch { /* quota */ }
    setMode('game');
  }

  const [aiModes, setAiModes] = useState<PlayerAIMode[] | undefined>();
  const [aiModels, setAiModels] = useState<(string | undefined)[] | undefined>();

  // DEV-only scenario test bridge (see src/test-bridge/scenarioBridge.ts).
  // Lets the Playwright/YAML runner start a deterministic game and read an
  // assertable summary. Stripped from production builds via import.meta.env.DEV.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__carcTest = {
      startScenario({ players, deck }) {
        // Preserve the board-view preference (set by the scenario runner's
        // addInitScript) because clearLocalGame() now clears it too.
        const savedView = localStorage.getItem(BOARD_VIEW_KEY);
        clearLocalGame();
        if (savedView) localStorage.setItem(BOARD_VIEW_KEY, savedView);
        aiRef.current?.stop?.();
        aiRef.current = null;
        const ctrl = createGameController(
          startGameCore(players, undefined, deck.map(getPrototype)),
        );
        localRef.current = ctrl;
        setAiModes(players.map(() => 'human' as PlayerAIMode));
        setMode('game');
      },
      getSummary() {
        if (!localRef.current) throw new Error('No active game');
        return buildSummary(localRef.current.getState());
      },
      endGame() {
        localRef.current?.endGame();
      },
      autoPlayToEnd(seed) {
        const ctrl = localRef.current;
        if (!ctrl) throw new Error('No active game');
        runAutoPlay(ctrl, seed);
      },
      fitBoardView() {
        window.dispatchEvent(new Event('carc:fit-board-view'));
      },
      placeMeepleOnLastTile(localId) {
        const ctrl = localRef.current;
        if (!ctrl) throw new Error('No active game');
        const ref = ctrl.getMeepleTargetsForLastTile().find(r => r.localId === localId);
        if (!ref) throw new Error(`Segment ${localId} is not a meeple target on the last placed tile`);
        const result = ctrl.placeMeeple(ref);
        if (result.ok === false) throw new Error(`${result.error}: ${result.message}`);
      },
      skipMeepleTurn() {
        const ctrl = localRef.current;
        if (!ctrl) throw new Error('No active game');
        const result = ctrl.skipMeeple();
        if (result.ok === false) throw new Error(`${result.error}: ${result.message}`);
      },
      previewPlacement(coord, rotation) {
        const ctrl = localRef.current;
        if (!ctrl) throw new Error('No active game');
        return ctrl.previewPlacement(coord, rotation as 0 | 90 | 180 | 270);
      },
      tryPlaceMeepleOnLastTile(localId) {
        const ctrl = localRef.current;
        if (!ctrl) throw new Error('No active game');
        const ref = ctrl.getMeepleTargetsForLastTile().find(r => r.localId === localId)
          ?? (() => {
            const lastId = ctrl.getState().lastPlacedTileId;
            if (!lastId) return undefined;
            return { tileId: lastId, localId };
          })();
        if (!ref) return { ok: false as const, error: 'SEGMENT_NOT_FOUND' };
        const result = ctrl.placeMeeple(ref);
        if (result.ok === false) return { ok: false as const, error: result.error };
        return { ok: true as const };
      },
    };
    return () => { delete window.__carcTest; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="menu-screen">
        <div className="connecting">
          <div className="spinner" />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>Connecting…</div>
        </div>
      </div>
    );
  }

  if (mode === 'lobby' && lobbyInfo && networkRef.current) {
    return (
      <LobbyScreen
        lobbyInfo={lobbyInfo}
        gameId={lobbyInfo.gameId}
        onStart={handleStartNetworkGame}
        onLeave={handleLeaveLobby}
      />
    );
  }

  const controller = networkRef.current ?? localRef.current;
  if (!controller) return null;

  return (
    <ControllerContext.Provider value={controller}>
      <GameApp controller={controller} aiModes={aiModes} aiModels={aiModels} />
    </ControllerContext.Provider>
  );
}
