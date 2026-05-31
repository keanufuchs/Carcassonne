import { describe, it, expect, afterEach, vi } from 'vitest';
import { createGameController } from '../../src/controller/GameController';
import { executeAITurn, type AIMode } from '../../src/ai';
import { MEEPLES_PER_PLAYER } from '../../src/core/types';
import type { GameState } from '../../src/core/game/GameState';

/** Total meeples currently sitting on features across the whole board. */
function meeplesOnBoard(state: GameState): number {
  let n = 0;
  for (const f of state.board.registry.features.values()) n += f.meeples.length;
  return n;
}

/**
 * Plays a full game with the given AI mode driving every player and reports
 * whether a meeple was ever actually placed. A meeple shows up either as an
 * occupied feature, or — if the feature completed the same turn — as a spent
 * meeple (meeplesAvailable temporarily below the per-player maximum).
 */
async function everPlacesMeeple(mode: AIMode): Promise<boolean> {
  const ctrl = createGameController();
  ctrl.startGame(['A', 'B']);

  for (let i = 0; i < 90 && ctrl.getState().phase !== 'GAME_OVER'; i++) {
    await executeAITurn(ctrl, mode);
    const state = ctrl.getState();
    const spent = state.players.some(p => p.meeplesAvailable < MEEPLES_PER_PLAYER);
    if (meeplesOnBoard(state) > 0 || spent) return true;
  }
  return false;
}

describe('AI meeple placement', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('random AI places meeples', async () => {
    expect(await everPlacesMeeple('random')).toBe(true);
  }, 30000);

  it('heuristic AI places meeples', async () => {
    expect(await everPlacesMeeple('heuristic')).toBe(true);
  }, 30000);

  it('intelligent AI places meeples (heuristic fallback when the model is unreachable)', async () => {
    // Force the offline fallback path deterministically — no real network.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    vi.spyOn(console, 'error').mockImplementation(() => {}); // expected fallback noise
    expect(await everPlacesMeeple('intelligent')).toBe(true);
  }, 30000);
});
