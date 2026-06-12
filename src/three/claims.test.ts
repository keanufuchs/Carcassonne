import { describe, it, expect } from 'vitest';
import { nextClaims, type ClaimMap } from './claims';

const empty: ClaimMap = new Map();

describe('nextClaims', () => {
  it('claims an unclaimed feature for the active player', () => {
    const next = nextClaims(empty, { localId: 2, kind: 'CITY' }, 0);
    expect(next.get(2)).toEqual({ localId: 2, kind: 'CITY', playerIndex: 0 });
  });

  it('removes the claim when the active player clicks their own feature', () => {
    const owned = nextClaims(empty, { localId: 2, kind: 'CITY' }, 0);
    const next = nextClaims(owned, { localId: 2, kind: 'CITY' }, 0);
    expect(next.has(2)).toBe(false);
  });

  it('reassigns to the active player when another player owns it', () => {
    const owned = nextClaims(empty, { localId: 2, kind: 'CITY' }, 0);
    const next = nextClaims(owned, { localId: 2, kind: 'CITY' }, 3);
    expect(next.get(2)).toEqual({ localId: 2, kind: 'CITY', playerIndex: 3 });
  });

  it('supports multiple simultaneous claims on one tile', () => {
    let claims = nextClaims(empty, { localId: 1, kind: 'ROAD' }, 0);
    claims = nextClaims(claims, { localId: 2, kind: 'FIELD' }, 1);
    expect(claims.size).toBe(2);
    expect(claims.get(1)?.kind).toBe('ROAD');
    expect(claims.get(2)?.playerIndex).toBe(1);
  });

  it('does not mutate the input map', () => {
    const next = nextClaims(empty, { localId: 5, kind: 'MONASTERY' }, 2);
    expect(empty.size).toBe(0);
    expect(next.size).toBe(1);
  });
});
