# Carcassonne — Specification

A spec-driven design for a desktop digital implementation of the **Carcassonne** base game (full rules), built with Electron + React + TypeScript.

**Abgabetermin:** 15.06.2026 | **Aktuelle Version:** v0.6.0 | **Notion:** [Carcassonne Workspace](https://www.notion.so/Carcassonne-dfae27f8f8af839c9c1281293e1a5af7)

## Scope

- Full base-game rules: tile placement, edge matching, rotation, meeple placement on cities/roads/monasteries/fields, mid-game and end-game scoring including farmers.
- 2–5 hot-seat human players + random AI opponent (MH-05).
- 2–5 player network multiplayer via WebSocket/LAN (EW-01, v0.2.0+).
- Session persistence (save/load).
- 2.5D rendering via CSS perspective/transform/shadows; abstract tile artwork (no licensed assets).

## Completed features (current)

| Feature | Status | Release |
|---------|--------|---------|
| Tile placement + rule validation (MH-01) | ✅ | v0.0.1 |
| Feature system: city, road, monastery, field (MH-02) | ✅ | v0.1.0 |
| Meeple system + scoring mid/end-game (MH-03) | ✅ | v0.1.0 |
| Hot-seat multiplayer 2-5 players (MH-04) | ✅ | v0.1.0 |
| Random AI opponent (MH-05) | ✅ | v0.2.0 |
| 2D Electron desktop GUI (MH-06) | ✅ | v0.3.0 |
| Game end + final scoring (MH-07) | ✅ | v0.2.0 |
| Board zoom + pan (MH-08) | ✅ | v0.4.0 |
| Network multiplayer WebSocket/LAN (EW-01) | ✅ | v0.2.0 |
| Intelligent AI agent via Claude API + MCP (EW-02) | 🔵 Review | v0.6.0 |

## Chosen extensions (Stakeholder decision 04.05.2026)

1. **Netzwerk-Multiplayer (EW-01)** — WebSocket/LAN, game synchronization, high risk → completed v0.2.0
2. **Intelligenter KI-Agent (EW-02)** — Reasoning Model via Claude API, strategic move evaluation

## Non-goals (deferred)

- Expansions (River, Inns & Cathedrals, etc.).
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
| 10 | [10_git-workflow.md](./10_git-workflow.md) | Git branching model (Gitflow), semantic versioning, conventional commits, release checklist |

## Stakeholder meetings

| # | Date | Status |
|---|------|--------|
| 1 | 04.05.2026 | ✅ Abgeschlossen |
| 2 | 11.05.2026 | ✅ Abgeschlossen |
| 3 | 01.06.2026 | 🔵 Vorbereitet — [Notion](https://www.notion.so/Carcassonne-dfae27f8f8af839c9c1281293e1a5af7) |
| 4 | bis 10.06.2026 (Pre-Release Demo) | 🔴 Offen |

## Acceptance criteria (v1.0.0)

- [x] All Must-Haves fully implemented and tested
- [x] 2 extensions stable: Network Multiplayer + Intelligent AI Agent (EW-02 Review)
- [x] Test system documented in writing (`docs/Testsystem.md`)
- [ ] E2E tests automated and runnable
- [ ] Electron app stable on Windows, no crashes
- [ ] Demo passed in final stakeholder meeting
- [ ] Documentation + source code submitted (15.06.2026)
- [ ] Final presentation held

## Guiding principles

- **Core is framework-free.** No imports from React, Electron, or DOM in `src/core/`.
- **Notion is the single source of truth.** All requirements, work packages, and decisions are tracked in the Notion workspace.
- **Correctness over performance.** Board is small (≤72 tiles); choose the clearer algorithm.
- **Feature/segment model is the core complexity.** Spend extra care here; everything else hangs off it.
- **YAGNI.** No abstractions for hypothetical future features.
