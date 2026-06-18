import type { GameState } from '../../core/game/GameState';
import type { TilePrototype } from '../../core/types/tile';
import type { Rotation } from '../../core/types';
import { getPrototype } from '../board/board3d';

export function getTilePreviewDisplay(state: GameState): {
  tile: TilePrototype | null;
  rotation: Rotation;
} {
  if (state.pendingTile) {
    return { tile: state.pendingTile, rotation: state.pendingRotation };
  }

  if (state.phase === 'PLACING_MEEPLE' && state.lastPlacedTileId) {
    for (const placed of state.board.tiles.values()) {
      if (placed.tileId === state.lastPlacedTileId) {
        return { tile: getPrototype(placed.prototypeId), rotation: placed.rotation };
      }
    }
  }

  return { tile: null, rotation: 0 };
}
