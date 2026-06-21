# Carcassonne — Projektdokumentation

> Abschlussdokumentation des Software-Entwicklungsprojekts **Carcassonne**
> (Electron-Desktop- & Web-App, Basisspiel + 2 Erweiterungen).
>
> **Stand:** 21.06.2026 · **Release:** `v0.1.0` · **Live:** [carcassonne.spelk.de](https://carcassonne.spelk.de)
> **Single Source of Truth (Anforderungen/Tasks):** Notion-Workspace *Carcassonne*

---

## Über dieses Dokument

Diese Dokumentation deckt das **gesamte Software-Entwicklungsprojekt** ab — von der
Wahl der Vorgehensweise über Anforderungsanalyse, Qualitätssicherung, Design und
User-Interface bis hin zur Implementierung — und **begründet die getroffenen
Entscheidungen**. Sie ist modular in Kapitel gegliedert (siehe unten).

Sie ist bewusst so geschrieben, dass sie auch ohne Notion-Zugang vollständig lesbar
ist; sie wurde mit der Codebasis, der Git-Historie, dem GitHub-Release und der
CI-Pipeline abgeglichen.

---

##  Die drei Pflichtfragen — Direkteinstieg

Die Aufgabenstellung verlangt, dass mindestens diese drei Fragen beantwortet werden.
Sie werden ausführlich in eigenen Kapiteln behandelt:

| # | Frage | Kapitel |
|---|-------|---------|
| 1 | **Was soll das Ganze?** (Rahmen, Ziele, Anforderungen) | [00 — Einleitung & Zielsetzung](00_einleitung.md) |
| 2 | **Wie starte ich das Programm?** | [07 — Installation & Start](07_installation-start.md) |
| 3 | **Wo steige ich in den Code ein und wie geht es weiter?** | [08 — Code-Leitfaden](08_code-leitfaden.md) |

---

## Inhaltsverzeichnis

| Kapitel | Inhalt |
|---------|--------|
| [00 — Einleitung & Zielsetzung](00_einleitung.md) | Rahmen, Ziele, Anforderungen (Pflichtfrage 1), Projektsteckbrief |
| [01 — Projektmanagement & Vorgehensweise](01_projektmanagement.md) | Wahl des agilen Modells, Stakeholder-Meetings, Feedback-Zyklen, Git-Workflow |
| [02 — Anforderungen (agiles Pflichtenheft)](02_anforderungen.md) | Epics, User Stories, Arbeitspakete, Validierung/Verifikation |
| [03 — Architektur & Design](03_architektur-design.md) | Schichtenarchitektur, Domänenmodell, Design-Entscheidungen, UML/Mermaid |
| [04 — User Interface](04_user-interface.md) | UI/UX-Konzept, 2D/3D-Board, Setup & HUD, Bedienung |
| [05 — Implementierung](05_implementierung.md) | Tech-Stack, Modulübersicht, Spielkern, KI, Netzwerk-Multiplayer |
| [06 — Qualitätssicherung](06_qualitaetssicherung.md) | Teststrategie, Testpyramide, CI/CD, Metriken |
| [07 — Installation & Start](07_installation-start.md) | **Pflichtfrage 2** — Voraussetzungen, Start-Varianten |
| [08 — Code-Leitfaden](08_code-leitfaden.md) | **Pflichtfrage 3** — Einstiegspunkte, Datenflüsse, „wie geht es weiter" |
| [09 — Glossar & Anhang](09_glossar-anhang.md) | Begriffe, Abnahmekriterien, Quellenverzeichnis |

---

## Schnellstart (für Eilige)

```bash
npm install
npm run dev:full     # Vite-UI (5173) + Game-Server (3001) + MCP-AI (3002)
# Browser: http://localhost:5173
```

Vollständige Anleitung inkl. Desktop-App und KI-Konfiguration: **[Kapitel 07](07_installation-start.md)**.

---

## Projektsteckbrief

| Merkmal | Wert |
|---------|------|
| Produkt | Carcassonne-Basisspiel (digital), 2–5 Spieler |
| Plattform | Electron-Desktop (Windows/macOS) **+** Web-App |
| Tech-Stack | TypeScript · React 19 · Vite · Electron · Three.js (3D) · Node/Express · WebSocket |
| Spielkern | Framework-unabhängiges TypeScript (reine Funktionen) |
| Erweiterungen | EW-01 Netzwerk-Multiplayer · EW-02 Intelligenter KI-Agent (LLM + MCP) |
| Vorgehen | Agil (Scrum-orientiert), Notion als Backlog, 4 Stakeholder-Reviews |
| Qualität | 282 automatisierte Tests (40 Dateien), CI-Gate, Code-Reviews |
| Release | `v0.1.0` (Git-Tag auf `main` + GitHub Release, 21.06.2026) |
