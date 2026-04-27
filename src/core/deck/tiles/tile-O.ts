import type { TilePrototype } from '../../types/tile';

export const TILE_O: TilePrototype = {
  id: 'TILE-O',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['FIELD', 'ROAD',  'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['CITY',  'CITY',  'CITY'],
  },
  segments: [
    {
      localId: 0, kind: 'CITY', isShielded: true, edgeSlots: [
        { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
        { side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' },
      ],
    },
    { localId: 1, kind: 'ROAD',  edgeSlots: [{ side: 'E', pos: 'C' }, { side: 'S', pos: 'C' }] },
    { localId: 2, kind: 'FIELD', edgeSlots: [{ side: 'E', pos: 'L' }, { side: 'S', pos: 'R' }] },
    { localId: 3, kind: 'FIELD', edgeSlots: [{ side: 'E', pos: 'R' }, { side: 'S', pos: 'L' }] },
  ],
  hasMonastery: false,
  hasShield: true,
};
