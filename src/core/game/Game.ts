import type { Coord, SegmentRef, Result, Rotation } from '../types';
import {
  ok as _ok, okVoid, err,
  MEEPLES_PER_PLAYER, PLAYER_COLORS,
} from '../types';
import { createEmptyBoard } from '../board/Board';
import { canPlace, placeTileInternal, hasAnyLegalPlacement } from '../board/placement';
import { buildRemainingTiles, START_TILE } from '../deck/baseGameTiles';
import { shuffle, drawPlaceable } from '../deck/Deck';
import { lookupBySegment } from '../feature/segments';
import { scoreCompletedMidGame } from '../scoring/midGame';
import { scoreIncompleteEndGame } from '../scoring/endGame';
import { scoreFarmers } from '../scoring/farmers';
import type { PlacedTile } from '../tile/Tile';
import type { GameState } from './GameState';

export function startGame(
  playerNames: string[],
  rng: () => number = Math.random,
): GameState {
  if (playerNames.length < 2 || playerNames.length > 5) {
    throw new Error('playerCount must be 2..5');
  }

  const players = playerNames.map((name, i) => ({
    id: `P${i + 1}`,
    name,
    color: PLAYER_COLORS[i],
    score: 0,
    meeplesAvailable: MEEPLES_PER_PLAYER,
  }));

  const deck = { startTile: START_TILE, remaining: buildRemainingTiles() };
  shuffle(deck, rng);

  const state: GameState = {
    version: 1,
    board: createEmptyBoard(),
    deck,
    players,
    currentPlayerIndex: 0,
    phase: 'PLACING_TILE',
    pendingTile: null,
    pendingRotation: 0,
    lastPlacedTileId: null,
    lastCompletedFeatures: [],
  };

  placeTileInternal(state.board, deck.startTile, { x: 0, y: 0 }, 0);
  return state;
}

export function drawTile(state: GameState): Result {
  if (state.phase !== 'PLACING_TILE') return err('WRONG_PHASE', 'Not in PLACING_TILE phase');
  if (state.pendingTile !== null) return okVoid();

  const tile = drawPlaceable(state.deck, t => hasAnyLegalPlacement(state.board, t));

  if (!tile) {
    _applyEndGame(state);
    return okVoid();
  }

  state.pendingTile = tile;
  state.pendingRotation = 0;
  state.version++;
  return okVoid();
}

export function rotatePending(state: GameState, direction: 'CW' | 'CCW'): Result {
  if (state.phase !== 'PLACING_TILE') return err('WRONG_PHASE', 'Not in PLACING_TILE phase');
  if (!state.pendingTile) return err('NO_PENDING_TILE', 'No pending tile to rotate');
  const delta = direction === 'CW' ? 90 : 270;
  state.pendingRotation = ((state.pendingRotation + delta) % 360) as Rotation;
  state.version++;
  return okVoid();
}

export function placeTile(state: GameState, coord: Coord): Result {
  if (state.phase !== 'PLACING_TILE') return err('WRONG_PHASE', 'Not in PLACING_TILE phase');
  if (!state.pendingTile) return err('NO_PENDING_TILE', 'No tile drawn yet');

  if (!canPlace(state.board, state.pendingTile, coord, state.pendingRotation)) {
    const key = `${coord.x},${coord.y}`;
    if (state.board.tiles.has(key)) return err('CELL_OCCUPIED', 'Cell is already occupied');
    return err('EDGE_MISMATCH', 'Tile does not fit here');
  }

  const { placed, completedFeatures } = placeTileInternal(
    state.board, state.pendingTile, coord, state.pendingRotation,
  );

  state.lastPlacedTileId = placed.tileId;
  state.lastCompletedFeatures = completedFeatures.map(f => f.id);
  state.pendingTile = null;
  state.pendingRotation = 0;
  state.phase = 'PLACING_MEEPLE';
  state.version++;

  if (getMeepleTargets(state).length === 0) {
    _resolveScoring(state);
    _advanceTurn(state);
  }

  return okVoid();
}

export function placeMeeple(state: GameState, ref: SegmentRef): Result {
  if (state.phase !== 'PLACING_MEEPLE') return err('WRONG_PHASE', 'Not in PLACING_MEEPLE phase');
  if (ref.tileId !== state.lastPlacedTileId) {
    return err('MEEPLE_NOT_ON_PLACED_TILE', 'Meeple must go on the tile just placed');
  }

  const player = state.players[state.currentPlayerIndex];
  if (player.meeplesAvailable <= 0) return err('NO_MEEPLES_AVAILABLE', 'No meeples left');

  const feature = lookupBySegment(state.board.registry, ref);
  if (feature.meeples.length > 0) return err('MEEPLE_FEATURE_OCCUPIED', 'Feature already has a meeple');
  if (feature.completed) return err('MEEPLE_FEATURE_COMPLETED', 'Feature is already completed');

  feature.meeples.push({ playerId: player.id, segmentRef: ref });
  player.meeplesAvailable -= 1;

  _resolveScoring(state);
  _advanceTurn(state);
  return okVoid();
}

export function skipMeeple(state: GameState): Result {
  if (state.phase !== 'PLACING_MEEPLE') return err('WRONG_PHASE', 'Not in PLACING_MEEPLE phase');
  _resolveScoring(state);
  _advanceTurn(state);
  return okVoid();
}

export function getMeepleTargets(state: GameState): SegmentRef[] {
  if (state.phase !== 'PLACING_MEEPLE' || !state.lastPlacedTileId) return [];
  const placed = [...state.board.tiles.values()].find(t => t.tileId === state.lastPlacedTileId);
  if (!placed) return [];

  const player = state.players[state.currentPlayerIndex];
  if (player.meeplesAvailable <= 0) return [];

  return placed.segmentInstances
    .filter(seg => {
      const feature = lookupBySegment(state.board.registry, seg.ref);
      return feature.meeples.length === 0 && !feature.completed;
    })
    .map(seg => seg.ref);
}

function _resolveScoring(state: GameState): void {
  for (const fid of state.lastCompletedFeatures) {
    const feature = state.board.registry.features.get(fid);
    if (!feature) continue;
    const { winners, points } = scoreCompletedMidGame(feature);
    for (const pid of winners) {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.score += points;
    }
    for (const m of feature.meeples) {
      const p = state.players.find(pl => pl.id === m.playerId);
      if (p) p.meeplesAvailable += 1;
    }
    feature.meeples = [];
  }
  state.lastCompletedFeatures = [];
}

function _advanceTurn(state: GameState): void {
  if (!state.deck.remaining.length) {
    _applyEndGame(state);
    return;
  }
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.phase = 'PLACING_TILE';
  state.lastPlacedTileId = null;
  state.version++;
}

export function endGame(state: GameState): Result {
  if (state.phase === 'GAME_OVER') return err('WRONG_PHASE', 'Game already over');
  _applyEndGame(state);
  return okVoid();
}

function _applyEndGame(state: GameState): void {
  for (const f of state.board.registry.features.values()) {
    if (f.completed || f.kind === 'FIELD') continue;
    const { winners, points } = scoreIncompleteEndGame(f);
    for (const pid of winners) {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.score += points;
    }
  }

  const tileById = new Map<string, PlacedTile>();
  for (const t of state.board.tiles.values()) tileById.set(t.tileId, t);

  for (const r of scoreFarmers(state.board.registry, tileById)) {
    for (const pid of r.winners) {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.score += r.points;
    }
  }

  state.phase = 'GAME_OVER';
  state.version++;
}

// Keep re-export for _ok if needed elsewhere, suppress unused warning
void _ok;
