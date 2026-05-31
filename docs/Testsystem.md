# Testsystem-Dokumentation — Carcassonne

**Dokument:** `docs/Testsystem.md`
**Version:** 1.0
**Stand:** 30.05.2026
**Autor:** Team Carcassonne
**Grundlage:** Vorgaben §3 (Analytische QS), Stakeholder-Meetings 04.05.2026 + 11.05.2026

---

## 1. Teststrategie

### 1.1 Testphilosophie

Die Qualitätssicherung des Carcassonne-Projekts folgt einem **mehrschichtigen Ansatz** (Testpyramide), der von isolierten Unit-Tests über Integrationstests bis zu automatisierten End-to-End-Tests reicht. Jede Schicht hat einen klar definierten Scope, eigene Werkzeuge und quantitative Abdeckungsziele.

**Leitprinzipien:**

1. **Core-Logik zuerst** — Die spiellogische Schicht (`src/core/`) wird mit höchster Priorität getestet, da sich hier die komplexesten Fehler verbergen.
2. **Tester ≠ Entwickler** — Gemäß Vorgaben §3 werden Tests und Produktionscode von verschiedenen Personen geschrieben.
3. **TDD wo sinnvoll** — Neue Core-Funktionen werden testgetrieben entwickelt (Red → Green → Refactor).
4. **Automatisierung vor Release** — E2E-Tests laufen automatisiert vor jedem Stakeholder-Meeting.

### 1.2 Testebenen im Überblick

| Ebene | Tool | Scope | Ziel | Ausführung |
|-------|------|-------|------|------------|
| **Unit Tests** | Vitest | Core-Logik (`tile`, `feature`, `board`, `scoring`, `deck`, `game`) | ≥ 95% lines, ≥ 90% branches | `npm test` |
| **Integration Tests** | Vitest | Controller-Flows, vollständige Turn-Zyklen | ≥ 80% lines | `npm test` |
| **System Tests** | Vitest | Vollständige Spielabläufe, KI-Integration, Spielregel-Konformität | Regel-Konformität | `npm test` |
| **E2E Tests** | Playwright | UI + Backend, vollständige Spielpartien | UI-Funktionalität, User Flows | `npm run test:e2e` |

---

## 2. Testebenen im Detail

### 2.1 Unit Tests (Vitest)

**Scope:** Isolierte Tests für jede Core-Datei. Keine externen Abhängigkeiten, keine UI.

