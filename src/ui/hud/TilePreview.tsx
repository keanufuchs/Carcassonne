import type { TilePrototype } from '../../core/types/tile';
import type { Rotation } from '../../core/types';
import type { GameController } from '../../controller/GameController';
import tileDistribution from '../../core/deck/tileDistribution.json';

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

interface Props {
  tile: TilePrototype | null;
  rotation: Rotation;
  controller: GameController;
  deckSize: number;
}

export function TilePreview({ tile, rotation, controller, deckSize }: Props) {
  return (
    <div className="hud-pad tile-preview">
      <div className="deck-pill">{deckSize} tiles in deck</div>
      {tile ? (
        <>
          <div className="tile-frame">
            <img
              data-testid="tile-preview-img"
              data-rotation={rotation}
              draggable={false}
              src={tileImageMap[tile.id] ?? ''}
              alt={tile.id}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
          <div className="rotate-row">
            <button data-testid="rotate-ccw-btn" className="rotate-btn" onClick={() => controller.rotatePending('CCW')} title="Rotate counter-clockwise (A)">↺</button>
            <button data-testid="rotate-cw-btn"  className="rotate-btn" onClick={() => controller.rotatePending('CW')}  title="Rotate clockwise (D)">↻</button>
          </div>
        </>
      ) : (
        <div className="tile-frame empty" />
      )}
    </div>
  );
}
