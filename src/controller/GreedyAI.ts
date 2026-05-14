import type { GameController } from './GameController';
import { candidatePlacements, countPlacedNeighbors } from '../core/board/Board';
import type { Coord, SegmentRef } from '../core/types';

export function findLegalPlacements(controller: GameController) {
  const s = controller.getState();
  const coords = candidatePlacements(s.board);
  const rotations = [0, 90, 180, 270] as const;
  const legal: { coord: Coord; rotation: number }[] = [];
  for (const coord of coords) {
    for (const rot of rotations) {
      const p = controller.previewPlacement(coord, rot as any);
      if ((p as any).legal === true) legal.push({ coord, rotation: rot });
    }
  }
  return legal;
}

export function chooseGreedyPlacement(legal: { coord: Coord; rotation: number }[], controller: GameController) {
  if (!legal.length) return null;
  const s = controller.getState();
  let best = legal[0];
  let bestScore = -Infinity;
  for (const cand of legal) {
    const score = countPlacedNeighbors(s.board, cand.coord);
    if (score > bestScore || (score === bestScore && Math.random() < 0.5)) {
      best = cand; bestScore = score;
    }
  }
  return best;
}

export function createGreedyAI(controller: GameController, aiPlayerIndex: number = 1, options: { placeMeepleProbability?: number } = {}) {
  let unsub: (() => void) | null = null;
  let busy = false;

  function alignRotation(targetRotation: number): void {
    const state = controller.getState();
    const current = state.pendingRotation;
    let diff = (targetRotation - current + 360) % 360;
    while (diff > 0) {
      controller.rotatePending('CW');
      diff -= 90;
    }
  }

  async function performTurn() {
    if (busy) return; busy = true;
    try {
      const before = controller.getState();
      if (before.currentPlayerIndex !== aiPlayerIndex || before.phase === 'GAME_OVER') return;

      if (before.phase === 'PLACING_TILE') {
        if (!before.pendingTile) {
          const draw = controller.drawTile();
          if (!draw.ok) return;
          await new Promise(r => setTimeout(r, 30));
        }

        const legal = findLegalPlacements(controller);
        if (legal.length === 0) return;

        const choice = chooseGreedyPlacement(legal, controller);
        if (!choice) return;

        alignRotation(choice.rotation);
        await new Promise(r => setTimeout(r, 40));
        const placed = controller.placeTile(choice.coord);
        if (!placed.ok) return;
        await new Promise(r => setTimeout(r, 30));
      }

      const afterPlacement = controller.getState();
      if (afterPlacement.currentPlayerIndex !== aiPlayerIndex || afterPlacement.phase !== 'PLACING_MEEPLE') return;

      const targets: SegmentRef[] = controller.getMeepleTargetsForLastTile();
      if (targets.length === 0) {
        controller.skipMeeple();
      } else {
        const prob = options.placeMeepleProbability ?? 1;
        if (Math.random() < prob) {
          controller.placeMeeple(targets[Math.floor(Math.random() * targets.length)]);
        } else {
          controller.skipMeeple();
        }
      }
    } finally { busy = false; }
  }

  function onState() {
    const s = controller.getState();
    if (s.currentPlayerIndex === aiPlayerIndex && (s.phase === 'PLACING_TILE' || s.phase === 'PLACING_MEEPLE')) {
      setTimeout(() => void performTurn(), 80);
    }
  }

  return {
    start() {
      if (!unsub) unsub = controller.subscribe(onState);
      onState();
    },
    stop() { if (unsub) { unsub(); unsub = null; } },
  };
}
