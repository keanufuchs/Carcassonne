export type { AI, AIDecision } from './AI';
export { computeHeuristicMove } from './heuristic';
export { computeIntelligentMove } from './intelligent';
export { computeRandomMove } from './random';

import type { GameController } from '../controller/GameController';
import type { AIDecision } from './AI';

export type AIMode = 'random' | 'heuristic' | 'intelligent';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeAITurn(
  controller: GameController,
  mode: AIMode,
): Promise<void> {
  const state = controller.getState();
  if (state.phase === 'GAME_OVER') return;

  // Restored mid-turn: tile already placed, meeple phase not yet resolved
  if (state.phase === 'PLACING_MEEPLE') {
    await delay(400);
    controller.skipMeeple();
    return;
  }

  await delay(600);

  // Draw tile (no-op if tile already drawn, e.g. restored after draw)
  controller.drawTile();
  await delay(500);
  const afterDraw = controller.getState();
  if (afterDraw.phase === 'GAME_OVER') return;
  if (!afterDraw.pendingTile) return;

  let decision: AIDecision;
  switch (mode) {
    case 'heuristic':
      decision = (await import('./heuristic')).computeHeuristicMove(afterDraw);
      break;
    case 'intelligent':
      decision = await (await import('./intelligent')).computeIntelligentMove(afterDraw);
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
    if (decision.meepleRef && targets.some(t =>
      t.tileId === decision.meepleRef!.tileId && t.localId === decision.meepleRef!.localId
    )) {
      controller.placeMeeple(decision.meepleRef);
    } else {
      controller.skipMeeple();
    }
  }
}
