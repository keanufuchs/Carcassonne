import type { TilePrototype } from '../../types/tile';

export const TILE_J: TilePrototype = {
  id: 'TILE-J',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'CITY',  edgeSlots: [{ side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' }] },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'W', pos: 'C' }, { side: 'S', pos: 'C' }] },
    {
      localId: 2, kind: 'FIELD', edgeSlots: [
        { side: 'W', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
        { side: 'S', pos: 'L' },
      ],
    },
    { localId: 3, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'L' }, { side: 'S', pos: 'R' }] },
  ],
  hasMonastery: false,
  hasShield: false,
};
