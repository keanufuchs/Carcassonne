import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { meeplesView } from '../../src/ai/boardAnalysis';
import { freshGame, place, featureAt } from '../helpers/fixtures';
import { TILE_E } from '../helpers/prototypes';

// TILE_E: CITY on North (localId 0, edgeSlots N/L N/C N/R), FIELD everywhere else (localId 1)

beforeEach(() => _resetTileSeq());

describe('meeplesView', () => {
  it('returns meeplesAvailable from current player', () => {
    const state = freshGame();
    state.pendingTile = TILE_E;
    const result = meeplesView(state, { x: 10, y: 10 }, 0);
    expect(result.meeplesAvailable).toBe(state.players[state.currentPlayerIndex].meeplesAvailable);
  });

  it('marks all segments claimable when tile has no neighbours', () => {
    const state = freshGame();
    state.pendingTile = TILE_E;
    const result = meeplesView(state, { x: 10, y: 10 }, 0);
    expect(result.targets.every(t => t.claimable)).toBe(true);
  });

  it('marks CITY segment not claimable when it would join a feature that already has a meeple', () => {
    const state = freshGame();
    // Place TILE_E at (0,0) rotation 0 → CITY on North edge
    place(state, TILE_E, { x: 0, y: 0 }, 0);
    // Inject a meeple onto that city feature
    const cityFeature = featureAt(state, { x: 0, y: 0 }, 0);
    cityFeature.meeples = [{ playerId: state.players[0].id, segmentRef: { tileId: 't1', localId: 0 } }];

    // Pending TILE_E at (0,-1) rotation 180 → CITY is now on South, connects to the city above
    state.pendingTile = TILE_E;
    const result = meeplesView(state, { x: 0, y: -1 }, 180);

    const cityTarget = result.targets.find(t => t.kind === 'CITY');
    expect(cityTarget?.claimable).toBe(false);
  });

  it('keeps CITY segment claimable when connecting feature has no meeples', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 0, y: 0 }, 0);
    // No meeple placed on the city

    state.pendingTile = TILE_E;
    const result = meeplesView(state, { x: 0, y: -1 }, 180);

    const cityTarget = result.targets.find(t => t.kind === 'CITY');
    expect(cityTarget?.claimable).toBe(true);
  });

  it('includes openEdges from the connected feature', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 0, y: 0 }, 0);

    state.pendingTile = TILE_E;
    const result = meeplesView(state, { x: 0, y: -1 }, 180);

    const cityTarget = result.targets.find(t => t.kind === 'CITY');
    expect(cityTarget?.openEdges).toBeGreaterThanOrEqual(0);
  });

  it('includes each segment of the pending tile', () => {
    const state = freshGame();
    state.pendingTile = TILE_E;
    const result = meeplesView(state, { x: 10, y: 10 }, 0);
    const ids = result.targets.map(t => t.segmentLocalId);
    // TILE_E has localId 0 (CITY) and localId 1 (FIELD)
    expect(ids).toContain(0);
    expect(ids).toContain(1);
  });
});
