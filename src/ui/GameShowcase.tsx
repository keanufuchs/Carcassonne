import { useEffect, useState } from 'react';
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

/** Which AI drives the showcase — heuristic plays sensible, watchable moves. */
const SHOWCASE_AI = 'heuristic' as const;
/** Restart before the growing board drifts past the fixed isometric camera. */
const MAX_TILES = 50;
/** Target cadence: one tile placed per second (the wait absorbs turn compute). */
const TURN_INTERVAL_MS = 250;
/** Hold a finished board briefly before dealing a fresh one. */
const RESTART_HOLD_MS = 5000;

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function GameShowcase() {
  const [controller, setController] = useState<GameController | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    // No ref guard here: under React StrictMode the effect mounts, is cleaned
    // up, then mounts again. A persistent guard would let the first (cancelled)
    // run claim ownership and block the surviving second run — freezing the
    // board. Instead each mount owns a `cancelled`-gated loop that its own
    // cleanup stops; the surviving mount runs indefinitely.
    let cancelled = false;
    // Coalesce render-triggering: the AI publishes several times per turn
    // (draw → rotate → place → meeple), but the decorative board only needs a
    // single React reconcile per frame. rAF batches a publish burst into one.
    let rafId = 0;
    const scheduleRender = () => {
      if (cancelled || rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!cancelled) forceRender(v => v + 1);
      });
    };

    async function loop() {
      while (!cancelled) {
        const ctrl = createGameController();
        const started = ctrl.startGame(SHOWCASE_PLAYERS);
        if (!started.ok) {
          await delay(1000);
          continue;
        }
        const unsub = ctrl.subscribe(scheduleRender);
        setController(ctrl);

        while (!cancelled) {
          const s = ctrl.getState();
          if (s.phase === 'GAME_OVER' || s.board.tiles.size >= MAX_TILES) break;
          const t0 = performance.now();
          try { await executeAITurn(ctrl, SHOWCASE_AI); } catch { break; }
          // Keep a steady ~1 tile/sec by waiting only the remainder of the second.
          await delay(Math.max(0, TURN_INTERVAL_MS - (performance.now() - t0)));
        }

        unsub();
        if (cancelled) break;
        await delay(RESTART_HOLD_MS);
      }
    }

    loop();
    return () => { cancelled = true; if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  if (!controller) return null;

  return (
    <div className="showcase" aria-hidden="true">
      <Board3DView state={controller.getState()} controller={controller} canInteract={false} decorative />
    </div>
  );
}
