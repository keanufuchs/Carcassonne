# Stakeholder Meeting #3 — Vorbereitung

**Datum:** 01.06.2026 (bis 02.06.2026)
**Git-Tag:** `stakeholder-v3-2026-06-01`
**Letzte Version:** v0.6.0
**Vorheriges Meeting:** 11.05.2026 (Meeting #2)

---

## 1. Erledigte Arbeitspakete seit Meeting #2

| ID | Paket | Status | Version |
|----|-------|--------|---------|
| MH-06 | 2D-GUI als Electron Desktop-App | ✅ Erledigt | v0.3.0 |
| MH-08 | Spielfeld Zoom + Bewegen | ✅ Erledigt | v0.4.0 |
| EW-02 | Intelligenter KI-Agent (Claude API + MCP) | ✅ Erledigt | v0.6.0 |
| QS-01 | Testsystem-Dokumentation | ✅ Erledigt | — |
| QS-02 | Unit Tests & Integrationstests (Vitest) | 🔵 Fortschritt | 84 Tests |

---

## 2. Feature-Demonstration: EW-02 — Intelligenter KI-Agent

### Was wurde implementiert

**Architektur: Claude API + MCP Server**

```
Carcassonne App (Electron)
    │
    └── intelligent.ts (AI-Entscheidungslogik)
           ├── Claude API (claude-sonnet-4-6)
           │   └── Tool Use: list_legal_moves, get_board_features,
           │                  get_player_status, submit_move
           │
           └── MCP AI Server (localhost:3002)
                   ├── POST /tools/list_legal_moves
                   ├── POST /tools/get_board_features
                   └── POST /tools/get_player_status
```

**Ablauf eines KI-Zuges:**
1. Claude erhält Spielkontext + Tool-Definitionen
2. Claude ruft `list_legal_moves` auf → MCP Server gibt alle legalen Züge zurück
3. Claude ruft optional `get_board_features` / `get_player_status` auf
4. Claude ruft `submit_move` mit der gewählten Platzierung auf
5. Bei Fehler/Timeout → automatischer Fallback auf Heuristic AI

**Fallback-Strategie:**
- API-Key nicht gesetzt → Heuristic AI
- API-Timeout (20s) → Heuristic AI
- Ungültiger Zug → Heuristic AI
- MCP-Server offline → Tools lokal ausgeführt (gleiche Logik)

### Demo-Anleitung

```bash
# 1. Alle Server starten
npm run dev:full

# 2. App öffnen: http://localhost:5173
# 3. "Local" Tab → Spieler 2 = "🤖 Claude AI"
# 4. API-Key setzen: VITE_ANTHROPIC_API_KEY=sk-ant-... npm run dev:full
# 5. Spiel starten → Claude-Spieler macht strategische Züge
```

**MCP Server direkt testen:**
```bash
npm run mcp
# Health-Check:
curl http://localhost:3002/health
```

---

## 3. Testsystem-Stand

| Ebene | Tool | Tests | Status |
|-------|------|-------|--------|
| Unit Tests | Vitest | 84 Tests | ✅ Alle grün |
| E2E Tests | Playwright | 7 Tests | ✅ Alle grün |
| Coverage Core | Istanbul | ~70-95% | 🔵 In Ausbau |

**Dokumentation:** `docs/Testsystem.md` (vollständig, v1.0, Stand 30.05.2026)

---

## 4. Gesamter Feature-Status

| ID | Arbeitspaket | Status |
|----|-------------|--------|
| MH-01 | Kachelplatzierung + Regelvalidierung | ✅ Erledigt |
| MH-02 | Feature-System (Stadt, Straße, Kloster, Feld) | ✅ Erledigt |
| MH-03 | Meeple-System + Punktewertung | ✅ Erledigt |
| MH-04 | Hot-Seat Multiplayer (2–5 Spieler) | ✅ Erledigt |
| MH-05 | Zufallsbasierter KI-Gegner | ✅ Erledigt |
| MH-06 | 2D-GUI als Electron Desktop-App | ✅ Erledigt |
| MH-07 | Spielende + Endabrechnung | ✅ Erledigt |
| MH-08 | Spielfeld Zoom + Bewegen | ✅ Erledigt |
| EW-01 | Netzwerk-Multiplayer (WebSocket/LAN) | ✅ Erledigt |
| EW-02 | Intelligenter KI-Agent (Claude API + MCP) | ✅ Erledigt |

**Alle Must-Haves und beide Erweiterungen implementiert. ✅**

---

## 5. Offene Arbeitspakete bis Meeting #4

| ID | Paket | Priorität | Deadline |
|----|-------|-----------|----------|
| QS-02 | Unit Tests ausbauen (Core ≥ 95%) | Hoch | 08.06.2026 |
| QS-03 | E2E-Testautomatisierung (vollständige Partie) | Mittel | 08.06.2026 |
| QS-04 | Code-Metriken (McCabe < 15) | Mittel | 08.06.2026 |
| PM-03 | Stakeholder Meeting #4 (Pre-Release Demo) | Hoch | bis 10.06.2026 |

---

## 6. Risiken & offene Punkte

| Risiko | Schweregrad | Maßnahme |
|--------|-------------|----------|
| API-Key für Demo benötigt | Mittel | `.env` mit Key vorbereiten, Heuristic als Fallback |
| Claude-Antwortzeit variabel (5-15s) | Niedrig | 20s Timeout + Heuristic-Fallback |
| Electron-Windows-Build ungetestet | Mittel | Windows-Test vor Meeting #4 |
| E2E-Tests noch nicht vollständig | Niedrig | Bis QS-03-Deadline (08.06.) |

---

## 7. Git-Stand

```
Branch: main
Tag: stakeholder-v3-2026-06-01
Version: 0.6.0
Commits seit Meeting #2:
  - feat(ai/mcp): intelligent AI via Claude tool use + MCP server
  - feat(ai): add MCP AI server (server/mcp-ai.ts, port 3002)
  - chore: add mcp script, update dev:full
```

---

## 8. Agenda-Vorschlag Meeting #3

1. **Demo EW-02** — Claude AI spielt gegen menschlichen Spieler (5 min)
2. **Demo EW-01** — Netzwerk-Multiplayer (3 min)
3. **QS-Stand** — Testsystem, 84 Unit-Tests, Testsystem-Dok (3 min)
4. **Planung bis Meeting #4** — Offene QS-Pakete, Abgabe 15.06. (5 min)
5. **Feedback & Fragen** (5 min)

---

*Erstellt: 31.05.2026 | Nächstes Meeting: #4 bis 10.06.2026 (Pre-Release Demo)*
