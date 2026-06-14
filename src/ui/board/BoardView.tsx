import { useState, useMemo, useRef, useEffect } from 'react';
import type { GameState } from '../../core/game/GameState';
import type { GameController } from '../../controller/GameController';
import { TileView } from './TileView';
import { CoordRulers } from './CoordRulers';
import { GhostTile } from './GhostTile';
import { candidatePlacements } from '../../core/board/Board';
import { segmentKey, parseSegmentKey } from '../../core/types';
import { useBoardTransform } from '../hooks/useBoardTransform';
import tileDistribution from '../../core/deck/tileDistribution.json';
import './board.css';

const TILE_SIZE = 80;
const MEEPLE_FOCUS_ANIMATION_MS = 260;

// Fixed coordinate offset: tiles at game coord (x,y) are placed at pixel
// (x + COORD_OFFSET) * TILE_SIZE so negative game coords stay positive on canvas.
// 40 tiles in any direction is more than enough for a full Carcassonne game.
const COORD_OFFSET = 40;
const CANVAS_SIZE = (COORD_OFFSET * 2 + 1) * TILE_SIZE;

// center of the start tile (0,0) in canvas pixels — constant, never changes
const CENTER_X = (COORD_OFFSET + 0.5) * TILE_SIZE;
const CENTER_Y = (COORD_OFFSET + 0.5) * TILE_SIZE;

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

let sharedAudioContext: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  try {
    sharedAudioContext = new AudioContextCtor();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playTilePlacementSound(): void {
  const context = getOrCreateAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  master.connect(context.destination);

  const tone = context.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(180, now);
  tone.frequency.exponentialRampToValueAtTime(128, now + 0.12);
  tone.connect(master);
  tone.start(now);
  tone.stop(now + 0.18);

  const click = context.createOscillator();
  click.type = 'triangle';
  click.frequency.setValueAtTime(460, now);
  const clickGain = context.createGain();
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.014, now + 0.004);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  click.connect(clickGain);
  clickGain.connect(master);
  click.start(now + 0.002);
  click.stop(now + 0.06);
}

interface Props {
  state: GameState;
  controller: GameController;
  isAiTurn?: boolean;
  highlightedCoord?: { x: number; y: number } | null;
  highlightKey?: number;
}

