# Carcassonne — Specification

A spec-driven design for a desktop digital implementation of the **Carcassonne** base game (full rules), built with Electron + React + TypeScript.

## Scope

- Full base-game rules: tile placement, edge matching, rotation, meeple placement on cities/roads/monasteries/fields, mid-game and end-game scoring including farmers.
- 2–5 hot-seat human players (no AI, no networking).
- In-memory state only (no save/load, no undo).
- 2.5D rendering via CSS perspective/transform/shadows; abstract tile artwork (no licensed assets).

## Non-goals (deferred)

- Expansions (River, Inns & Cathedrals, etc.).
- AI opponents.
- Save/load and undo.
- Online multiplayer.
- Internationalization.

## Spec files

Read in this order:

| # | File | Purpose |
|---|------|---------|
| 1 | [architecture.md](./architecture.md) | Layer map, module boundaries, dependency rules |
| 2 | [domain-model.md](./domain-model.md) | Entities, relationships, top-level GameState shape |
| 3 | [tile-system.md](./tile-system.md) | Tile schema, edges/slots, segments, internal connectivity, rotation, deck |
| 4 | [feature-system.md](./feature-system.md) | Feature objects, segment identity, merge algorithm, completion, meeple legality |
| 5 | [scoring.md](./scoring.md) | Mid-game, end-game, and farmer scoring; majority/tie rule |
| 6 | [game-flow.md](./game-flow.md) | Turn FSM, full turn sequence, unplaceable-tile handling, end conditions |
| 7 | [api.md](./api.md) | Controller interface between UI and core; commands, queries, events |
| 8 | [testing.md](./testing.md) | Test strategy, coverage targets, example test cases |
| 9 | [09_meeples.md](./09_meeples.md) | Meeple placement rules, legality, return mechanics, UI behavior, test IDs |

## Guiding principles

- **Core is framework-free.** No imports from React, Electron, or DOM in `src/core/`.
- **Correctness over performance.** Board is small (≤72 tiles); choose the clearer algorithm.
- **Feature/segment model is the core complexity.** Spend extra care here; everything else hangs off it.
- **YAGNI.** No abstractions for hypothetical future features.
