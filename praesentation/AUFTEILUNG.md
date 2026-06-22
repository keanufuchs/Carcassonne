# Aufteilung der Präsentation auf 4 Personen

Gesamtzeit: 20 Minuten  
Folien: 29 (Folie 29 QR optional als Puffer)  
Ziel: Jede Person spricht ca. 5 Minuten. Die Übergaben folgen den fünf Agenda-Blöcken und den drei Pflichtfragen in der Präsentation.

## Kurzüberblick

| Person | Inhalt | Folien | Zeit |
|--------|--------|--------|------|
| Person 1 | Einstieg, Pflichtfrage 1 (Was & Warum?) | Folien 1–6 | 5:00 min |
| Person 2 | Prozess & Anforderungen (Teil 2) | Folien 7–10 | 5:00 min |
| Person 3 | Architektur, Design, Pflichtfrage 2 (Code-Einstieg?) | Folien 11–17 | 5:00 min |
| Person 4 | Umsetzung, Start, Qualität, Abschluss | Folien 18–29 | 5:00 min |

## Person 1 — Einstieg, Pflichtfrage 1 (Was & Warum?)

Zeit: 5:00 Minuten  
Folien 1–6:

- 1: Titel
- 2: Agenda
- 3: Pflichtfrage 1 — Was & Warum?
- 4: Das Produkt in einem Satz
- 5: Rahmen des Projekts
- 6: Anforderungen im Überblick

Inhaltlicher Fokus:

- Kurz erklären, dass es um eine digitale Carcassonne-Umsetzung als Projektabgabe geht.
- Produktidee: vollständiges Basisspiel, Desktop & Web, 2–5 Spieler — Kacheln legen, Meeples setzen, Punkte erzielen.
- Rahmen klären: SE-Projekt, Electron + Web, Notion als Single Source of Truth.
- Anforderungen: **9 Must-Haves** und **3 Erweiterungen** (Netzwerk, Reasoning AI, 3D) — alle erfüllt; 3D agil aus Stakeholder-Feedback (#3).

Übergabe:

> „Klar ist, was wir gebaut haben und welche Anforderungen dahinterstanden. Als Nächstes: wie wir das Projekt organisiert und gesteuert haben."

## Person 2 — Prozess & Anforderungen (Teil 2)

Zeit: 5:00 Minuten  
Folien 7–10:

- 7: Teil 2 — Prozess & Anforderungen
- 8: Vorgehensweise: agil (Scrum-orientiert)
- 9: 4 Stakeholder-Meetings als Review-Punkte
- 10: Backlog statt klassischem Pflichtenheft

Inhaltlicher Fokus:

- Agile Vorgehensweise erklären: kurze Schleifen, Demos, eingeplante Änderungen.
- Stakeholder-Meetings als Review-Punkte — inkl. Meeting #3 (3D beschlossen) und #4 (Abnahme).
- Backlog als lebendiges Pflichtenheft: 6 Epics, 22 User Stories, Arbeitspakete in Notion.
- Bewusst **keine** Architektur hier — das folgt in Teil 3.

Übergabe:

> „Prozess und Anforderungen stehen. Jetzt die Architektur: Schichten, Domänenmodell und die zentralen Designentscheidungen."

## Person 3 — Architektur, Design, Pflichtfrage 2 (Code-Einstieg?)

Zeit: 5:00 Minuten  
Folien 11–17:

- 11: Teil 3 — Architektur & Design
- 12: Strikte 4-Schichten-Architektur
- 13: Domänenmodell: ein zentraler GameState
- 14: Spielzug als Zustandsautomat
- 15: Zentrale Entscheidungen — begründet
- 16: Pflichtfrage 2 — Code-Einstieg?
- 17: Dieselben Schichten — konkret im Code

Inhaltlicher Fokus:

- 4-Schichten-Modell: Electron → UI (React/Three.js) → Controller → Core.
- Zentraler `GameState`, reine Funktionen, Meeples am Feature.
- Spielzug als Zustandsautomat: PLACING_TILE → PLACING_MEEPLE → nächster Spieler / GAME_OVER.
- Wichtigste Designentscheidungen begründen (Framework-freier Core, Feature-Graph, Client-Server, MCP-KI).
- **Pflichtfrage 2:** Einstieg `electron/main.ts` → `App.tsx`, Schichten im Repo, Lesepfade für Logik/Wertung/KI/Tests.

Übergabe:

> „Architektur und Code-Einstieg sind geklärt. Jetzt zeigen wir die konkrete Umsetzung: UI, Spielkern, Netzwerk und KI."

## Person 4 — Umsetzung, Start, Qualität, Abschluss

Zeit: 5:00 Minuten  
Folien 18–29:

- 18: Teil 4 — User Interface & Umsetzung
- 19: Oberfläche — eine Codebasis, mehrere Ziele
- 20: Spielkern & Wertung
- 21: Netzwerk-Multiplayer — autoritatives Backend (EW-01)
- 22: Reasoning AI — drei Stufen, mit Fallback (EW-02)
- 23: Pflichtfrage 3 — App starten?
- 24: Drei Wege
- 25: Teil 5 — Qualitätssicherung
- 26: Testpyramide & Kennzahlen
- 27: Abnahmekriterien — erfüllt
- 28: Vielen Dank
- 29: Jetzt spielen (QR) — optional

Inhaltlicher Fokus:

- UI: eine Codebasis, 2D ↔ 3D, Zoom/Pan, nur legale Züge anklickbar.
- Spielkern & Wertung als reine, testbare Logik (72-Kachel-Deck, Feature-Merge, mid-/end-game).
- Netzwerk: autoritativer Server, derselbe Core wie Client.
- KI: Zufall → Heuristik → Reasoning AI (MCP), mit Fallback.
- **Pflichtfrage 3:** carcassonne.spelk.de, `npm run dev:full`, Desktop-App.
- Testpyramide (Unit, YAML-Szenarien, E2E), CI-Gate; Kennzahlen nur als Beleg.
- Abnahmekriterien: 9/9 Must-Haves, 3/3 Erweiterungen, v1.0.0, Live-Deployment.
- QR-Folie nur nutzen, wenn Zeit übrig ist oder für die Fragerunde.

Abschluss:

> „Zusammengefasst: spielbare Carcassonne-Version mit sauber getrenntem Spielkern, drei Erweiterungen und erfüllten Abnahmekriterien — live unter carcassonne.spelk.de. Vielen Dank."

## Zeitpuffer

Person 4 hat mehr Folien, aber Abschnittsfolien und QR sind kurz. Bei Zeitdruck zuerst kürzen: Detailbeispiele in Folien 20–22, nicht die Übergaben oder Pflichtfragen.

Empfohlene Zielzeiten:

- Person 1: 4:45 min + 0:15 Übergabe
- Person 2: 4:45 min + 0:15 Übergabe
- Person 3: 4:45 min + 0:15 Übergabe
- Person 4: 4:00 min Inhalt + 0:30 Abschluss/QR
