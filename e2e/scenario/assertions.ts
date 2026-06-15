import type { Scenario } from './types';
import type { ScenarioSummary } from '../../src/test-bridge/scenarioBridge';
import { evaluateExpectations, formatExpectRecapText } from './expectRecap';

/** Assert the engine's final summary against the scenario's `expect` block. */
export function assertScenario(scenario: Scenario, summary: ScenarioSummary): void {
  const checks = evaluateExpectations(scenario, summary);
  const failed = checks.filter(c => !c.ok);
  if (failed.length === 0) return;

  const recap = formatExpectRecapText(scenario, checks);
  const first = failed[0];
  throw new Error(`${recap}\n\nFirst failure: ${first.field} — expected ${first.expected}, got ${first.actual}`);
}
