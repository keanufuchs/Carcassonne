# 02 — Anforderungen (Agiles Pflichtenheft)

> Anforderungsaufnahme & Spezifikation. Anstelle eines klassischen Lasten-/Pflichtenhefts
> wurde — mit Stakeholder-Freigabe (Meeting #4) — eine **agile Anforderungsdokumentation**
> aus **Epics → User Stories → Arbeitspaketen** geführt.

---

## 1. Lastenheft vs. agiles Pflichtenheft — Begründung

Das **Lastenheft** (das *Was* aus Kundensicht) ergibt sich aus der Aufgabenstellung:
ein regelkonformes Carcassonne-Basisspiel als Desktop-App mit lokalem Multiplayer,
einfachem KI-Gegner und mindestens zwei Erweiterungen.

Das **Pflichtenheft** (das *Wie*) wird im agilen Vorgehen durch den **Product Backlog**
ersetzt: jede Anforderung ist als **User Story** mit Akzeptanzkriterien und als
**Arbeitspaket** in Notion erfasst. Vorteil: es gibt **keine doppelt zu pflegende**
Spezifikation neben dem Backlog — Notion ist die einzige Quelle. Diese Gleichsetzung
wurde vom Stakeholder in Meeting #4 ausdrücklich **freigegeben** (User Story US-D2).

---

## 2. Epic-Struktur

Die Anforderungen sind in **6 Epics** (+ 1 nachträglich erfasstes DevOps-Epic)
gegliedert:

| Epic | Inhalt | Arbeitspakete |
|------|--------|---------------|
| **EPIC-CORE** | Spielkern: Kacheln, Features, Scoring | MH-01/02/03/07 |
| **EPIC-UI** | Oberfläche: Electron + React, 2D/3D | MH-06/08, OPT-05/06/07/08 |
| **EPIC-MULTI** | Hot-Seat + Netzwerk-/Online-Multiplayer | MH-04, EW-01/01b |
| **EPIC-AI** | Zufalls-KI, Heuristik, intelligenter Agent | MH-05, EW-02/02b |
| **EPIC-QS** | Tests, Stabilität, Metriken | QS-01…05 |
| **EPIC-DOC** | Doku, Meetings, Release | PM-* |
| **EPIC-OPS** *(nachträglich)* | CI/CD, Deployment, Desktop-Pakete | OPS-01/02/03 |

---

## 3. User-Story-Katalog (Auszug)

Format: *„Als ‹Rolle› möchte ich ‹Ziel›, um ‹Nutzen›."*
Spalte **Herkunft**: *Anforderung* = aus Aufgabenstellung, *M#n* = aus Stakeholder-Meeting
*(Umsetzung M#n)* = Lieferung in einem späteren Meeting.

### EPIC-CORE

| ID | User Story | Paket | Herkunft |
|----|-----------|-------|----------|
| US-C1 | Als Spieler möchte ich nur regelkonforme Kacheln platzieren können (passende Kanten, Nachbar vorhanden), um ein gültiges Spiel zu garantieren. | MH-01 | Anforderung |
| US-C2 | Als Spieler möchte ich, dass Stadt/Straße/Kloster/Feld beim Platzieren korrekt zusammengeführt werden, um richtige Wertungen zu bekommen. | MH-02 | Anforderung |
| US-C3 | Als Spieler möchte ich Meeples setzen und bei Feature-Abschluss Punkte erhalten, um Partien gewinnen zu können. | MH-03 | Anforderung |
| US-C4 | Als Spieler möchte ich am Spielende eine vollständige Endabrechnung (inkl. Feldwertung) sehen. | MH-07 | Anforderung |
| US-C5 | Als Spieler möchte ich das Basisspiel mit genau 72 Kacheln spielen. | Deck | Anforderung |

### EPIC-UI

| ID | User Story | Paket | Herkunft |
|----|-----------|-------|----------|
| US-U1 | Als Anwender möchte ich das Spiel als Windows-Desktop-App starten, ohne Entwickler-Tools installieren zu müssen. | MH-06 | Anforderung + **M#1** |
| US-U2 | Als Spieler möchte ich das Spielbrett zoomen und verschieben, um große Partien zu überblicken. | MH-08 | **M#1 (neu)** |
| US-U3 | Als Spieler möchte ich jederzeit aktiven Spieler, Punktestand und Meeple-Vorrat sehen. | MH-06 | Anforderung |
| US-U5 | Als Spieler möchte ich zwischen 2D- und 3D-Ansicht umschalten. | OPT-05 | abgeleitet |

### EPIC-MULTI

| ID | User Story | Paket | Herkunft |
|----|-----------|-------|----------|
| US-M1 | Als Gruppe (2–5) möchte ich lokal im Hot-Seat an einem Gerät spielen. | MH-04 | Anforderung |
| US-M2 | Als entfernte Spieler möchten wir eine synchronisierte Online-/LAN-Partie spielen. | EW-01 | Anforderung |
| US-M3 | Als Spieler möchte ich per Spiel-Code einer laufenden Online-Partie beitreten. | EW-01b | **M#3** |
| US-M4 | Als Spieler möchte ich bei Verbindungsabbruch nicht die Partie verlieren (Reconnect/Fallback). | EW-01 | **M#1 (Risiko)** |

### EPIC-AI

| ID | User Story | Paket | Herkunft |
|----|-----------|-------|----------|
| US-A1 | Als Einzelspieler möchte ich gegen einen zufallsbasierten KI-Gegner spielen. | MH-05 | Anforderung |
| US-A2 | Als Spieler möchte ich gegen einen strategisch denkenden KI-Agenten (Claude) spielen. | EW-02 | Anforderung |
| US-A3 | Als Spieler möchte ich auch ohne API-Key bzw. bei Timeout eine sinnvolle KI haben. | EW-02b | **M#3** |

### EPIC-QS

| ID | User Story | Paket | Herkunft |
|----|-----------|-------|----------|
| US-Q1 | Als Stakeholder möchte ich, dass eine 30-minütige Partie ohne Absturz läuft. | QS-02/03 | **M#1** |
| US-Q2 | Als Team möchte ich automatisierte Vollpartien (E2E), um Stabilität reproduzierbar nachzuweisen. | QS-03 | **M#1** *(Umsetzung M#4)* |

> Insgesamt **22 User Stories über 6 Epics**. Mehrere Stories entstanden bzw. schärften
> sich **erst durch Stakeholder-Feedback** (US-U2, US-M3, US-M4, US-A3, US-Q1/Q2, US-D2).
> **US-Q2 (QS-03):** Anforderung in Meeting #1, Lieferung kurz vor Meeting #4.

---

## 4. Arbeitspaket-Status (final)

### 4.1 Must-Have — vollständig erledigt

| ID | Arbeitspaket | Status |
|----|--------------|--------|
| MH-01 | Kachelplatzierung mit Regelvalidierung |  |
| MH-02 | Feature-System (Stadt/Straße/Kloster/Feld, Merge/Union) |  |
| MH-03 | Meeple-System + Wertung (mid-/end-game) |  |
| MH-04 | Hot-Seat-Multiplayer (2–5 Spieler) |  |
| MH-05 | Einfacher KI-Gegner (zufallsbasiert) |  |
| MH-06 | 2D-GUI als Electron-Desktop-App |  |
| MH-07 | Spielende + Endabrechnung |  |
| MH-08 | Spielfeld zoomen & verschieben |  |
| MH-09 | Session-Persistenz |  |

### 4.2 Pflicht-Erweiterungen — erledigt

| ID | Arbeitspaket | Status |
|----|--------------|--------|
| EW-01 | **Netzwerk-Multiplayer** — Client-Server mit autoritativem Backend (REST + WebSocket/Polling) |  |
| EW-01b | Online-/Cloud-Multiplayer — Spiel-Code-Beitritt, serverseitige Persistenz |  |
| EW-02 | **Intelligenter KI-Agent** — LLM (Claude/OpenRouter/OpenAI-kompatibel) mit Tool-Use über MCP-Server |  |
| EW-02b | Heuristik-/Greedy-KI — eigene Spielstufe + Fallback ohne API-Key/Timeout |  |

> **Architektur-Entscheidung:** EW-01 wurde statt P2P-WebSocket als **Client-Server-Modell**
> umgesetzt (autoritatives Backend = einfachere Synchronisation, weniger Cheating-Risiko).
> Das ursprünglich skizzierte Vercel-Deployment wurde durch ein **VPS-Deployment** (OPS-02) ersetzt.

### 4.3 Qualitätssicherung

| ID | Arbeitspaket | Status |
|----|--------------|--------|
| QS-01 | Testsystem-Dokumentation (`docs/`, `specs/08_testing.md`) |  |
| QS-02 | Unit- & Integrationstests (Vitest) |  |
| QS-03 | E2E-Automatisierung (Playwright) + YAML-Szenario-Framework |  |
| QS-05 | Tile-Lab — Entwicklungs-/Visualisierungswerkzeug |  |
| ~~QS-04~~ | ~~Formale Code-Metriken (McCabe/Halstead)~~ | verworfen* |

> **QS-03 (E2E):** Stakeholder-Anforderung aus Meeting #1; technische Umsetzung (Playwright,
> YAML-Szenario-Framework, CI-Gate) erfolgte **erst kurz vor Meeting #4**.

*\* QS-04 wurde bewusst nicht formal umgesetzt; der QS-Nachweis erfolgt stattdessen über
**282 automatisierte Tests + CI-Gating + Code-Reviews**. Begründung & Konsequenz siehe
[Kapitel 06 §4](06_qualitaetssicherung.md).*

### 4.4 DevOps / Betrieb (nachträglich erfasst)

| ID | Arbeitspaket | Status |
|----|--------------|--------|
| OPS-01 | CI/CD-Pipeline (GitHub Actions: Szenario-Tests, Desktop-Build, Deploy) |  |
| OPS-02 | Produktiv-/Staging-Deployment auf VPS (PM2, rsync, SSH) |  |
| OPS-03 | Electron-Desktop-Pakete (macOS `.dmg`) |  |

### 4.5 Optionale Zusatzpakete (über die Pflicht hinaus)

| ID | Arbeitspaket | Status |
|----|--------------|--------|
| OPT-05 | 3D-Spielbrett (Three.js/R3F) + 2D/3D-Umschaltung |  |
| OPT-06 | Prozedurale 3D-Kachelgenerierung aus der Kachel-Topologie |  |
| OPT-07 | Menü-/UI-Theming (Medieval) + animierter GameShowcase |  |
| OPT-08 | Mobile-/Responsive-Layout (Touch, drag-to-place) |  |

**Verworfen / nicht umgesetzt (Archiv):** OPT-01 Großer Meeple · OPT-02 2.5D-CSS (durch
echtes 3D ersetzt) · OPT-03 Erweiterungsfiguren · OPT-04 Android-Port · QS-04 Code-Metriken.

---

## 5. Validierung & Verifikation

Die Qualitätssicherung adressiert beide QS-Dimensionen:

| Dimension | Frage | Nachweis im Projekt |
|-----------|-------|---------------------|
| **Validierung** | Erfüllt die Software die Wünsche des Kunden? | 4 Stakeholder-Demos; Abnahme der Akzeptanzkriterien in Meeting #4. |
| **Verifikation** | Ist die Spezifikation korrekt umgesetzt? | 282 automatisierte Tests (Unit/Integration/E2E/Szenarien), CI-Gate, Code-Reviews. |

---

## 6. Abnahmekriterien (final erfüllt)

- [x] Alle Must-Haves vollständig implementiert und getestet
- [x] 2 Erweiterungen stabil: Netzwerk-Multiplayer + Intelligenter KI-Agent
- [x] Testsystem schriftlich dokumentiert
- [x] E2E-Tests automatisiert lauffähig (Playwright + Szenario-Framework, CI-gated)
- [x] Electron-App lauffähig (macOS CI) + Web-Deployment
- [x] Demo im Stakeholder-Meeting #4 bestanden
- [x] Abschlusspräsentation gehalten (22.06.2026)

---

Weiter mit **[Kapitel 03 — Architektur & Design](03_architektur-design.md)**
