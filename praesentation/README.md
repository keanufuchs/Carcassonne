# Carcassonne — Abschlusspräsentation

Reveal.js-Präsentation für die Projektabgabe (~20 Minuten).
Helles, minimalistisches Theme, optimiert für den Vortrag.

## Öffnen

Einfach `index.html` im Browser öffnen — es ist **kein Build nötig**
(Reveal.js wird per CDN geladen, eine Internetverbindung genügt).

```bash
# direkt öffnen
open praesentation/index.html        # macOS
# oder über einen lokalen Server (empfohlen, falls hash-Navigation klemmt)
npx serve praesentation
```

## Steuerung

| Taste | Funktion |
|-------|----------|
| `→` / `Leertaste` | nächste Folie |
| `←` | zurück |
| `F` | Vollbild |
| `S` | Speaker-/Notizen-Ansicht |
| `Esc` / `O` | Folienübersicht |
| `B` | Bildschirm abdunkeln (Pause) |

## Aufbau (27 Folien, ~20 Min)

1. **Was soll das Ganze?** (Pflichtfrage 1) — Produkt, Rahmen, Anforderungen
2. **Prozess** — agile Vorgehensweise, Stakeholder, agiles Pflichtenheft
3. **Design** — 4-Schichten-Architektur, Domänenmodell, Entscheidungen
4. **Umsetzung** — UI, Spielkern & Wertung, KI (EW-02), Netzwerk (EW-01)
5. **Qualität** — Testpyramide, CI/CD, Kennzahlen
6. **Start & Code** (Pflichtfragen 2 & 3) — Programmstart, Code-Einstieg, Status

> Bewusst **ohne Live-Code-Vorführungen** — Diagramme und Kernaussagen statt Code-Walkthrough.

## Dateien

```
praesentation/
  index.html        ← die Präsentation (alle Folien)
  css/theme.css     ← Light-Theme (ein Akzent, minimalistisch)
  README.md         ← diese Datei
```

Inhaltliche Grundlage: `dokumentation/` (Kapitel 01–10) und die Codebasis.
