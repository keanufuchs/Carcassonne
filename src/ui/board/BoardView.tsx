import { useState, useMemo, useRef } from 'react';
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

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

interface Props {
  state: GameState;
  controller: GameController;
}

export function BoardView({ state, controller }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Pixel center of start tile (0,0) in the board grid — used for initial centering only
  const centerX = -minX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = -minY * TILE_SIZE + TILE_SIZE / 2;

  const { transform, isPanning, onMouseDown, onMouseMove, stopPan } = useBoardTransform(containerRef, centerX, centerY);

  if (allCoords.length === 0) return <div className="board-scroll" ref={containerRef} />;

  return (
    <div
      className="board-scroll"
      ref={containerRef}
      style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
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
  );
}
