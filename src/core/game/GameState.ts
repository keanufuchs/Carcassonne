import type { Player, GamePhase, Rotation, FeatureId, TileId } from '../types';
import type { TilePrototype } from '../types/tile';
import type { Board } from '../board/Board';
import type { Deck } from '../deck/Deck';

export interface GameState {
  version: number;
  board: Board;
  deck: Deck;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  pendingTile: TilePrototype | null;
  pendingRotation: Rotation;
  lastPlacedTileId: TileId | null;
  lastCompletedFeatures: FeatureId[];
}
