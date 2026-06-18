import type { TilePrototype } from '../../core/types/tile';
import type { Rotation } from '../../core/types';
import type { GameController } from '../../controller/GameController';
import { TilePreview3D } from './TilePreview3D';

interface Props {
  tile: TilePrototype | null;
  rotation: Rotation;
  controller: GameController;
  deckSize: number;
  canInteract?: boolean;
}

export function TilePreview({ tile, rotation, controller, deckSize, canInteract = true }: Props) {
  return (
    <div className="hud-pad tile-preview">
      <div className="deck-pill">{deckSize} tiles in deck</div>
      {tile ? (
        <>
          <div
            className="tile-frame"
            data-testid="tile-preview-img"
            data-rotation={rotation}
          >
            <TilePreview3D proto={tile} rotation={rotation} />
          </div>
          <div className="rotate-row">
            <button data-testid="rotate-ccw-btn" className="rotate-btn" disabled={!canInteract} onClick={() => controller.rotatePending('CCW')} title="Rotate counter-clockwise (A)">↺</button>
            <button data-testid="rotate-cw-btn"  className="rotate-btn" disabled={!canInteract} onClick={() => controller.rotatePending('CW')}  title="Rotate clockwise (D)">↻</button>
          </div>
        </>
      ) : (
        <div className="tile-frame empty" />
      )}
    </div>
  );
}
