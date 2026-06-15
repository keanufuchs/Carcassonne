import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import yaml from 'js-yaml';
import type { Scenario, ScenarioStep } from './types';

const TILE_ID = /^TILE-[A-X]$/;

function fail(file: string, msg: string): never {
  throw new Error(`Invalid scenario "${basename(file)}": ${msg}`);
}

/** Parse + lightly validate a single YAML scenario file. */
export function loadScenario(file: string): Scenario {
  const raw = yaml.load(readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object') fail(file, 'file is empty or not a YAML mapping');
  const s = raw as Partial<Scenario>;

  if (!s.name || typeof s.name !== 'string') fail(file, 'missing "name"');
  if (!Array.isArray(s.players) || s.players.length < 2 || s.players.length > 5) {
    fail(file, '"players" must list 2..5 names');
  }
  const deckOnly = s.deckFrom === 'base-game';
  const autoPlay = s.autoPlay !== undefined;
  if (!Array.isArray(s.steps)) fail(file, '"steps" must be a list');
  if (!deckOnly && !autoPlay && s.steps.length === 0) {
    fail(file, '"steps" must be a non-empty list (or use deckFrom: base-game / autoPlay)');
  }
  if (autoPlay && (typeof s.autoPlay!.seed !== 'number' || !Number.isFinite(s.autoPlay!.seed))) {
    fail(file, '"autoPlay.seed" must be a finite number');
  }

  s.steps.forEach((step: ScenarioStep, i) => {
    const ctx = `step ${i}`;
    if (!step.tile || !TILE_ID.test(step.tile)) fail(file, `${ctx}: "tile" must match TILE-A..TILE-X (got ${step.tile})`);
    if (!step.at || typeof step.at.x !== 'number' || typeof step.at.y !== 'number') {
      fail(file, `${ctx}: "at" must be {x, y}`);
    }
    if (step.rotation !== undefined && ![0, 90, 180, 270].includes(step.rotation)) {
      fail(file, `${ctx}: "rotation" must be 0|90|180|270`);
    }
    if (step.meeple && typeof step.meeple.segment !== 'number') {
      fail(file, `${ctx}: "meeple.segment" must be a number (segment localId)`);
    }
    if (step.rejectMeeple && !step.meeple) {
      fail(file, `${ctx}: "rejectMeeple" requires "meeple.segment"`);
    }
    for (const [j, check] of (step.placementChecks ?? []).entries()) {
      const cctx = `${ctx}.placementChecks[${j}]`;
      if (!check.at || typeof check.at.x !== 'number' || typeof check.at.y !== 'number') {
        fail(file, `${cctx}: "at" must be {x, y}`);
      }
      if (check.rotation !== undefined && ![0, 90, 180, 270].includes(check.rotation)) {
        fail(file, `${cctx}: "rotation" must be 0|90|180|270`);
      }
      if (typeof check.legal !== 'boolean') fail(file, `${cctx}: "legal" must be true|false`);
    }
  });

  if (s.deckFrom !== undefined && s.deckFrom !== 'base-game') {
    fail(file, '"deckFrom" must be "base-game" when set');
  }

  for (const t of s.padding ?? []) {
    if (!TILE_ID.test(t)) fail(file, `padding tile "${t}" must match TILE-A..TILE-X`);
  }

  if (!s.expect || typeof s.expect !== 'object') fail(file, 'missing "expect" block');

  return { ...(s as Scenario), sourceFile: file };
}
