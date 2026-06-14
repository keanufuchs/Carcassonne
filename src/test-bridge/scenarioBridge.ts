// ── Scenario test bridge ─────────────────────────────────────────────────────
//
// A DEV-ONLY harness that lets the YAML/Playwright scenario runner drive a
// deterministic game against the REAL engine + UI. Installed onto
// `window.__carcTest` from App.tsx, guarded by `import.meta.env.DEV`, so it is
// dead-code-eliminated from production / Electron builds.
//
// The runner can only marshal JSON across `page.evaluate`, so `getSummary()`
// returns a plain, Map-free snapshot with exactly the facts scenarios assert:
// per-player score & meeples, placed-tile count, and the completed features
// (with their structurally-derived points). Note the engine clears a feature's
// meeples the moment it completes (`_resolveScoring`), so a completed feature's
// *winner* is proven transitively via `players[].score` / `meeplesAvailable`,
// not re-derived here.

import type { GameState } from '../core/game/GameState';
import type { Feature } from '../core/feature/Feature';
import { scoreCompletedMidGame, tileCount } from '../core/scoring/midGame';

export interface PlayerSummary {
  id: string;
  name: string;
  score: number;
  meeplesAvailable: number;
}

export interface CompletedFeatureSummary {
  id: string;
  kind: string;
  tiles: number;
  shieldCount: number;
  /** Points the feature is worth, derived structurally (meeple-independent). */
  points: number;
}

export interface ScenarioSummary {
  phase: string;
  currentPlayerIndex: number;
  pendingTileId: string | null;
  placedTiles: number;
  players: PlayerSummary[];
  completedFeatures: CompletedFeatureSummary[];
}

/** The DEV-only API exposed on `window.__carcTest` for the scenario runner. */
export interface ScenarioBridge {
  /** Start a fresh local game whose deck is dealt in exactly `deck` order. */
  startScenario(args: { players: string[]; deck: string[] }): void;
  /** JSON-safe snapshot of the current game for assertions. */
  getSummary(): ScenarioSummary;
  /** Force end-game scoring (for incomplete-feature / farmer scenarios). */
  endGame(): void;
  /** Pan/zoom the 2D board so all placed tiles are centered (for screenshots). */
  fitBoardView(): void;
}

declare global {
  interface Window {
    __carcTest?: ScenarioBridge;
  }
}

function pointsFor(f: Feature): number {
  // FIELDs never complete mid-game; report 0 rather than throwing.
  if (f.kind === 'FIELD') return 0;
  return scoreCompletedMidGame(f).points;
}

export function buildSummary(state: GameState): ScenarioSummary {
  const completedFeatures: CompletedFeatureSummary[] = [];
  for (const f of state.board.registry.features.values()) {
    if (!f.completed) continue;
    completedFeatures.push({
      id: f.id,
      kind: f.kind,
      tiles: tileCount(f),
      shieldCount: f.shieldCount,
      points: pointsFor(f),
    });
  }

  return {
    phase: state.phase,
    currentPlayerIndex: state.currentPlayerIndex,
    pendingTileId: state.pendingTile?.id ?? null,
    placedTiles: state.board.tiles.size,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      meeplesAvailable: p.meeplesAvailable,
    })),
    completedFeatures,
  };
}
