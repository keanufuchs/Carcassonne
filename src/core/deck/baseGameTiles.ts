import type { TilePrototype } from '../types/tile';

import { TILE_A } from './tiles/tile-A';
import { TILE_B } from './tiles/tile-B';
import { TILE_C } from './tiles/tile-C';
import { TILE_D } from './tiles/tile-D';
import { TILE_E } from './tiles/tile-E';
import { TILE_F } from './tiles/tile-F';
import { TILE_G } from './tiles/tile-G';
import { TILE_H } from './tiles/tile-H';
import { TILE_I } from './tiles/tile-I';
import { TILE_J } from './tiles/tile-J';
import { TILE_K } from './tiles/tile-K';
import { TILE_L } from './tiles/tile-L';
import { TILE_M } from './tiles/tile-M';
import { TILE_N } from './tiles/tile-N';
import { TILE_O } from './tiles/tile-O';
import { TILE_P } from './tiles/tile-P';
import { TILE_Q } from './tiles/tile-Q';
import { TILE_R } from './tiles/tile-R';
import { TILE_S } from './tiles/tile-S';
import { TILE_T } from './tiles/tile-T';
import { TILE_U } from './tiles/tile-U';
import { TILE_V } from './tiles/tile-V';
import { TILE_W } from './tiles/tile-W';
import { TILE_X } from './tiles/tile-X';

export interface TileEntry {
  prototype: TilePrototype;
  count: number;
}

// 72 draw tiles — does not include the start tile.
export const BASE_GAME_DISTRIBUTION: TileEntry[] = [
  { prototype: TILE_A, count: 2 },
  { prototype: TILE_B, count: 4 },
  { prototype: TILE_C, count: 1 },
  { prototype: TILE_D, count: 4 },
  { prototype: TILE_E, count: 5 },
  { prototype: TILE_F, count: 2 },
  { prototype: TILE_G, count: 1 },
  { prototype: TILE_H, count: 3 },
  { prototype: TILE_I, count: 2 },
  { prototype: TILE_J, count: 3 },
  { prototype: TILE_K, count: 3 },
  { prototype: TILE_L, count: 3 },
  { prototype: TILE_M, count: 2 },
  { prototype: TILE_N, count: 3 },
  { prototype: TILE_O, count: 2 },
  { prototype: TILE_P, count: 3 },
  { prototype: TILE_Q, count: 1 },
  { prototype: TILE_R, count: 3 },
  { prototype: TILE_S, count: 2 },
  { prototype: TILE_T, count: 1 },
  { prototype: TILE_U, count: 8 },
  { prototype: TILE_V, count: 9 },
  { prototype: TILE_W, count: 4 },
  { prototype: TILE_X, count: 1 },
];

// The start tile is placed face-up before the draw pile is assembled.
export const START_TILE: TilePrototype = TILE_D;

export function buildRemainingTiles(): TilePrototype[] {
  const tiles: TilePrototype[] = [];
  for (const { prototype, count } of BASE_GAME_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      tiles.push(prototype);
    }
  }
  return tiles;
}
