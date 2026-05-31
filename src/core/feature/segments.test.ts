import { describe, it, expect } from 'vitest';
import { createRegistry, createFeature, attachSegment, lookupBySegment, retireFeature } from './segments';

describe('FeatureRegistry', () => {
  describe('createRegistry', () => {
    it('creates an empty registry with nextId = 1', () => {
      const reg = createRegistry();
      expect(reg.features.size).toBe(0);
      expect(reg.segmentToFeature.size).toBe(0);
      expect(reg.nextId).toBe(1);
    });
  });

  describe('createFeature', () => {
    it('creates a feature with sequential IDs', () => {
      const reg = createRegistry();
      const a = createFeature(reg, 'ROAD');
      const b = createFeature(reg, 'CITY');
      expect(a.id).toBe('F1');
      expect(b.id).toBe('F2');
      expect(reg.features.size).toBe(2);
    });

    it('initializes feature with default values', () => {
      const reg = createRegistry();
      const f = createFeature(reg, 'ROAD');
      expect(f.kind).toBe('ROAD');
      expect(f.segments).toBeInstanceOf(Set);
      expect(f.segments.size).toBe(0);
      expect(f.openEdges).toBe(0);
      expect(f.meeples).toEqual([]);
      expect(f.shieldCount).toBe(0);
      expect(f.completed).toBe(false);
    });
  });

  describe('attachSegment', () => {
    it('attaches a segment to a feature and registers the mapping', () => {
      const reg = createRegistry();
      const f = createFeature(reg, 'ROAD');
      const ref = { tileId: 'T1', localId: 0 };
      attachSegment(reg, f, ref);
      expect(f.segments.has('T1#0')).toBe(true);
      expect(reg.segmentToFeature.get('T1#0')).toBe(f.id);
    });
  });

  describe('lookupBySegment', () => {
    it('returns the feature for a known segment', () => {
      const reg = createRegistry();
      const f = createFeature(reg, 'CITY');
      const ref = { tileId: 'A', localId: 0 };
      attachSegment(reg, f, ref);
      expect(lookupBySegment(reg, ref).id).toBe(f.id);
    });

    it('throws for unknown segment', () => {
      const reg = createRegistry();
      expect(() => lookupBySegment(reg, { tileId: 'X', localId: 99 }))
        .toThrow('No feature for segment');
    });
  });

  describe('retireFeature', () => {
    it('removes a feature from the registry', () => {
      const reg = createRegistry();
      const f = createFeature(reg, 'ROAD');
      expect(reg.features.has(f.id)).toBe(true);
      retireFeature(reg, f.id);
      expect(reg.features.has(f.id)).toBe(false);
    });
  });
});