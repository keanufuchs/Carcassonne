import type { TilePrototype } from '../../types/tile';

export const TILE_A: TilePrototype = {
  id: 'TILE-A',
  edges: {
    N: ['FIELD', 'FIELD', 'FIELD'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    S: ['FIELD', 'ROAD',  'FIELD'],
    W: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'MONASTERY', edgeSlots: [] },
    { localId: 1, kind: 'ROAD', edgeSlots: [{ side: 'S', pos: 'C' }] },
    {
      localId: 2, kind: 'FIELD', edgeSlots: [
        { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
        { side: 'S', pos: 'L' }, { side: 'S', pos: 'R' },
        { side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' },
      ],
    },
  ],
  hasMonastery: true,
  hasShield: false,
};
