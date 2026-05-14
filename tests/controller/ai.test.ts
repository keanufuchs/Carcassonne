import { describe, it, expect } from 'vitest';
import { createGameController } from '../../src/controller/GameController';
import { findLegalPlacements as findRandomLegal } from '../../src/controller/RandomAI';
import { findLegalPlacements as findGreedyLegal, chooseGreedyPlacement } from '../../src/controller/GreedyAI';

describe('AI helpers', () => {
  it('finds at least one legal placement after drawing a tile', () => {
    const ctrl = createGameController();
    ctrl.startGame(['P1', 'P2']);
    const r = ctrl.drawTile();
    expect(r.ok).toBe(true);
    const legal = findRandomLegal(ctrl);
    expect(Array.isArray(legal)).toBe(true);
    expect(legal.length).toBeGreaterThan(0);
  });

  it('greedy chooser returns one of the legal placements', () => {
    const ctrl = createGameController();
    ctrl.startGame(['P1', 'P2']);
    ctrl.drawTile();
    const legal = findGreedyLegal(ctrl);
    expect(legal.length).toBeGreaterThan(0);
    const pick = chooseGreedyPlacement(legal, ctrl as any);
    expect(pick).toBeTruthy();
    // pick must be one of legal
    const found = legal.some(l => l.coord.x === pick!.coord.x && l.coord.y === pick!.coord.y && l.rotation === pick!.rotation);
    expect(found).toBe(true);
  });
});
