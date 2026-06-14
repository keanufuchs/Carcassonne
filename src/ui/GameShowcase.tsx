import { useEffect, useRef, useState } from 'react';
import { createGameController } from '../controller/GameController';
import type { GameController } from '../controller/GameController';
import { executeAITurn } from '../ai';
import { Board3DView } from './board/Board3DView';

/**
 * Ambient background showcase for the menu screens: two/three AI players keep
 * playing a match — drawing, placing and claiming tiles — on the real 3D board.
 * Purely decorative (pointer-events disabled, aria-hidden); it demonstrates the
 * game in motion without competing with the foreground UI.
 *
 * Reuses the production controller + AI engine + Board3DView, so the showcase is
 * always a faithful preview of the actual game.
 */
const SHOWCASE_PLAYERS = ['Amber', 'Sage', 'Rust'];

/** Restart before the growing board drifts past the fixed isometric camera. */
const MAX_TILES = 28;
/** Leisurely pacing so the scene reads as calm ambience, not a frantic demo. */
const TURN_PACE_MS = 950;
/** Hold a finished board briefly before dealing a fresh one. */
const RESTART_HOLD_MS = 2800;

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function GameShowcase() {
  const [controller, setController] = useState<GameController | null>(null);
  const [, forceRender] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode's double-invoke in dev.
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        const ctrl = createGameController();
        ctrl.startGame(SHOWCASE_PLAYERS);
        const unsub = ctrl.subscribe(() => { if (!cancelled) forceRender(v => v + 1); });
        setController(ctrl);

        while (!cancelled) {
          const s = ctrl.getState();
          if (s.phase === 'GAME_OVER' || s.board.tiles.size >= MAX_TILES) break;
          try { await executeAITurn(ctrl, 'random'); } catch { break; }
          await delay(TURN_PACE_MS);
        }

        unsub();
        if (cancelled) break;
        await delay(RESTART_HOLD_MS);
      }
    }

    loop();
    return () => { cancelled = true; };
  }, []);

  if (!controller) return null;

  return (
    <div className="showcase" aria-hidden="true">
      <Board3DView state={controller.getState()} controller={controller} isAiTurn />
    </div>
  );
}
