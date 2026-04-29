import { useState, useMemo } from 'react';
import type { GameState } from '../../core/game/GameState';
import type { GameController } from '../../controller/GameController';
import { TileView } from './TileView';
import { GhostTile } from './GhostTile';
import { candidatePlacements } from '../../core/board/Board';
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

function meepleTargetPos(i: number, total: number): { top: string; left: string } {
  const angle = total === 1 ? -Math.PI / 2 : (i / total) * 2 * Math.PI - Math.PI / 2;
  const r = total === 1 ? 0 : 22;
  return {
    top: `${50 + r * Math.sin(angle)}%`,
    left: `${50 + r * Math.cos(angle)}%`,
  };
}

export function BoardView({ state, controller }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
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

  const allCoords = [...placedTiles.map(t => t.coord), ...candidates];
  if (allCoords.length === 0) return <div className="board-scroll" />;

  const minX = Math.min(...allCoords.map(c => c.x)) - 1;
  const maxX = Math.max(...allCoords.map(c => c.x)) + 1;
  const minY = Math.min(...allCoords.map(c => c.y)) - 1;
  const maxY = Math.max(...allCoords.map(c => c.y)) + 1;
  const cols  = maxX - minX + 1;
  const rows  = maxY - minY + 1;

  const col = (x: number) => x - minX + 1;
  const row = (y: number) => y - minY + 1;

  return (
    <div className="board-scroll">
      <div
        className="board-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`,
          width: cols * TILE_SIZE,
          height: rows * TILE_SIZE,
        }}
      >
        {placedTiles.map(tile => {
          const targets = meepleTargets.filter(r => r.tileId === tile.tileId);
          return (
            <div
              key={tile.tileId}
              data-testid="placed-tile"
              style={{ gridColumn: col(tile.coord.x), gridRow: row(tile.coord.y), position: 'relative' }}
            >
              <TileView placed={tile} registry={state.board.registry} players={state.players} size={TILE_SIZE} />
              {targets.map((ref, i) => {
                const pos = meepleTargetPos(i, targets.length);
                return (
                  <div
                    key={ref.localId}
                    data-testid="meeple-target"
                    onClick={() => controller.placeMeeple(ref)}
                    style={{
                      position: 'absolute',
                      top: pos.top, left: pos.left,
                      transform: 'translate(-50%, -50%)',
                      width: 26, height: 26,
                      borderRadius: '50%',
                      background: `${currentPlayer.color}cc`,
                      border: '2px solid gold',
                      cursor: 'pointer',
                      zIndex: 5,
                      boxShadow: '0 0 8px rgba(255,215,0,0.5)',
                    }}
                    title="Place meeple here"
                  />
                );
              })}
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
