import type { TilePrototype } from '../../core/types/tile';
import type { Rotation } from '../../core/types';
import type { GameController } from '../../controller/GameController';
import tileDistribution from '../../core/deck/tileDistribution.json';

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

const btnStyle: React.CSSProperties = {
  background: '#333', color: '#eee',
  border: '1px solid #555', borderRadius: 4,
  padding: '4px 14px', cursor: 'pointer', fontSize: 20,
  lineHeight: 1,
};

interface Props {
  tile: TilePrototype | null;
  rotation: Rotation;
  controller: GameController;
  canDraw: boolean;
  deckSize: number;
}

export function TilePreview({ tile, rotation, controller, canDraw, deckSize }: Props) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ color: '#777', fontSize: 11 }}>Deck: {deckSize} remaining</div>
      {tile ? (
        <>
          <div style={{ width: 80, height: 80, position: 'relative', border: '2px solid #555', borderRadius: 2 }}>
            <img
              data-testid="tile-preview-img"
              data-rotation={rotation}
              src={tileImageMap[tile.id] ?? ''}
              alt={tile.id}
              style={{ width: 80, height: 80, transform: `rotate(${rotation}deg)`, display: 'block' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button data-testid="rotate-ccw-btn" onClick={() => controller.rotatePending('CCW')} style={btnStyle} title="Rotate CCW">↺</button>
            <button data-testid="rotate-cw-btn"  onClick={() => controller.rotatePending('CW')}  style={btnStyle} title="Rotate CW">↻</button>
          </div>
        </>
      ) : canDraw ? (
        <button
          data-testid="draw-tile-btn"
          onClick={() => controller.drawTile()}
          style={{ background: '#3a5a8a', color: '#eee', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Draw Tile
        </button>
      ) : null}
    </div>
  );
}
