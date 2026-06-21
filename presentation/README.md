# Carcassonne — Projektpräsentation (Reveal.js)

Helles, modernes Reveal.js-Deck zu Projektvorgehen, Qualitätssicherung,
Workflows, Deployment, Implementierungsumfang und AI-Anbindung.

## Lokal starten

Die Präsentation ist eine statische HTML-Datei.

**Einfachster Weg** — `presentation/index.html` direkt im Browser öffnen
(Doppelklick).

**Empfohlen** (sauberer für Reveal-Features wie URL-Hash/Navigation) —
einen kleinen lokalen Server starten:

```bash
# aus dem Repo-Root
npx serve presentation
# oder
python -m http.server 8000 --directory presentation
```

Dann im Browser öffnen, z. B. <http://localhost:8000>.

## Steuerung

| Taste | Aktion |
|-------|--------|
| `→` / `Leertaste` | nächste Folie |
| `←` | vorige Folie |
| `F` | Vollbild |
| `S` | Referenten-/Notizen-Ansicht |
| `Esc` / `O` | Folienübersicht |

## Aufbau

```
presentation/
  index.html        # Folien (Inline-SVG-Grafiken, keine Rastergrafiken)
  css/theme.css     # Helles Design-System + wiederverwendbare Komponenten
  README.md         # diese Datei
```

Eigene Visuals (agiler Kreisprozess, Testpyramide, CI-Pipeline,
Deployment-Kette) sind als **Inline-SVG/CSS** umgesetzt und damit
offline-fest.

## Hinweis zum Reveal-Core

Reveal.js-Core und die Schriften werden per CDN (`jsdelivr` / Google Fonts)
geladen — wie im übrigen Projekt. Für eine **vollständig offline** nutzbare
Variante können `reveal.js`, das Highlight-Plugin und die Fonts lokal
vendor't und die `<link>`/`<script>`-Pfade in `index.html` auf lokale
Dateien umgestellt werden.

## Inhaltliche Grundlage

Die Folien leiten ihre Aussagen aus realen Repo-Artefakten ab:

- `.github/workflows/deploy.yml` — Staging (PR) → Production (Push auf `main`)
- `.github/workflows/scenarios.yml` — Scenario-Tests in CI (Playwright)
- `.github/workflows/build-desktop.yml` — Windows-`.exe` / macOS-`.dmg`
- `tests/scenarios/*.yaml` — 10 deterministische Testszenarien
- `docs/Testsystem.md` — dokumentierte Teststrategie
- `README.md`, `.env.example`, `src/ai/intelligent.ts` — AI-Anbindung

> Die GWDG-Benennung der AI-Anbindung folgt der Projektvorgabe; im Repository
> belegt ist ein OpenAI-kompatibler Custom-Endpoint mit Vorrang gegenüber
> OpenRouter. Unsichere Punkte sind in den Folien neutral formuliert.
