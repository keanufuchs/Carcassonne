import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { connectionsForMove } from '../../src/ai/boardAnalysis';
import { freshGame, place, featureAt } from '../helpers/fixtures';
import { TILE_E, TILE_U } from '../helpers/prototypes';

beforeEach(() => _resetTileSeq());

/**
 * connectionsForMove is the data the LLM relies on to verify "extend/complete"
 * claims. These tests pin its geometry against the real placement engine so the
 * model is never told a move connects to a feature it does not actually touch.
 */
describe('connectionsForMove', () => {
  it('reports the existing city a move would join', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 0, y: 0 }, 0); // TILE_E North edge = CITY
    const cityA = featureAt(state, { x: 0, y: 0 }, 0);
    state.pendingTile = TILE_E;

    // TILE_E rotated 180 has its CITY edge facing South → joins cityA to the north.
    const conns = connectionsForMove(state, { x: 0, y: -1 }, 180);

    expect(conns.map(c => c.featureId)).toEqual([cityA.id]);
    expect(conns[0].kind).toBe('CITY');
  });

  it('reports an empty list for a move that only touches fields (starts a NEW feature)', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 0, y: 0 }, 0); // East edge = FIELD
    state.pendingTile = TILE_E;

    // East neighbour shares only field edges → no city/road connection.
    const conns = connectionsForMove(state, { x: 1, y: 0 }, 0);
    expect(conns).toEqual([]);
  });

  it('reports the existing road a move would join', () => {
    const state = freshGame();
    place(state, TILE_U, { x: 0, y: 0 }, 0); // straight N–S road
    const roadA = featureAt(state, { x: 0, y: 0 }, 0);
    state.pendingTile = TILE_U;

    const conns = connectionsForMove(state, { x: 0, y: 1 }, 0); // road continues south
    expect(conns.map(c => c.featureId)).toEqual([roadA.id]);
    expect(conns[0].kind).toBe('ROAD');
  });

  it('matches the real engine: a predicted city connection actually merges on placement', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 0, y: 0 }, 0);
    const cityA = featureAt(state, { x: 0, y: 0 }, 0);
    const segsBefore = cityA.segments.size;
    state.pendingTile = TILE_E;

    const predicted = connectionsForMove(state, { x: 0, y: -1 }, 180);
    expect(predicted.map(c => c.featureId)).toContain(cityA.id);

    // Actually place it; the predicted feature must have absorbed the new segment.
    place(state, TILE_E, { x: 0, y: -1 }, 180);
    const cityAfter = featureAt(state, { x: 0, y: 0 }, 0);
    expect(cityAfter.id).toBe(cityA.id);
    expect(cityAfter.segments.size).toBeGreaterThan(segsBefore);
  });

  it('surfaces meeple ownership so the model can tell its own features apart', () => {
    const state = freshGame();
    place(state, TILE_E, { x: 0, y: 0 }, 0);
    const cityA = featureAt(state, { x: 0, y: 0 }, 0);
    cityA.meeples.push({ playerId: state.players[0].id, segmentRef: { tileId: 'T1', localId: 0 } });
    state.pendingTile = TILE_E;

    const conns = connectionsForMove(state, { x: 0, y: -1 }, 180);
    expect(conns[0].meeples).toContain(state.players[0].id);
  });
});
