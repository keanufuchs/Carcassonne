import type { TilePrototype } from '../../types/tile';

export const TILE_W: TilePrototype = {
  id: 'TILE-W',
  edges: {
    N: ['FIELD', 'FIELD', 'FIELD'],
    E: ['FIELD', 'ROAD',  'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'ROAD',  edgeSlots: [{ side: 'W', pos: 'C' }] },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'E', pos: 'C' }] },
    { localId: 2, kind: 'ROAD',  edgeSlots: [{ side: 'S', pos: 'C' }] },
    {
      localId: 3, kind: 'FIELD', edgeSlots: [
        { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
        { side: 'W', pos: 'R' },
        { side: 'E', pos: 'L' },
      ],
    },
    { localId: 4, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'L' }, { side: 'S', pos: 'R' }] },
    { localId: 5, kind: 'FIELD', edgeSlots: [{ side: 'E', pos: 'R' }, { side: 'S', pos: 'L' }] },
  ],
  hasMonastery: false,
  hasShield: false,
};
