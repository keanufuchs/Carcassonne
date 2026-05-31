export type { AI, AIDecision } from './AI';
export { computeHeuristicMove } from './heuristic';
export { computeIntelligentMove } from './intelligent';
export { computeRandomMove } from './random';

/**
 * Execute a full AI move (draw, place, optionally place meeple, skip otherwise).
 * Returns true if the game is still ongoing, false if game over.
 */
import type { GameController } from '../controller/GameController';
import type { GameState } from '../core/game/GameState';
import type { AIDecision } from './AI';

export type AIMode = 'random' | 'heuristic' | 'intelligent';

export async function executeAITurn(
  controller: GameController,
  mode: AIMode,
): Promise<void> {
  const state = controller.getState();
  if (state.phase === 'GAME_OVER') return;

  // Draw tile
  controller.drawTile();
  const afterDraw = controller.getState();
  if (afterDraw.phase === 'GAME_OVER') return;
  if (!afterDraw.pendingTile) return;

  // Compute move
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

  // Apply rotation to match the decision
  const currentRot = controller.getState().pendingRotation;
  const rotDiff = ((decision.rotation - currentRot) + 360) % 360;
  const steps = rotDiff / 90;
  for (let i = 0; i < steps; i++) controller.rotatePending('CW');

  // Place tile
  controller.placeTile(decision.coord);
  const afterPlace = controller.getState();
  if (afterPlace.phase === 'GAME_OVER') return;

  // Place meeple if we have targets and the decision wants one
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
