import { useState, useMemo, useRef, useEffect } from 'react';
import type { GameState } from '../../core/game/GameState';
import type { GameController } from '../../controller/GameController';
import { TileView } from './TileView';
import { GhostTile } from './GhostTile';
import { candidatePlacements } from '../../core/board/Board';
import { segmentKey, parseSegmentKey } from '../../core/types';
import { useBoardTransform } from '../hooks/useBoardTransform';
import tileDistribution from '../../core/deck/tileDistribution.json';
import './board.css';

const TILE_SIZE = 80;
const MEEPLE_FOCUS_ANIMATION_MS = 260;

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

// Shared AudioContext singleton — lazily created on first placement to avoid limit exceeded errors
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
}

export function BoardView({ state, controller }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [boardBouncePhase, setBoardBouncePhase] = useState<'idle' | 'bouncing'>('idle');
  const [meepleFocusPhase, setMeepleFocusPhase] = useState<'idle' | 'entering' | 'active' | 'exiting'>('idle');
  const [meepleFocusSnapshot, setMeepleFocusSnapshot] = useState<{
    centerX: number;
    centerY: number;
    scale: number;
  } | null>(null);
  const [meepleFocusViewportCenter, setMeepleFocusViewportCenter] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boardBounceTimerRef = useRef<number | null>(null);
  const meepleFocusTimerRef = useRef<number | null>(null);
  const previousPlacedTileIdRef = useRef<string | null>(null);
  const currentPlayer = state.players[state.currentPlayerIndex];

  // state.board.tiles is mutated in place; state.version busts the memo cache correctly.
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

  const allCoords = [...placedTiles.map(t => t.coord), ...candidates];

  // Bounding box — safe defaults for empty board (should not occur in practice)
  const minX = allCoords.length > 0 ? Math.min(...allCoords.map(c => c.x)) - 1 : -1;
  const maxX = allCoords.length > 0 ? Math.max(...allCoords.map(c => c.x)) + 1 : 1;
  const minY = allCoords.length > 0 ? Math.min(...allCoords.map(c => c.y)) - 1 : -1;
  const maxY = allCoords.length > 0 ? Math.max(...allCoords.map(c => c.y)) + 1 : 1;
  const cols  = maxX - minX + 1;
  const rows  = maxY - minY + 1;

  const col = (x: number) => x - minX + 1;
  const row = (y: number) => y - minY + 1;

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

  const meepleFocusTarget = lastPlacedTile && meepleTargets.length > 0
    ? {
        x: (lastPlacedTile.coord.x - minX + 0.5) * TILE_SIZE,
        y: (lastPlacedTile.coord.y - minY + 0.5) * TILE_SIZE,
        scale: 1.8,
        viewportX: meepleFocusViewportCenter?.x,
        viewportY: meepleFocusViewportCenter?.y,
      }
    : null;
  // Key animation phase only on focus identity (lastPlacedTileId), not viewport coordinates.
  // Viewport coords are computed synchronously in the effect below to avoid feedback loops.
  const meepleFocusKey = state.lastPlacedTileId && meepleTargets.length > 0
    ? `focus-${state.lastPlacedTileId}`
    : 'idle';

  // Pixel center of start tile (0,0) in the board grid — used for initial centering only
  const centerX = -minX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = -minY * TILE_SIZE + TILE_SIZE / 2;

  const { transform, isPanning, onMouseDown, onMouseMove, stopPan } = useBoardTransform(
    containerRef,
    centerX,
    centerY,
    meepleFocusTarget,
  );

  const hasMeepleFocus = meepleFocusTarget !== null;

  useEffect(() => {
    if (meepleFocusTimerRef.current !== null) {
      window.clearTimeout(meepleFocusTimerRef.current);
      meepleFocusTimerRef.current = null;
    }

    if (hasMeepleFocus && meepleFocusTarget) {
      setMeepleFocusSnapshot({
        centerX: meepleFocusTarget.x,
        centerY: meepleFocusTarget.y,
        scale: meepleFocusTarget.scale ?? 1.75,
      });
      setMeepleFocusPhase('entering');
      meepleFocusTimerRef.current = window.setTimeout(() => setMeepleFocusPhase('active'), MEEPLE_FOCUS_ANIMATION_MS);
    } else if (meepleFocusSnapshot) {
      setMeepleFocusPhase('exiting');
      meepleFocusTimerRef.current = window.setTimeout(() => {
        setMeepleFocusPhase('idle');
        setMeepleFocusSnapshot(null);
      }, MEEPLE_FOCUS_ANIMATION_MS);
    }

    return () => {
      if (meepleFocusTimerRef.current !== null) {
        window.clearTimeout(meepleFocusTimerRef.current);
        meepleFocusTimerRef.current = null;
      }
    };
  }, [meepleFocusKey, meepleFocusTarget, meepleFocusSnapshot, hasMeepleFocus];

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

  const showMeepleFocus = meepleFocusPhase !== 'idle' && meepleFocusSnapshot !== null;
  const focusCenterX = meepleFocusSnapshot
    ? transform.offsetX + (meepleFocusSnapshot.centerX * transform.scale)
    : 0;
  const focusCenterY = meepleFocusSnapshot
    ? transform.offsetY + (meepleFocusSnapshot.centerY * transform.scale)
    : 0;
  const focusTileSize = TILE_SIZE * transform.scale;
  const boardBounceOffset = boardBouncePhase === 'bouncing' ? '-2px' : '0px';

  if (allCoords.length === 0) return <div className="board-scroll" ref={containerRef} />;

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
      <div
        className="board-stage"
        style={{
          transform: `translateY(${boardBounceOffset})`,
          transition: 'transform 240ms cubic-bezier(0.2, 0.85, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="board-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
            gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`,
            width: cols * TILE_SIZE,
            height: rows * TILE_SIZE,
            transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: showMeepleFocus ? 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
          }}
        >
          {placedTiles.map(tile => {
            const isLastPlaced = tile.tileId === state.lastPlacedTileId;
            const targets = isLastPlaced ? meepleTargets : [];
            return (
              <div
                key={tile.tileId}
                data-testid={`placed-tile-${tile.coord.x},${tile.coord.y}`}
                style={{ gridColumn: col(tile.coord.x), gridRow: row(tile.coord.y), position: 'relative' }}
              >
                <TileView
                  placed={tile}
                  registry={state.board.registry}
                  players={state.players}
                  size={TILE_SIZE}
                  targets={targets}
                  currentPlayerColor={currentPlayer.color}
                  onPlace={ref => controller.placeMeeple(ref)}
                  featureHighlightIds={featureHighlightByTile.get(tile.tileId) ?? []}
                  targetFeatureIds={isLastPlaced ? targetFeatureIds : undefined}
                  onHoverFeature={isLastPlaced ? setHoveredFeatureId : undefined}
                />
              </div>
            );
          })}

          {state.phase === 'PLACING_TILE' && state.pendingTile && candidates.map(coord => {
            const key = `${coord.x},${coord.y}`;
            const preview = controller.previewPlacement(coord, state.pendingRotation);
            const isHovered = hovered === key;
            const imgSrc = isHovered ? (tileImageMap[state.pendingTile!.id] ?? '') : undefined;
            return (
              <div key={key} style={{ gridColumn: col(coord.x), gridRow: row(coord.y) }}>
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
        </div>
      </div>

      {showMeepleFocus && (
        <div className="meeple-focus-overlay" data-state={meepleFocusPhase} aria-hidden="true">
          <div
            className="meeple-focus-spotlight"
            style={{
              left: focusCenterX - focusTileSize * 1.35,
              top: focusCenterY - focusTileSize * 1.35,
              width: focusTileSize * 2.7,
              height: focusTileSize * 2.7,
            }}
          />
          <div
            className="meeple-focus-ring"
            style={{
              left: focusCenterX - focusTileSize / 2 - 6,
              top: focusCenterY - focusTileSize / 2 - 6,
              width: focusTileSize + 12,
              height: focusTileSize + 12,
            }}
          />
        </div>
      )}
    </div>
  );
}
