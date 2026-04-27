import type { TilePrototype } from '../../types/tile';

// Straight road running N–S.
// The road splits the tile into two disconnected field areas (west and east of road).
// This split is intentional: farmer scoring treats them as separate fields.
export const TILE_U: TilePrototype = {
  id: 'TILE-U',
  edges: {
    N: ['FIELD', 'ROAD', 'FIELD'],
    E: ['FIELD', 'FIELD', 'FIELD'],
    S: ['FIELD', 'ROAD', 'FIELD'],
    W: ['FIELD', 'FIELD', 'FIELD'],
  },
  segments: [
    {
      localId: 0,
      kind: 'ROAD',
      edgeSlots: [
        { side: 'N', pos: 'C' },
        { side: 'S', pos: 'C' },
      ],
    },
    {
      // West field: N-L, W-R, W-C, W-L, S-R
      localId: 1,
      kind: 'FIELD',
      edgeSlots: [
        { side: 'N', pos: 'L' },
        { side: 'W', pos: 'R' }, { side: 'W', pos: 'C' }, { side: 'W', pos: 'L' },
        { side: 'S', pos: 'R' },
      ],
    },
    {
      // East field: N-R, E-L, E-C, E-R, S-L
      localId: 2,
      kind: 'FIELD',
      edgeSlots: [
        { side: 'N', pos: 'R' },
        { side: 'E', pos: 'L' }, { side: 'E', pos: 'C' }, { side: 'E', pos: 'R' },
        { side: 'S', pos: 'L' },
      ],
    },
  ],
  hasMonastery: false,
  hasShield: false,
};
