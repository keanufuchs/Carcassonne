import { _resetTileSeq } from '../../src/core/tile/Tile';
import { startGame, endGame } from '../../src/core/game/Game';
import { placeTileInternal } from '../../src/core/board/placement';
import type { GameState } from '../../src/core/game/GameState';
import type { TilePrototype, Rotation } from '../../src/core/types/tile';
import type { Coord } from '../../src/core/types';
import { lookupBySegment } from '../../src/core/feature/segments';
import type { Feature } from '../../src/core/feature/Feature';

export function freshGame(playerNames: string[] = ['Alice', 'Bob']): GameState {
  _resetTileSeq();
  return startGame(playerNames, () => 0.5);
}

export function place(
  state: GameState,
  proto: TilePrototype,
  coord: Coord,
  rotation: Rotation,
) {
  return placeTileInternal(state.board, proto, coord, rotation);
}

export function tileAt(state: GameState, coord: Coord) {
  return state.board.tiles.get(`${coord.x},${coord.y}`);
}

export function featureAt(state: GameState, coord: Coord, localId: number): Feature {
  const t = tileAt(state, coord);
  if (!t) throw new Error(`No tile at ${coord.x},${coord.y}`);
  const seg = t.segmentInstances[localId];
  return lookupBySegment(state.board.registry, seg.ref);
}

export function forceEndGame(state: GameState): void {
  state.deck.remaining = [];
  endGame(state);
}
