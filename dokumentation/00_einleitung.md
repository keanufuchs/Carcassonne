# 00 — Einleitung & Zielsetzung

> **Pflichtfrage 1: „Was soll das Ganze?"** — Rahmen, Ziele und Anforderungen.

---

## 1. Worum geht es? (Das Produkt in einem Absatz)

Ziel des Projekts ist die **vollständige digitale Umsetzung des Brettspiels
Carcassonne (Basisspiel)** als Computerspiel. Spieler legen abwechselnd quadratische
Landschaftskacheln (Städte, Straßen, Klöster, Wiesen) an ein gemeinsames Spielfeld,
setzen ihre Spielfiguren („Meeples") auf Gebiete und erhalten Punkte, sobald diese
Gebiete vollständig sind. Wer am Spielende die meisten Punkte hat, gewinnt.

Umgesetzt wurde das Spiel als **Desktop-Anwendung (Electron)** *und* als **Web-App**
([carcassonne.spelk.de](https://carcassonne.spelk.de)), spielbar zu **2–5 Spielern**
— lokal am selben Gerät („Hot-Seat"), über das Netzwerk oder gegen Computergegner
unterschiedlicher Stärke.

---

## 2. Rahmen des Projekts


| Aspekt                         | Beschreibung                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Auftraggeber / Stakeholder** | Prof. Dr. Martin Hüfner agiert als Kunde, Auftraggeber und Stakeholder.                         |
| **Team**                       | Keanu, Neo, Paul & Jan (Selbstorganisation, Aufgabenverteilung auf alle Mitglieder).            |
| **Art**                        | Studentisches Software-Engineering-Projekt, das den **gesamten Entwicklungszyklus** durchläuft. |
| **Bewertung**                  | Je 50 % Dokumentation und Abschlusspräsentation.                                                |
| **Abschlusspräsentation**      | 22.06.2026                                                                                      |
| **Finaler Release**            | `v0.1.0` (21.06.2026), zusätzlich als Web-App live.                                             |
| **Anforderungsquelle**         | Notion-Workspace *Carcassonne* als verbindliche Single Source of Truth.                         |


Die formalen Vorgaben sind in `[specs/00_vorgaben.md](../specs/00_vorgaben.md)` festgehalten.

---

## 3. Ziele

### 3.1 Produktziele

- Ein **regelkonformes** Carcassonne-Basisspiel: Nur gültige Spielzüge sind erlaubt.
- **Vollständige Wertung**: Zwischenwertung (mid-game) bei Fertigstellung von Gebieten
und Endabrechnung (end-game) inkl. der komplexen **Wiesen-/Bauern-Wertung**.
- **Mehrere Spielmodi**: Hot-Seat (lokal), Netzwerk-Multiplayer, Mensch gegen KI.
- **Stabilität**: Eine vollständige Partie läuft ohne Absturz durch.
- **Wertige Präsentation**: Ansprechende 2D-Oberfläche, optional 3D-Ansicht.

### 3.2 Projekt-/Prozessziele (laut Vorgaben)

Das Projekt muss den **gesamten Zyklus der Anwendungsentwicklung** durchlaufen und
dokumentieren — jede getroffene Entscheidung ist zu **begründen**:

1. Wahl der **Vorgehensweise** (klassisch vs. agil) → [Kapitel 01](01_projektmanagement.md)
2. **Anforderungsaufnahme** (Requirements Management) → [Kapitel 02](02_anforderungen.md)
3. **Spezifikation** (Lasten-/Pflichtenheft *oder* Epics & User Stories) → [Kapitel 02](02_anforderungen.md)
4. **QS-Management** (Teststrategie) → [Kapitel 06](06_qualitaetssicherung.md)
5. **Design & Architektur** (z. B. UML) → [Kapitel 03](03_architektur-design.md)
6. **User Interface** → [Kapitel 04](04_user-interface.md)
7. **Implementierung** (mit Versionierung/Git) → [Kapitel 05](05_implementierung.md)
8. **Dokumentation** (dieses Dokument)
9. **Rollout** (Release + Präsentation) → [Kapitel 01 §6](01_projektmanagement.md)

### 3.3 Entwicklungsreihenfolge (Kern zuerst, Optik später)

Die Entwicklung verlief bewusst **von den Kernfunktionen hin zu den optionalen Extras**.
Zuerst wurde die Spiellogik tragfähig gemacht: dass Kacheln eine korrekte Logik besitzen
und regelkonform aneinandergelegt werden können, dass Gebiete richtig erkannt werden (was
eine Straße, was eine Stadt ist) und dass anschließend Meeples gesetzt werden können. Erst
als diese Grundstruktur stabil lief, wurde die 3D-Ansicht angegangen.

**Begründung:** Die Grundstruktur muss zuerst stehen. Hätte man mit der 3D-Darstellung
begonnen, wäre die anfängliche Implementierung deutlich komplexer geworden — zumal die
3D-Kacheln ohnehin **aus demselben Datenmodell** generiert werden, das die Spiellogik
liefert (siehe [Kapitel 04 §6](04_user-interface.md)). Ein tragfähiger, framework-freier
Kern war damit die Voraussetzung, auf der die Optik überhaupt sinnvoll aufsetzen konnte.

---

## 4. Anforderungen (Überblick)

Die Anforderungen wurden aus der Aufgabenstellung abgeleitet und im agilen Backlog
(Notion) als Arbeitspakete geführt. Eine vollständige Auflistung mit Epics, User
Stories und Status findet sich in **[Kapitel 02](02_anforderungen.md)**.

### 4.1 Must-Haves (zwingend) — alle erfüllt


| ID    | Anforderung                                                   | Status |
| ----- | ------------------------------------------------------------- | ------ |
| MH-01 | Kachelplatzierung mit Regelvalidierung (Kantenmatch, Drehung) |        |
| MH-02 | Feature-System: Stadt, Straße, Kloster, Feld (Merge/Union)    |        |
| MH-03 | Meeple-System + Punktewertung (mid-game + end-game)           |        |
| MH-04 | Hot-Seat-Multiplayer (2–5 Spieler, lokal)                     |        |
| MH-05 | Einfacher, zufallsbasierter KI-Gegner                         |        |
| MH-06 | 2D-GUI als Electron-Desktop-App                               |        |
| MH-07 | Spielende + Endabrechnung                                     |        |
| MH-08 | Spielfeld zoomen und verschieben                              |        |
| MH-09 | Session-Persistenz (Spielstand-Wiederaufnahme)                |        |


Plattform-Vorgabe: **Desktop-PC-Anwendung mit grafischer 2D-Oberfläche**, nur
**regelkonforme Züge**, **lokaler Hot-Seat-Modus**, **einfacher KI-Gegner**, zunächst
nur das **Basisspiel** (72 Kacheln).

### 4.2 Pflicht-Erweiterungen (mind. 2 zu wählen) — beide erfüllt

Die Vorgaben verlangen **mindestens zwei** Erweiterungen. Gewählt wurden (Stakeholder-
Entscheidung Meeting #1, 04.05.2026):


| ID        | Erweiterung                | Begründung der Wahl                                                                                              | Status |
| --------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| **EW-01** | **Netzwerk-Multiplayer**   | Höchster Spielwert; ermöglicht verteiltes Spielen. Als Client-Server-Modell mit autoritativem Backend umgesetzt. |        |
| **EW-02** | **Intelligenter KI-Agent (Reasoning AI)** | Anspruchsvoller „guter" Gegner mittels OpenAI-kompatiblem LLM (z. B. OpenRouter/Custom-Endpunkt) + Tool-Use über lokalen MCP-Server.               |        |


> Über die Pflicht hinaus wurden weitere optionale Pakete umgesetzt (3D-Board,
> prozedurale Kacheln, Mobile-/Touch-Layout, Heuristik-KI) — siehe [Kapitel 02](02_anforderungen.md).

### 4.3 Qualitäts- & Prozessanforderungen

- **Qualitätssicherung** umfasst **Validierung** (erfüllt die Software die Kundenwünsche?)
und **Verifikation** (ist die Spezifikation korrekt umgesetzt?).
- **Wartbarkeit**: keine „hartkodierten" Daten — Daten und Programm sind getrennt
(datengesteuertes Arbeiten), z. B. Kachelverteilung als JSON/Datenmodell.
- **Versionierung** mit Git (GitFlow, semantische Versionen, Conventional Commits).
- **Mindestens 4 Stakeholder-Updates** — alle vier durchgeführt.

---

## 5. Abgrenzung (Was ist *nicht* Teil des Projekts?)

- Nur das **Basisspiel** — keine offiziellen Carcassonne-Erweiterungen (Händler &
Baumeister, Wirtshäuser etc.). Entsprechende optionale Pakete (OPT-03) wurden bewusst
verworfen (siehe Archiv im Notion).
- **Kein Android-Port** (OPT-04 verworfen); stattdessen jedoch ein **responsives
Mobile-/Touch-Web-Layout** (OPT-08).
- Keine offizielle Lizenzierung der Original-Grafiken; verwendet werden eigene bzw.
prozedural generierte Kacheldarstellungen.

---

## 6. Glossar (Kurzfassung)


| Begriff              | Bedeutung                                                                            |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Tile / Kachel**    | Quadratisches Landschaftsplättchen mit Kanten (N/O/S/W).                             |
| **Feature / Gebiet** | Stadt, Straße, Kloster oder Wiese, das sich über mehrere Kacheln erstrecken kann.    |
| **Meeple**           | Spielfigur, die ein Feature beansprucht und Punkte einbringt.                        |
| **Hot-Seat**         | Lokaler Mehrspielermodus an einem Gerät (Spieler wechseln sich ab).                  |
| **MCP**              | Model Context Protocol — Schnittstelle, über die der KI-Agent Analyse-Tools aufruft. |


Ausführliches Glossar: [Kapitel 09](09_glossar-anhang.md).

---

Weiter mit **[Kapitel 01 — Projektmanagement & Vorgehensweise](01_projektmanagement.md)**