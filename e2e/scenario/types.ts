// Type shapes for a single YAML scenario. One YAML file === one Scenario.
// See tests/scenarios/README.md for the authored schema + examples.

export type Rotation = 0 | 90 | 180 | 270;

export interface ScenarioStep {
  /** Tile dealt this turn — MUST equal the deck order; the runner guards it. */
  tile: string;
  /** Board coordinate to place at (the start tile occupies 0,0). */
  at: { x: number; y: number };
  /** Applied via rotate-cw button clicks. Defaults to 0. */
  rotation?: Rotation;
  /** Place a meeple on this segment localId of the just-placed tile. */
  meeple?: { segment: number };
  /** Explicitly skip the meeple step. */
  skip?: boolean;
  /** Assert preview legality before the final placement (same pending tile). */
  placementChecks?: Array<{ at: { x: number; y: number }; rotation?: Rotation; legal: boolean }>;
  /** Expect meeple placement on `meeple.segment` to be rejected by the engine. */
  rejectMeeple?: boolean;
}

export interface ExpectedFeature {
  kind: 'CITY' | 'ROAD' | 'MONASTERY' | 'FIELD';
  points?: number;
  tiles?: number;
  shieldCount?: number;
}

export interface ScenarioExpect {
  /** Expected game phase (e.g. `GAME_OVER` for a full-game playthrough). */
  phase?: 'NOT_STARTED' | 'PLACING_TILE' | 'PLACING_MEEPLE' | 'GAME_OVER';
  /** Expected final score, keyed by player name. */
  scores?: Record<string, number>;
  /** Expected meeples in hand, keyed by player name (proves meeple return). */
  meeplesAvailable?: Record<string, number>;
  /** Features that must be completed (matched as a multiset). */
  completedFeatures?: ExpectedFeature[];
  /** Optional sanity check: total tiles on the board (incl. start tile). */
  placedTiles?: number;
  /** Remaining draw-pile size (deck-check scenarios). */
  deckRemaining?: number;
  /** Per-type tile counts left in the draw pile. */
  deckCounts?: Record<string, number>;
  /** Draw pile + pending tile (full distribution check). */
  deckTotalTiles?: number;
}

export interface Scenario {
  name: string;
  description?: string;
  players: string[];
  steps: ScenarioStep[];
  /** Use the canonical 72-tile base-game draw pile (ignores step-derived deck). */
  deckFrom?: 'base-game';
  /**
   * Drive a complete, deterministic playthrough to GAME_OVER after the (usually
   * empty) `steps`. The seed makes the whole game reproducible — see the
   * full-game-playthrough scenario.
   */
  autoPlay?: { seed: number };
  /** Filler tiles kept in the deck so the game stays mid-game after the last step. */
  padding?: string[];
  /** If true, the runner triggers end-game scoring before asserting. */
  endGame?: boolean;
  expect: ScenarioExpect;
  /** Absolute path of the source file (filled in by loadScenario). */
  sourceFile?: string;
}
