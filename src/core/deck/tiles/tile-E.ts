import type { TilePrototype } from '../../types/tile';

export const TILE_E: TilePrototype = {
  id: 'TILE-E',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    S: ['FIELD', 'FIELD', 'FIELD'],
    W: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'CITY',  edgeSlots: [{ side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' }] },
    {
      localId: 1, kind: 'FIELD', edgeSlots: [
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
        { side: 'S', pos: 'L' }, { side: 'S', pos: 'C' }, { side: 'S', pos: 'R' },
        { side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' },
      ],
    },
  ],
  hasMonastery: false,
  hasShield: false,
};
