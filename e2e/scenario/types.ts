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
}

export interface ExpectedFeature {
  kind: 'CITY' | 'ROAD' | 'MONASTERY' | 'FIELD';
  points?: number;
  tiles?: number;
  shieldCount?: number;
}

export interface ScenarioExpect {
  /** Expected final score, keyed by player name. */
  scores?: Record<string, number>;
  /** Expected meeples in hand, keyed by player name (proves meeple return). */
  meeplesAvailable?: Record<string, number>;
  /** Features that must be completed (matched as a multiset). */
  completedFeatures?: ExpectedFeature[];
  /** Optional sanity check: total tiles on the board (incl. start tile). */
  placedTiles?: number;
}

export interface Scenario {
  name: string;
  description?: string;
  players: string[];
  steps: ScenarioStep[];
  /** Filler tiles kept in the deck so the game stays mid-game after the last step. */
  padding?: string[];
  /** If true, the runner triggers end-game scoring before asserting. */
  endGame?: boolean;
  expect: ScenarioExpect;
  /** Absolute path of the source file (filled in by loadScenario). */
  sourceFile?: string;
}
