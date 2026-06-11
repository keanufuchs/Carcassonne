import { describe, it, expect } from 'vitest';
import { generateMoveReasoning } from '../../src/ai/boardAnalysis';
import type { MoveConnection } from '../../src/ai/boardAnalysis';

const ME = 'player-1';
const OPP = 'player-2';

function conn(overrides: Partial<MoveConnection> & { kind: string }): MoveConnection {
  return {
    featureId: 'f1', kind: overrides.kind,
    openEdges: overrides.openEdges ?? 3,
    shieldCount: overrides.shieldCount ?? 0,
    completed: overrides.completed ?? false,
    meeples: overrides.meeples ?? [],
  };
}

describe('generateMoveReasoning', () => {
  it('returns a start label when there are no connections', () => {
    expect(generateMoveReasoning([], ME)).toBe('Start new feature');
  });

  it('reports completing own feature when openEdges is 1', () => {
    const c = conn({ kind: 'CITY', openEdges: 1, meeples: [ME] });
    expect(generateMoveReasoning([c], ME)).toContain('Complete own CITY');
  });

  it('reports shield count when completing an own city with shields', () => {
    const c = conn({ kind: 'CITY', openEdges: 1, shieldCount: 2, meeples: [ME] });
    expect(generateMoveReasoning([c], ME)).toContain('2 shield');
  });

  it('prioritises completing own feature over blocking opponent', () => {
    const own  = conn({ kind: 'ROAD', openEdges: 1, meeples: [ME] });
    const opp  = conn({ kind: 'CITY', openEdges: 1, meeples: [OPP], featureId: 'f2' } as Partial<MoveConnection> & { kind: string });
    expect(generateMoveReasoning([own, opp], ME)).toContain('Complete own ROAD');
  });

  it('reports blocking opponent when their feature has 1 edge left', () => {
    const c = conn({ kind: 'CITY', openEdges: 1, meeples: [OPP] });
    expect(generateMoveReasoning([c], ME)).toContain('Block opponent CITY');
  });

  it('reports extending own feature', () => {
    const c = conn({ kind: 'CITY', openEdges: 3, meeples: [ME] });
    const result = generateMoveReasoning([c], ME);
    expect(result).toContain('Extend own CITY');
    expect(result).toContain('3 open');
  });

  it('falls back to joining an unowned feature', () => {
    const c = conn({ kind: 'ROAD', openEdges: 4 });
    expect(generateMoveReasoning([c], ME)).toContain('Join ROAD');
  });
});
