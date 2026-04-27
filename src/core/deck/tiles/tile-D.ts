import type { TilePrototype } from '../../types/tile';

export const TILE_D: TilePrototype = {
  id: 'TILE-D',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['FIELD', 'ROAD',  'FIELD'],
    S: ['FIELD', 'FIELD', 'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'CITY',  edgeSlots: [{ side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' }] },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'W', pos: 'C' }, { side: 'E', pos: 'C' }] },
    { localId: 2, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'R' }, { side: 'E', pos: 'L' }] },
    {
      localId: 3, kind: 'FIELD', edgeSlots: [
        { side: 'W', pos: 'L' },
        { side: 'E', pos: 'R' },
        { side: 'S', pos: 'L' }, { side: 'S', pos: 'C' }, { side: 'S', pos: 'R' },
      ],
    },
  ],
  hasMonastery: false,
  hasShield: false,
};
