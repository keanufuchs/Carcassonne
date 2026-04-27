import type { TilePrototype } from '../../types/tile';

export const TILE_L: TilePrototype = {
  id: 'TILE-L',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['FIELD', 'ROAD',  'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'CITY',  edgeSlots: [{ side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' }] },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'W', pos: 'C' }] },
    { localId: 2, kind: 'ROAD',  edgeSlots: [{ side: 'E', pos: 'C' }] },
    { localId: 3, kind: 'ROAD',  edgeSlots: [{ side: 'S', pos: 'C' }] },
    { localId: 4, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'R' }, { side: 'E', pos: 'L' }] },
    { localId: 5, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'L' }, { side: 'S', pos: 'R' }] },
    { localId: 6, kind: 'FIELD', edgeSlots: [{ side: 'E', pos: 'R' }, { side: 'S', pos: 'L' }] },
  ],
  hasMonastery: false,
  hasShield: false,
};
