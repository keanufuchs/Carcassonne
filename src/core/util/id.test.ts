import { describe, it, expect, vi } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  it('returns a UUID-shaped string', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('falls back when randomUUID is unavailable', () => {
    const original = globalThis.crypto?.randomUUID;
    vi.stubGlobal('crypto', { randomUUID: undefined });
    try {
      expect(generateId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      if (original) vi.stubGlobal('crypto', { randomUUID: original });
      else vi.unstubAllGlobals();
    }
  });
});
