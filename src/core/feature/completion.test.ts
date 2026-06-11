import { describe, it, expect } from 'vitest';
import { detectCompletions } from './completion';
import { createRegistry, createFeature } from './segments';

describe('detectCompletions', () => {
  it('detects city completion when openEdges reaches 0', () => {
    const reg = createRegistry();
    const city = createFeature(reg, 'CITY');
    city.openEdges = 0;
    const completed = detectCompletions(reg, new Set([city.id]));
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe(city.id);
    expect(completed[0].completed).toBe(true);
  });

  it('does not mark city as completed when openEdges > 0', () => {
    const reg = createRegistry();
    const city = createFeature(reg, 'CITY');
    city.openEdges = 2;
    const completed = detectCompletions(reg, new Set([city.id]));
    expect(completed).toHaveLength(0);
    expect(city.completed).toBe(false);
  });

  it('detects monastery completion when all 8 neighbors filled', () => {
    const reg = createRegistry();
    const monastery = createFeature(reg, 'MONASTERY');
    monastery.monasteryTileId = 'T1';
    monastery.monasterySurroundCount = 8;
    const completed = detectCompletions(reg, new Set([monastery.id]));
    expect(completed).toHaveLength(1);
    expect(completed[0].completed).toBe(true);
  });

  it('does not mark monastery completed when surroundCount < 8', () => {
    const reg = createRegistry();
    const monastery = createFeature(reg, 'MONASTERY');
    monastery.monasterySurroundCount = 5;
    const completed = detectCompletions(reg, new Set([monastery.id]));
    expect(completed).toHaveLength(0);
  });

  it('never marks fields as completed', () => {
    const reg = createRegistry();
    const field = createFeature(reg, 'FIELD');
    field.openEdges = 0;
    const completed = detectCompletions(reg, new Set([field.id]));
    expect(completed).toHaveLength(0);
  });

  it('skips already completed features', () => {
    const reg = createRegistry();
    const city = createFeature(reg, 'CITY');
    city.openEdges = 0;
    city.completed = true;
    const completed = detectCompletions(reg, new Set([city.id]));
    expect(completed).toHaveLength(0);
  });

  it('handles multiple features at once', () => {
    const reg = createRegistry();
    const road = createFeature(reg, 'ROAD');
    road.openEdges = 0;
    const city = createFeature(reg, 'CITY');
    city.openEdges = 0;
    const completed = detectCompletions(reg, new Set([road.id, city.id]));
    expect(completed).toHaveLength(2);
  });

  it('handles empty touched set', () => {
    const reg = createRegistry();
    expect(detectCompletions(reg, new Set())).toEqual([]);
  });
});