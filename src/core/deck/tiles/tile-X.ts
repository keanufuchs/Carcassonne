import type { TilePrototype } from '../../types/tile';

export const TILE_X: TilePrototype = {
  id: 'TILE-X',
  edges: {
    N: ['FIELD', 'ROAD',  'FIELD'],
    E: ['FIELD', 'ROAD',  'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'ROAD',  edgeSlots: [{ side: 'N', pos: 'C' }] },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'E', pos: 'C' }] },
    { localId: 2, kind: 'ROAD',  edgeSlots: [{ side: 'S', pos: 'C' }] },
    { localId: 3, kind: 'ROAD',  edgeSlots: [{ side: 'W', pos: 'C' }] },
    { localId: 4, kind: 'FIELD', edgeSlots: [{ side: 'N', pos: 'L' }, { side: 'W', pos: 'R' }] },
    { localId: 5, kind: 'FIELD', edgeSlots: [{ side: 'N', pos: 'R' }, { side: 'E', pos: 'L' }] },
    { localId: 6, kind: 'FIELD', edgeSlots: [{ side: 'E', pos: 'R' }, { side: 'S', pos: 'L' }] },
    { localId: 7, kind: 'FIELD', edgeSlots: [{ side: 'S', pos: 'R' }, { side: 'W', pos: 'L' }] },
  ],
  hasMonastery: false,
  hasShield: false,
};
