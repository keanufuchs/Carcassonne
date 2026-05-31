export type { AI, AIDecision } from './AI';
export { computeHeuristicMove } from './heuristic';
export { computeIntelligentMove } from './intelligent';
export { computeRandomMove } from './random';

import type { SegmentRef } from '../core/types';
import type { GameState } from '../core/game/GameState';
import type { GameController } from '../controller/GameController';
import type { AIDecision } from './AI';
import { chooseRandomMeeple } from './random';
import { chooseHeuristicMeeple } from './heuristic';

export type AIMode = 'random' | 'heuristic' | 'intelligent';

export type AIStatusEvent =
  | { type: 'start';       model: string }
  | { type: 'mcp_status';  online: boolean }
  | { type: 'tool_call';   name: string }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'reasoning';   text: string; coord: { x: number; y: number }; rotation: number }
  | { type: 'fallback';    reason: 'no_config' | 'timeout' | 'error' | 'invalid_move' }
  | { type: 'error';       message: string }
  | { type: 'done' };

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeAITurn(
  controller: GameController,
  mode: AIMode,
  onStatus?: (event: AIStatusEvent) => void,
): Promise<void> {
  const state = controller.getState();
  if (state.phase === 'GAME_OVER') return;

  // Restored mid-turn: tile already placed, meeple phase not yet resolved
  if (state.phase === 'PLACING_MEEPLE') {
    await delay(400);
    controller.skipMeeple();
    return;
  }

  await delay(50);

  // Draw tile (no-op if tile already drawn, e.g. restored after draw)
  controller.drawTile();
  // await delay(500);
  const afterDraw = controller.getState();
  if (afterDraw.phase === 'GAME_OVER') return;
  if (!afterDraw.pendingTile) return;

  let decision: AIDecision;
  switch (mode) {
    case 'heuristic':
      decision = (await import('./heuristic')).computeHeuristicMove(afterDraw);
      break;
    case 'intelligent':
      decision = await (await import('./intelligent')).computeIntelligentMove(afterDraw, onStatus);
      break;
    case 'random':
    default:
      decision = await (await import('./random')).computeRandomMove(afterDraw);
      break;
  }

  const currentRot = controller.getState().pendingRotation;
  const rotDiff = ((decision.rotation - currentRot) + 360) % 360;
  const steps = rotDiff / 90;
  for (let i = 0; i < steps; i++) controller.rotatePending('CW');

  controller.placeTile(decision.coord);
  const afterPlace = controller.getState();
  if (afterPlace.phase === 'GAME_OVER') return;

  if (afterPlace.phase === 'PLACING_MEEPLE') {
    const targets = controller.getMeepleTargetsForLastTile();
    const ref = chooseMeeple(mode, afterPlace, targets, decision);
    if (ref && controller.placeMeeple(ref).ok) return;
    controller.skipMeeple();
  }
}

/**
 * Pick the meeple to place on the just-placed tile, per AI mode.
 *
 * `targets` are the *real* legal `SegmentRef`s (correct runtime tile id). An AI
 * decided its meeple from the pending (prototype) tile, where only `localId` is
 * stable across placement — so the AI's `meepleRef` is matched to a real target
 * by `localId`, never by tile id.
 */
function chooseMeeple(
  mode: AIMode,
  state: GameState,
  targets: SegmentRef[],
  decision: AIDecision,
): SegmentRef | null {
  if (targets.length === 0) return null;

  if (mode === 'random') return chooseRandomMeeple(state, targets);

  // The intelligent (LLM) AI decides the meeple jointly with the tile. When that
  // decision is authoritative (meepleResolved), honour it verbatim — including an
  // explicit "no meeple" — instead of overriding it with the heuristic chooser.
  // meepleRef is matched to a real target by the stable localId, never tile id.
  if (decision.meepleResolved) {
    if (!decision.meepleRef) return null;
    return targets.find(t => t.localId === decision.meepleRef!.localId) ?? null;
  }

  // Heuristic mode, or the LLM fell back to a heuristic move: decide the meeple
  // here, after the tile is placed.
  return chooseHeuristicMeeple(state, targets);
}