export function BoardView({ state, controller, isAiTurn = false, highlightedCoord, highlightKey }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [boardBouncePhase, setBoardBouncePhase] = useState<'idle' | 'bouncing'>('idle');
  const [meepleFocusPhase, setMeepleFocusPhase] = useState<'idle' | 'entering' | 'active' | 'exiting'>('idle');
  const [meepleFocusViewportCenter, setMeepleFocusViewportCenter] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boardBounceTimerRef = useRef<number | null>(null);
  const meepleFocusTimerRef = useRef<number | null>(null);
  const wasMeepleFocusedRef = useRef(false);
  const previousPlacedTileIdRef = useRef<string | null>(null);
  const currentPlayer = state.players[state.currentPlayerIndex];

  const placedTiles = useMemo(() => [...state.board.tiles.values()], [state.board.tiles, state.version]);

  const candidates = useMemo(
    () => state.phase === 'PLACING_TILE' && state.pendingTile ? candidatePlacements(state.board) : [],
    [state.board, state.phase, state.pendingTile, state.version],
  );

  const meepleTargets = state.phase === 'PLACING_MEEPLE'
    ? controller.getMeepleTargetsForLastTile()
    : [];

  const targetFeatureIds = useMemo(() => {
    const map = new Map<number, string>();
    for (const ref of meepleTargets) {
      const fid = state.board.registry.segmentToFeature.get(segmentKey(ref));
      if (fid) map.set(ref.localId, fid);
    }
    return map;
  }, [meepleTargets, state.board.registry, state.version]);

  const featureHighlightByTile = useMemo(() => {
    if (!hoveredFeatureId) return new Map<string, number[]>();
    const feature = state.board.registry.features.get(hoveredFeatureId);
    if (!feature) return new Map<string, number[]>();
    const byTile = new Map<string, number[]>();
    for (const key of feature.segments) {
      const { tileId, localId } = parseSegmentKey(key);
      const arr = byTile.get(tileId) ?? [];
      arr.push(localId);
      byTile.set(tileId, arr);
    }
    return byTile;
  }, [hoveredFeatureId, state.board.registry, state.version]);

  const lastPlacedTile = useMemo(
    () => placedTiles.find(tile => tile.tileId === state.lastPlacedTileId) ?? null,
    [placedTiles, state.lastPlacedTileId],
  );

  useEffect(() => {
    const currentTileId = state.lastPlacedTileId;
    const previousTileId = previousPlacedTileIdRef.current;
    previousPlacedTileIdRef.current = currentTileId;

    if (!currentTileId || currentTileId === previousTileId) return;

    if (boardBounceTimerRef.current !== null) {
      window.clearTimeout(boardBounceTimerRef.current);
      boardBounceTimerRef.current = null;
    }

    setBoardBouncePhase('bouncing');
    playTilePlacementSound();
    boardBounceTimerRef.current = window.setTimeout(() => {
      setBoardBouncePhase('idle');
      boardBounceTimerRef.current = null;
    }, 220);

    return () => {
      if (boardBounceTimerRef.current !== null) {
        window.clearTimeout(boardBounceTimerRef.current);
        boardBounceTimerRef.current = null;
      }
    };
  }, [state.lastPlacedTileId]);

  // Must be memoized: this object is passed to useBoardTransform, whose effect
  // depends on its reference. A fresh object literal every render would make
  // that effect re-run (and call setTransform) on every render, producing an
  // infinite update loop ("Maximum update depth exceeded") during meeple focus.
  const meepleHasFocusTarget = lastPlacedTile !== null && meepleTargets.length > 0;
  const focusViewportX = meepleFocusViewportCenter?.x;
  const focusViewportY = meepleFocusViewportCenter?.y;
  const meepleFocusTarget = useMemo(
    () => meepleHasFocusTarget && lastPlacedTile
      ? {
          x: (lastPlacedTile.coord.x + COORD_OFFSET + 0.5) * TILE_SIZE,
          y: (lastPlacedTile.coord.y + COORD_OFFSET + 0.5) * TILE_SIZE,
          scale: 1.8,
          viewportX: focusViewportX,
          viewportY: focusViewportY,
        }
      : null,
    [meepleHasFocusTarget, lastPlacedTile, focusViewportX, focusViewportY],
  );

  const meepleFocusKey = state.lastPlacedTileId && meepleTargets.length > 0
    ? `focus-${state.lastPlacedTileId}`
    : 'idle';

  const { transform, isPanning, onMouseDown, onMouseMove, stopPan } = useBoardTransform(
    containerRef,
    CENTER_X,
    CENTER_Y,
    meepleFocusTarget,
  );

  const hasMeepleFocus = meepleFocusTarget !== null;

  useEffect(() => {
    if (meepleFocusTimerRef.current !== null) {
      window.clearTimeout(meepleFocusTimerRef.current);
      meepleFocusTimerRef.current = null;
    }

    if (hasMeepleFocus) {
      wasMeepleFocusedRef.current = true;
      setMeepleFocusPhase('entering');
      meepleFocusTimerRef.current = window.setTimeout(() => setMeepleFocusPhase('active'), MEEPLE_FOCUS_ANIMATION_MS);
    } else if (wasMeepleFocusedRef.current) {
      wasMeepleFocusedRef.current = false;
      setMeepleFocusPhase('exiting');
      meepleFocusTimerRef.current = window.setTimeout(() => setMeepleFocusPhase('idle'), MEEPLE_FOCUS_ANIMATION_MS);
    }

    return () => {
      if (meepleFocusTimerRef.current !== null) {
        window.clearTimeout(meepleFocusTimerRef.current);
        meepleFocusTimerRef.current = null;
      }
    };
  }, [meepleFocusKey, hasMeepleFocus]);

  useEffect(() => {
    if (meepleFocusPhase === 'idle') {
      setMeepleFocusViewportCenter(null);
      return;
    }

    const updateViewportCenter = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMeepleFocusViewportCenter({
        x: window.innerWidth / 2 - rect.left,
        y: window.innerHeight / 2 - rect.top,
      });
    };

    updateViewportCenter();

    const observer = new ResizeObserver(updateViewportCenter);
    const el = containerRef.current;
    if (el) observer.observe(el);
    window.addEventListener('resize', updateViewportCenter);
    window.addEventListener('scroll', updateViewportCenter, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateViewportCenter);
      window.removeEventListener('scroll', updateViewportCenter, true);
    };
  }, [meepleFocusPhase]);

  // The focus highlight is rendered INSIDE the board canvas in canvas-pixel
  // coordinates, so it inherits the exact same transform AND transition as the
  // tiles. This keeps the ring/spotlight locked to the focused tile during the
  // zoom animation (positioning it in screen space made it snap to the final
  // location while the canvas was still easing, leaving the overlay detached).
  const showMeepleFocus = meepleFocusPhase !== 'idle' && lastPlacedTile !== null;
  const focusTileLeft = lastPlacedTile ? (lastPlacedTile.coord.x + COORD_OFFSET) * TILE_SIZE : 0;
  const focusTileTop = lastPlacedTile ? (lastPlacedTile.coord.y + COORD_OFFSET) * TILE_SIZE : 0;
  const focusSpotlightSize = TILE_SIZE * 2.7;
  const boardBounceOffset = boardBouncePhase === 'bouncing' ? '-2px' : '0px';

  if (placedTiles.length === 0) return <div className="board-scroll" ref={containerRef} />;

  return (
    <div
      className="board-scroll"
      ref={containerRef}
      data-meeple-focus={showMeepleFocus ? 'true' : undefined}
      data-meeple-focus-phase={meepleFocusPhase}
      style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      <CoordRulers transform={transform} />
      <div
        className="board-stage"
        style={{
          transform: `translateY(${boardBounceOffset})`,
          transition: 'transform 240ms cubic-bezier(0.2, 0.85, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="board-canvas"
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: showMeepleFocus ? 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
          }}
        >
          {placedTiles.map(tile => {
            const isLastPlaced = tile.tileId === state.lastPlacedTileId;
            const targets = isLastPlaced ? meepleTargets : [];
            const isHighlighted = highlightedCoord != null
              && tile.coord.x === highlightedCoord.x
              && tile.coord.y === highlightedCoord.y;
            return (
              <div
                key={tile.tileId}
                data-testid={`placed-tile-${tile.coord.x},${tile.coord.y}`}
                style={{
                  position: 'absolute',
                  left: (tile.coord.x + COORD_OFFSET) * TILE_SIZE,
                  top: (tile.coord.y + COORD_OFFSET) * TILE_SIZE,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                }}
              >
                {isHighlighted && (
                  <div
                    key={highlightKey}
                    className="tile-history-highlight"
                    style={{ position: 'absolute', inset: -4, borderRadius: 10, zIndex: 10, pointerEvents: 'none' }}
                  />
                )}
                <TileView
                  placed={tile}
                  registry={state.board.registry}
                  players={state.players}
                  size={TILE_SIZE}
                  targets={isAiTurn ? [] : targets}
                  currentPlayerColor={currentPlayer.color}
                  onPlace={ref => controller.placeMeeple(ref)}
                  featureHighlightIds={featureHighlightByTile.get(tile.tileId) ?? []}
                  targetFeatureIds={isLastPlaced ? targetFeatureIds : undefined}
                  onHoverFeature={isLastPlaced ? setHoveredFeatureId : undefined}
                />
              </div>
            );
          })}

          {state.phase === 'PLACING_TILE' && state.pendingTile && !isAiTurn && candidates.map(coord => {
            const key = `${coord.x},${coord.y}`;
            const preview = controller.previewPlacement(coord, state.pendingRotation);
            const isHovered = hovered === key;
            const imgSrc = isHovered ? (tileImageMap[state.pendingTile!.id] ?? '') : undefined;
            return (
              <div
                key={key}
                style={{
                  position: 'absolute',
                  left: (coord.x + COORD_OFFSET) * TILE_SIZE,
                  top: (coord.y + COORD_OFFSET) * TILE_SIZE,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                }}
              >
                <GhostTile
                  size={TILE_SIZE}
                  legal={preview.legal}
                  onClick={() => preview.legal && controller.placeTile(coord)}
                  onHover={() => setHovered(key)}
                  onLeave={() => setHovered(null)}
                  imageSrc={imgSrc}
                  rotation={state.pendingRotation}
                />
              </div>
            );
          })}

          {showMeepleFocus && (
            <div className="meeple-focus-overlay" data-state={meepleFocusPhase} aria-hidden="true">
              <div
                className="meeple-focus-spotlight"
                style={{
                  left: focusTileLeft + TILE_SIZE / 2 - focusSpotlightSize / 2,
                  top: focusTileTop + TILE_SIZE / 2 - focusSpotlightSize / 2,
                  width: focusSpotlightSize,
                  height: focusSpotlightSize,
                }}
              />
              <div
                className="meeple-focus-ring"
                style={{
                  left: focusTileLeft - 5,
                  top: focusTileTop - 5,
                  width: TILE_SIZE + 10,
                  height: TILE_SIZE + 10,
                }}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
