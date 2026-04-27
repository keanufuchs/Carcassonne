import type { TilePrototype } from '../../types/tile';

export const TILE_F: TilePrototype = {
  id: 'TILE-F',
  edges: {
    N: ['FIELD', 'FIELD', 'FIELD'],
    E: ['CITY',  'CITY',  'CITY'],
    S: ['FIELD', 'FIELD', 'FIELD'],
    W: ['CITY',  'CITY',  'CITY'],
  },
  segments: [
    {
      localId: 0, kind: 'CITY', isShielded: true, edgeSlots: [
        { side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
      ],
    },
    { localId: 1, kind: 'FIELD', edgeSlots: [{ side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' }] },
    { localId: 2, kind: 'FIELD', edgeSlots: [{ side: 'S', pos: 'L' }, { side: 'S', pos: 'C' }, { side: 'S', pos: 'R' }] },
  ],
  hasMonastery: false,
  hasShield: true,
};
