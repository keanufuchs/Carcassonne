import type { TilePrototype } from '../../types/tile';

export const TILE_V: TilePrototype = {
  id: 'TILE-V',
  edges: {
    N: ['FIELD', 'FIELD', 'FIELD'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'ROAD',  'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'ROAD',  edgeSlots: [{ side: 'W', pos: 'C' }, { side: 'S', pos: 'C' }] },
    {
      localId: 1, kind: 'FIELD', edgeSlots: [
        { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
        { side: 'W', pos: 'R' },
        { side: 'S', pos: 'L' },
      ],
    },
    { localId: 2, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'L' }, { side: 'S', pos: 'R' }] },
  ],
  hasMonastery: false,
  hasShield: false,
};
