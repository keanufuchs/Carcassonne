import type { TilePrototype } from '../../types/tile';

export const TILE_H: TilePrototype = {
  id: 'TILE-H',
  edges: {
    N: ['CITY',  'CITY',  'CITY'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    S: ['CITY',  'CITY',  'CITY'],
    W: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    { localId: 0, kind: 'CITY', edgeSlots: [
      { side: 'N', pos: 'L' }, { side: 'N', pos: 'C' }, { side: 'N', pos: 'R' },
    ]},
    { localId: 1, kind: 'CITY', edgeSlots: [
      { side: 'S', pos: 'L' }, { side: 'S', pos: 'C' }, { side: 'S', pos: 'R' },
    ]},
    { localId: 2, kind: 'FIELD', edgeSlots: [{ side: 'W', pos: 'L' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'R' }] },
    { localId: 3, kind: 'FIELD', edgeSlots: [{ side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' }] },
  ],
  hasMonastery: false,
  hasShield: false,
};
