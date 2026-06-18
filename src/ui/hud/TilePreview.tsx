import { useEffect, useState } from 'react';
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
  canRotate?: boolean;
}

export function TilePreview({ tile, rotation, controller, deckSize, canInteract = true, canRotate = true }: Props) {
  // Mirror the A/D keyboard shortcuts with a visual "pressed" state on the
  // matching button. Purely cosmetic — the actual rotation is handled in App.
  const [pressed, setPressed] = useState<'CCW' | 'CW' | null>(null);

  useEffect(() => {
    if (!canInteract || !canRotate || !tile) return;

    function dirFor(event: KeyboardEvent): 'CCW' | 'CW' | null {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return null;
      const key = event.key.toLowerCase();
      if (key === 'a') return 'CCW';
      if (key === 'd') return 'CW';
      return null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      const dir = dirFor(event);
      if (dir) setPressed(dir);
    }
    function onKeyUp(event: KeyboardEvent) {
      const dir = dirFor(event);
      if (dir) setPressed((prev) => (prev === dir ? null : prev));
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canInteract, canRotate, tile]);

  // When it's the opponent's turn we hide the tile and rotation controls and
  // show a waiting indicator instead — there is nothing for the local player
  // to interact with.
  if (!canInteract) {
    return (
      <div className="hud-pad tile-preview opponent-turn" data-testid="opponent-turn">
        <div className="deck-pill">{deckSize} tiles in deck</div>
        <div className="opponent-waiting">
          <span className="opponent-waiting-label">Der Gegner ist dran</span>
          <span className="loading-dots" aria-hidden="true">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </span>
        </div>
      </div>
    );
  }

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
            <button data-testid="rotate-ccw-btn" className={`rotate-btn${pressed === 'CCW' ? ' pressed' : ''}`} disabled={!canInteract || !canRotate} onClick={() => controller.rotatePending('CCW')} title="Rotate counter-clockwise (A)">
              <span className="rotate-key">A</span>
              <span className="rotate-arrow">↺</span>
            </button>
            <button data-testid="rotate-cw-btn"  className={`rotate-btn${pressed === 'CW' ? ' pressed' : ''}`} disabled={!canInteract || !canRotate} onClick={() => controller.rotatePending('CW')}  title="Rotate clockwise (D)">
              <span className="rotate-key">D</span>
              <span className="rotate-arrow">↻</span>
            </button>
          </div>
        </>
      ) : (
        <div className="tile-frame empty" />
      )}
    </div>
  );
}
