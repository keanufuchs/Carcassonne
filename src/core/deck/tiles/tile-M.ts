import type { TilePrototype } from '../../types/tile';

export const TILE_M: TilePrototype = {
  id: 'TILE-M',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['CITY',  'CITY',  'CITY'],
    S: ['FIELD', 'FIELD', 'FIELD'],
    W: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    {
      localId: 0, kind: 'CITY', isShielded: true, edgeSlots: [
        { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
      ],
    },
    {
      localId: 1, kind: 'FIELD', edgeSlots: [
        { side: 'S', pos: 'L' }, { side: 'S', pos: 'C' }, { side: 'S', pos: 'R' },
        { side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' },
      ],
    },
  ],
  hasMonastery: false,
  hasShield: true,
};
