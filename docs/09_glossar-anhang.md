# 09 — Glossar & Anhang

---

## 1. Glossar

### Spielbegriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Tile / Kachel** | Quadratisches Landschaftsplättchen mit vier Kanten (N/O/S/W); das Basisspiel hat 72 + 1 Startkachel. |
| **Segment** | Teilgebiet einer Kachel (z. B. ein Straßenstück, eine Stadthälfte). |
| **Feature / Gebiet** | Zusammenhängendes Spielelement über eine oder mehrere Kacheln: **Stadt (CITY)**, **Straße (ROAD)**, **Kloster (MONASTERY)**, **Wiese/Feld (FIELD)**. |
| **Meeple** | Spielfigur, die ein Feature beansprucht; bringt bei Fertigstellung Punkte. |
| **Wappen (Shield)** | Stadt-Symbol, das in der Stadtwertung doppelt zählt. |
| **Mid-game scoring** | Sofortwertung bei Fertigstellung eines Gebiets. |
| **End-game scoring** | Endabrechnung für unvollständige Gebiete + Wiesenwertung. |
| **Bauer / Farmer** | Meeple auf einer Wiese; wertet am Spielende je angrenzender *fertiger* Stadt. |
| **Mehrheit (Majority)** | Wer die meisten Meeples auf einem Gebiet hat, bekommt die Punkte; bei Gleichstand alle Beteiligten voll. |
| **Hot-Seat** | Lokaler Mehrspielermodus an einem Gerät. |

### Technische Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Core** | Framework-freie Spiellogik (`src/core/`). |
| **Controller** | Fassade zwischen UI und Core (`GameController`/`NetworkController`). |
| **GameState** | Zentrale Zustands-Datenstruktur des Spiels. |
| **Pub/Sub** | Publish-/Subscribe-Mechanismus, über den die UI auf Zustandsänderungen reagiert. |
| **FSM** | Finite State Machine — die Phasen eines Spielzugs. |
| **MCP** | Model Context Protocol — Server, der dem KI-Agenten Analyse-Tools bereitstellt. |
| **LLM** | Large Language Model — Basis des Reasoning-AI-KI-Agenten (EW-02). |
| **Reasoning AI** | Spielmodus (EW-02) im Setup-Screen; nutzt ein OpenAI-kompatibles LLM mit Tool-Use über MCP. Nicht an einen einzelnen Anbieter gebunden. |
| **E2E** | End-to-End-Test (Playwright) über UI + Backend. |
| **Szenario** | Deterministischer Regeltest in YAML gegen die echte Engine. |
| **GitFlow** | Branch-Modell mit `main`/`develop`/`feature`/`release`/`hotfix`. |

---

## 2. Arbeitspaket-Kürzel

| Präfix | Bedeutung |
|--------|-----------|
| **MH-** | Must-Have (Pflichtfunktion des Basisspiels) |
| **EW-** | Erweiterung (Wahlpflicht; 2 gewählt: Netzwerk + KI) |
| **QS-** | Qualitätssicherung / Testing |
| **OPS-** | DevOps / Betrieb (CI/CD, Deployment, Pakete) |
| **OPT-** | Optionale Zusatzpakete |
| **PM-** | Projektmanagement (Meetings, Doku, Release) |
| **US-** | User Story (agile Anforderung) |
| **EPIC-** | Epic (Bündel zusammengehöriger Stories/Pakete) |

---

## 3. Abnahmekriterien (final erfüllt)

- [x] Alle Must-Haves vollständig implementiert und getestet
- [x] 2 Erweiterungen stabil: Netzwerk-Multiplayer (EW-01) + Intelligenter KI-Agent (EW-02)
- [x] Testsystem schriftlich dokumentiert (`docs/`, `specs/08_testing.md`)
- [x] E2E-Tests automatisiert lauffähig (Playwright + Szenario-Framework, CI-gated)
- [x] Electron-App lauffähig (macOS-Builds via CI) + Web-Deployment
- [x] Demo im Stakeholder-Meeting #4 bestanden
- [x] Abschlusspräsentation gehalten (22.06.2026)

---

## 4. Release- & Meilenstein-Übersicht

| Datum | Meilenstein |
|-------|-------------|
| 17.–23.02.2026 | Anforderungsanalyse (6 Epics, Must-Haves, 2 Erweiterungen gewählt) |
| 16.04.2026 | Release v0.0.1 (interner MVP) |
| 04.05.2026 | Stakeholder-Meeting #1 (Kickoff) |
| 11.05.2026 | Stakeholder-Meeting #2 |
| 01.06.2026 | Stakeholder-Meeting #3 |
| ~10.06.2026 | Stakeholder-Meeting #4 (Pre-Release Demo, Freigabe agile Doku, **Abnahme E2E/QS-03**) |
| 22.06.2026 | **Release `v1.0.0`** (Git-Tag auf `main` + GitHub Release) · Live: carcassonne.spelk.de · Doku: [GitHub Pages](https://keanufuchs.github.io/Carcassonne/) |
| 22.06.2026 | Abschlusspräsentation + Doku-Abgabe |

> **Versionierungshinweis:** Maßgeblicher öffentlicher Release ist **`v1.0.0`**. Frühere
> Dev-Tags (`v0.1.0`–`v0.6.0`, `stakeholder-v3-2026-06-01`) waren interne
> Planungs-Meilensteine (siehe [Kapitel 01 §5.3](01_projektmanagement.md)).

---

## 5. Quellen- & Verweisverzeichnis

### Im Repository

| Quelle | Inhalt |
|--------|--------|
| `README.md` | Projekt-Schnellstart, Skripte, KI-/MCP-Setup |
| `CLAUDE.md` | Entwicklungs-/Architektur-Richtlinien |
| `specs/00_vorgaben.md` | Formale Aufgabenstellung & Vorgaben |
| `specs/01_architecture.md` | Schichtenarchitektur, Modul-Map |
| `specs/02_domain-model.md` | Domänenmodell |
| `specs/03_tile-system.md` · `04_feature-system.md` · `05_scoring.md` | Kacheln, Features, Wertung |
| `specs/06_game-flow.md` · `07_api.md` | Spielablauf, API |
| `specs/08_testing.md` | Teststrategie & QS-Konzept |
| `specs/09_meeples.md` | Meeple-Regeln & Test-Selektoren |
| `specs/10_git-workflow.md` | Git-/Release-Workflow |
| `docs/` | Testsystem-Dokumentation, Meeting-Vorbereitungen |
| `tests/scenarios/README.md` | Autoren-Leitfaden für YAML-Szenarien |

### Extern

| Quelle | Inhalt |
|--------|--------|
| Notion-Workspace *Carcassonne* | Single Source of Truth: Backlog, User Stories, Meeting-Protokolle |
| [carcassonne.spelk.de](https://carcassonne.spelk.de) | Live-Web-App |
| GitHub-Repository / Release `v1.0.0` | Quellcode, CI, Release-Artefakte (DMG/EXE) |

---

## 6. Team & Rollen

Das Projekt wurde als selbstorganisiertes Studierendenteam (3–6 Personen) umgesetzt; die
Implementierung war auf alle Mitglieder verteilt. Für die Qualitätssicherung galt das
Prinzip **Tester ≠ Entwickler** (Reviews durch eine jeweils andere Person). Konkrete
Zuordnungen sind in der Git-Historie (Commits/PRs) und im Notion-Workspace dokumentiert.

---

Zurück zur **[Übersicht (README)](README.md)**