**Test-Runner:** [Vitest](https://vitest.dev/) v1.x
**Konfiguration:** `vitest.config.ts`
**Testverzeichnis:** `src/core/**/*.test.ts`

**Getestete Module:**

| Modul | Datei(en) | Test-Datei | Status |
|-------|-----------|------------|--------|
| Tile Rotation | `src/core/tile/rotation.ts` | `rotation.test.ts` | ✅ 13 Tests |
| Board Placement | `src/core/board/placement.ts` | `placement.test.ts` | ✅ 9 Tests |
| Scoring Majority | `src/core/scoring/majority.ts` | `majority.test.ts` | ✅ 4 Tests |
| Feature Merge | `src/core/feature/merge.ts` | *ausstehend* | 🔴 |
| Feature Completion | `src/core/feature/completion.ts` | *ausstehend* | 🔴 |
| Scoring (Mid-Game) | `src/core/scoring/midGame.ts` | *ausstehend* | 🔴 |
| Scoring (End-Game) | `src/core/scoring/endGame.ts` | *ausstehend* | 🔴 |
| Farmers | `src/core/scoring/farmers.ts` | *ausstehend* | 🔴 |
| Game Flow | `src/core/game/Game.ts` | *ausstehend* | 🔴 |
| Deck | `src/core/deck/Deck.ts` | *ausstehend* | 🔴 |
| Segments | `src/core/feature/segments.ts` | *ausstehend* | 🔴 |
| Meeple Logic | `src/core/game/Game.ts` (placeMeeple) | *ausstehend* | 🔴 |

**Test-Helfer:** `tests/helpers/fixtures.ts`, `tests/helpers/prototypes.ts`

**Befehl:**
```bash
npm test              # Einmalig
npm run test:watch    # Watch-Mode
```

### 2.2 Integrationstests (Vitest)

**Scope:** Controller-Flows über die öffentliche API (`GameController`), vollständige Turn-Zyklen, Phasen-Übergänge.

**Testverzeichnis:** `tests/controller/`

**Testfälle (aus `specs/08_testing.md` §8.3.11):**

- Vollständiger 2-Spieler-Turn-Zyklus: `startGame` → `drawTile` → `rotatePending` → `placeTile` → `skipMeeple`
- Subscriber-Benachrichtigungen: Genau eine Notification pro Command
- Fehlerpfade: Falsche Phase, doppeltes Ziehen

**Status:** 🔴 Ausstehend

### 2.3 Systemtests (Vitest)

**Scope:** Vollständige Spielpartien mit Zufalls-KI, Regelkonformität, Scoring-Korrektheit über ganze Spiele.

**Testverzeichnis:** `tests/system/`

**Testfälle:**

- Vollständige 2-Spieler-Partie mit RandomAI endet korrekt
- Alle 72 Kacheln werden platziert (keine hängen gebliebenen)
- Scoring-Summe am Spielende entspricht erwarteter Gesamtpunktzahl

**Status:** 🔴 Ausstehend

### 2.4 E2E-Tests (Playwright)

**Scope:** Browser-basierte Tests der vollständigen Anwendung (Electron/Web).

**Test-Runner:** [Playwright](https://playwright.dev/) v1.x
**Konfiguration:** `playwright.config.ts`
**Testverzeichnis:** `e2e/`

**Aktuelle Tests (6):**

1. `draw tile – tile appears in preview` — Tile erscheint im Preview nach Draw
2. `place tile – tile appears on board` — Platzierung auf Brett sichtbar
3. `rotate tile – rotation updates visually` — Rotation ändert `data-rotation`
4. `meeple phase – skip advances turn` — Skip-Meeple wechselt Spieler
5. `meeple phase – targets render as clickable circles` — Meeple-Targets erscheinen
6. `meeple phase – clicking target advances turn` — Meeple-Platzierung funktioniert
7. `invalid placement – rejected` — Illegale Platzierung abgelehnt

**Ausstehende E2E-Tests (QS-03):**

- Vollständige 2-Spieler-Partie mit RandomAI (`data-testid="ai-move-btn"`)
- Spielerstand-Anzeige nach jedem Zug korrekt
- Hot-Seat Spielerwechsel funktioniert
- Game-Over Screen mit `winner-banner`
- Keine JS-Exceptions während der Partie
- Vollständige Partie mit allen 72 Kacheln

**Befehl:**
```bash
npm run test:e2e              # Headless
npx playwright test --headed  # Mit Browser sichtbar
npx playwright show-report    # Letzten Report anzeigen
```

**Dev-Server:** Playwright startet automatisch `npm run dev` auf Port 5173 (`reuseExistingServer: true`).

---

## 3. Abdeckungsziele

| Modul | C0 (Anweisungsüberdeckung) | C1 (Zweigüberdeckung) | Messung |
|-------|---------------------------|----------------------|---------|
| `src/core/` | ≥ 95% | ≥ 90% | Istanbul via Vitest |
| `src/controller/` | ≥ 80% | — | Istanbul via Vitest |
| `src/ui/` | Smoke only | — | Manuell / Playwright |

**Aktuelle Abdeckung (Schätzung, 30.05.2026):**

- `core/tile/rotation.ts`: ~90% lines, ~85% branches
- `core/board/placement.ts`: ~70% lines
- `core/scoring/majority.ts`: ~60% lines
- Restliche Core-Module: 0% (keine dedizierten Tests)

**Ziel bis Meeting #4 (10.06.):** Alle Core-Module ≥ 95% lines.

---

## 4. Review-Workflow

### 4.1 Task-Status

```
Offen → In Bearbeitung → Review → Erledigt
                              ↓
                         Blockiert
```

### 4.2 Review-Kriterien

Jeder Task durchläuft folgende Checks vor dem Merge:

1. **Code-Review** durch anderes Teammitglied (Tester ≠ Entwickler)
2. **Alle Tests grün** (`npm test` ohne Fehler)
3. **McCabe-Zahl < 15** pro Funktion (eslint-plugin-complexity)
4. **Keine neuen Lint-Fehler** (`npm run lint`)
5. **E2E-Tests grün** (bei UI-Änderungen)

### 4.3 Merge-Strategie

- Feature-Branch → PR nach `develop`
- PR erfordert: 1 Approval + CI grün
- `develop` → `main` nur via `release/*` Branch
- Tags nur auf `main`

---

## 5. Verantwortlichkeiten

| Rolle | Zuständigkeit |
|-------|--------------|
| **Core-Entwickler** | Implementierung der Spiellogik in `src/core/` |
| **Test-Entwickler** | Unit-Tests für Core-Module (andere Person als Core-Entwickler) |
| **UI-Entwickler** | React-Komponenten + Playwright E2E-Tests |
| **QS-Verantwortlicher** | Teststrategie, Coverage-Reporting, Metriken (QS-04) |

**Tester ≠ Entwickler (Vorgaben §3):** Jedes Core-Modul wird von einer anderen Person getestet als derjenigen, die es implementiert hat.

---

## 6. Code-Metriken (QS-04)

### 6.1 Metriken im Überblick

| Metrik | Tool | Grenzwert |
|--------|------|-----------|
| **McCabe (zyklomatische Komplexität)** | `eslint-plugin-complexity` | < 15 pro Funktion |
| **Lines of Code (LoC)** | `ts-prune` / `cloc` | Kein Hard-Limit, Überwachung |
| **Halstead (Volume, Difficulty, Effort)** | `typhonjs-escomplex` | Report im CI |

### 6.2 Messzeitpunkte

- Vor jedem Stakeholder-Meeting
- Vor jedem Release-Tag
- Laufend im CI (GitHub Actions)

### 6.3 CI-Pipeline (GitHub Actions)

```yaml
on:
  push:
    branches: [develop]
  pull_request:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

---

## 7. Test-Fixtures und Hilfsfunktionen

### 7.1 `tests/helpers/fixtures.ts`

- `freshGame(playerNames?: string[])` — Gibt einen gestarteten `GameState` mit seeded RNG zurück
- `place(state, prototype, coord, rotation)` — Wrapper für `placeTileInternal`, assertet Erfolg
- `forceEndGame(state)` — Leert das Deck und löst End-Game-Scoring aus

### 7.2 `tests/helpers/prototypes.ts`

- Minimal hand-crafted Tile-Prototypen für Tests (entkoppelt von der Base-Game-Distribution)
- Beispiel: `ROAD_STRAIGHT`, `CITY_WITH_SHIELD`, `MONASTERY`, `ROAD_END_AT_CITY`

---

## 8. Referenzen

- [`specs/08_testing.md`](../specs/08_testing.md) — Detaillierte Test-Cases und Code-Beispiele
- [`specs/01_architecture.md`](../specs/01_architecture.md) — Architektur-Übersicht
- [`specs/06_game-flow.md`](../specs/06_game-flow.md) — Spielablauf und Phasen
- [`specs/09_meeples.md`](../specs/09_meeples.md) — Meeple-System und Test-Selektoren
- [`CLAUDE.md`](../CLAUDE.md) — Projekt-Kontext und Entwicklungs-Guidelines
