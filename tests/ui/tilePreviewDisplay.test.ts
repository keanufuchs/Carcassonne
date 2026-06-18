import { describe, it, expect, beforeEach } from 'vitest';
import { _resetTileSeq } from '../../src/core/tile/Tile';
import { startGame, placeTile } from '../../src/core/game/Game';
import { TILE_D } from '../../src/core/deck/tiles/tile-D';
import { getTilePreviewDisplay } from '../../src/ui/hud/tilePreviewDisplay';

beforeEach(() => _resetTileSeq());

describe('getTilePreviewDisplay', () => {
  it('shows pending tile while placing', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    state.pendingTile = TILE_D;
    state.pendingRotation = 90;

    const preview = getTilePreviewDisplay(state);
    expect(preview.tile?.id).toBe(TILE_D.id);
    expect(preview.rotation).toBe(90);
  });

  it('shows last placed tile during meeple phase', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    state.pendingTile = TILE_D;
    state.pendingRotation = 180;
    placeTile(state, { x: 1, y: 0 });

    expect(state.pendingTile).toBeNull();
    expect(state.phase).toBe('PLACING_MEEPLE');

    const preview = getTilePreviewDisplay(state);
    expect(preview.tile?.id).toBe(TILE_D.id);
    expect(preview.rotation).toBe(180);
  });

  it('returns empty preview when no tile is active', () => {
    const state = startGame(['Alice', 'Bob'], () => 0.5);
    const preview = getTilePreviewDisplay(state);
    expect(preview.tile).toBeNull();
    expect(preview.rotation).toBe(0);
  });
});
