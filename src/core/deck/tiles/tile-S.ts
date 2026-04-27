import type { TilePrototype } from '../../types/tile';

export const TILE_S: TilePrototype = {
  id: 'TILE-S',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['CITY',  'CITY',  'CITY'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['CITY',  'CITY',  'CITY'],
  },
  segments: [
    {
      localId: 0, kind: 'CITY', isShielded: true, edgeSlots: [
        { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
        { side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' },
      ],
    },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'S', pos: 'C' }] },
    { localId: 2, kind: 'FIELD', edgeSlots: [{ side: 'S', pos: 'L' }, { side: 'S', pos: 'R' }] },
  ],
  hasMonastery: false,
  hasShield: true,
};
