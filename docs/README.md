# Carcassonne — Projektdokumentation

> Abschlussdokumentation des Software-Entwicklungsprojekts **Carcassonne**
> (Electron-Desktop- & Web-App, Basisspiel + 2 Erweiterungen).
>
> **Stand:** 22.06.2026 · **Release:** `v1.0.0` · **Live:** [carcassonne.spelk.de](https://carcassonne.spelk.de) · **Doku:** [GitHub Pages](https://keanufuchs.github.io/Carcassonne/)
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
| 1 | **Was soll das Ganze?** (Rahmen, Ziele, Anforderungen) | [01 — Einleitung & Zielsetzung](01_einleitung.md) |
| 2 | **Wie starte ich das Programm?** | [08 — Installation & Start](08_installation-start.md) |
| 3 | **Wo steige ich in den Code ein und wie geht es weiter?** | [09 — Code-Leitfaden](09_code-leitfaden.md) |

---

## Inhaltsverzeichnis

| Kapitel | Inhalt |
|---------|--------|
| [01 — Einleitung & Zielsetzung](01_einleitung.md) | Rahmen, Ziele, Anforderungen (Pflichtfrage 1), Projektsteckbrief |
| [02 — Projektmanagement & Vorgehensweise](02_projektmanagement.md) | Wahl des agilen Modells, Stakeholder-Meetings, Feedback-Zyklen, Git-Workflow |
| [03 — Anforderungen (agiles Pflichtenheft)](03_anforderungen.md) | Epics, User Stories, Arbeitspakete, Validierung/Verifikation |
| [04 — Architektur & Design](04_architektur-design.md) | Schichtenarchitektur, Domänenmodell, Design-Entscheidungen, UML/Mermaid |
| [05 — User Interface](05_user-interface.md) | UI/UX-Konzept, 2D/3D-Board, Setup & HUD, Bedienung |
| [06 — Implementierung](06_implementierung.md) | Tech-Stack, Modulübersicht, Spielkern, KI, Netzwerk-Multiplayer |
| [07 — Qualitätssicherung](07_qualitaetssicherung.md) | Teststrategie, Testpyramide, CI/CD, Metriken |
| [08 — Installation & Start](08_installation-start.md) | **Pflichtfrage 2** — Voraussetzungen, Start-Varianten |
| [09 — Code-Leitfaden](09_code-leitfaden.md) | **Pflichtfrage 3** — Einstiegspunkte, Datenflüsse, „wie geht es weiter" |
| [10 — Glossar & Anhang](10_glossar-anhang.md) | Begriffe, Abnahmekriterien, Quellenverzeichnis |

---

## Schnellstart (für Eilige)

```bash
npm install
npm run dev:full     # Vite-UI (5173) + Game-Server (3001) + MCP-AI (3002)
# Browser: http://localhost:5173
```

Vollständige Anleitung inkl. Desktop-App und KI-Konfiguration: **[Kapitel 08](08_installation-start.md)**.

---

## Projektsteckbrief

| Merkmal | Wert |
|---------|------|
| Produkt | Carcassonne-Basisspiel (digital), 2–5 Spieler |
| Plattform | Electron-Desktop (macOS) **+** Web-App |
| Tech-Stack | TypeScript · React 19 · Vite · Electron · Three.js (3D) · Node/Express · WebSocket |
| Spielkern | Framework-unabhängiges TypeScript (reine Funktionen) |
| Erweiterungen | EW-01 Netzwerk-Multiplayer · EW-02 Reasoning AI (LLM + MCP) |
| Vorgehen | Agil (Scrum-orientiert), Notion als Backlog, 4 Stakeholder-Reviews |
| Qualität | 50 automatisierte Tests (7 Dateien) + 11 YAML-Szenarien, CI-Gate, Code-Reviews |
| Release | `v1.0.0` (Git-Tag auf `main` + GitHub Release, 22.06.2026) |
