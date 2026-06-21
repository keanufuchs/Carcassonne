# 07 — Installation & Start

> **Pflichtfrage 2: „Wie starte ich das Programm?"**

Es gibt **drei Wege**, Carcassonne zu starten:
**(A)** im Browser ohne Installation (Live-Web-App), **(B)** lokal aus dem Quellcode
(Entwicklung), **(C)** als Electron-Desktop-App.

---

## A) Sofort spielen — ohne Installation

Die Anwendung ist dauerhaft als Web-App veröffentlicht:

**[https://carcassonne.spelk.de](https://carcassonne.spelk.de)**

Einfach im Browser öffnen, Spieler/Modi wählen, losspielen. Online-Multiplayer per
Spiel-Code funktioniert direkt.

---

## B) Lokal aus dem Quellcode starten (Entwicklung)

### Voraussetzungen

| Werkzeug | Version |
|----------|---------|
| **Node.js** | **≥ 22.12.0** (siehe `package.json` / `.nvmrc`) |
| npm | mit Node mitgeliefert |
| Git | zum Klonen |

### 1. Repository holen & Abhängigkeiten installieren

```bash
git clone <repo-url>
cd Carcassonne
npm install
```

### 2. Starten

**Variante 1 — nur das Spiel (UI):** genügt für lokales Spiel (Hot-Seat, Zufalls-/Heuristik-KI):

```bash
npm run dev
# → http://localhost:5173
```

**Variante 2 — alles (empfohlen):** UI **+** Game-/Netzwerk-Server **+** MCP-AI-Server:

```bash
npm run dev:full
# UI:        http://localhost:5173
# Game-API:  http://localhost:3001   (Netzwerk-Multiplayer)
# MCP-AI:    http://localhost:3002   (intelligenter KI-Agent)
```

Anschließend **[http://localhost:5173](http://localhost:5173)** im Browser öffnen.

> Für **Netzwerk-Multiplayer** und den **Reasoning-AI-KI-Agenten** wird
> `dev:full` benötigt. Hot-Seat und Zufalls-/Heuristik-KI laufen auch mit `npm run dev`.

### 3. Einzelne Server (optional)

```bash
npm run server   # nur Game-/WebSocket-Server (Port 3001)
npm run mcp      # nur MCP-AI-Server (Port 3002)
```

Health-Check des MCP-Servers: `curl http://localhost:3002/health`.

---

## C) Als Desktop-App (Electron)

### Im Entwicklungsmodus starten

```bash
npm run electron:dev
```

### Installierbares Paket bauen

```bash
npm run electron:pack:win   # Windows  (.exe / NSIS-Installer)
npm run electron:pack:mac   # macOS    (.dmg)
npm run electron:pack       # aktuelles Betriebssystem
```

Die fertigen Pakete liegen anschließend im Ordner `release/`.

> **Hinweis:** Die Desktop-App lädt die produktive Web-App (`carcassonne.spelk.de`) in
> einem nativen Fenster. Sie ist damit immer auf dem aktuellen Stand und benötigt keinen
> lokal laufenden Server.

---

## KI-Agent konfigurieren (optional, für EW-02)

Der **Reasoning-AI-Modus** nutzt ein OpenAI-kompatibles LLM mit Tool-Use. Lege dazu
eine `.env` an (Vorlage: `.env.example`). Es genügt **eine** der beiden Optionen:

```bash
# Option A — eigener/kompatibler Endpunkt (z. B. RH Köln, OpenAI, Ollama)
VITE_AI_BASE_URL=https://api.ai.rh-koeln.de/v1
VITE_AI_API_KEY=dein-key
VITE_AI_MODELS=modell-1,modell-2        # optional: Auswahl im Setup-Screen

# Option B — OpenRouter (ein Key für viele Modelle)
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_AI_MODEL=anthropic/claude-sonnet-4-6   # optional
```

**Ohne Konfiguration kein Problem:** Fehlt ein Key oder kommt es zu einem Timeout, fällt
der KI-Modus **automatisch auf die Heuristik-KI** zurück (kein Absturz). Hot-Seat und die
einfachen KI-Stufen funktionieren immer ohne `.env`.

### Wichtige Umgebungsvariablen

| Variable | Nötig für | Beschreibung |
|----------|-----------|--------------|
| `VITE_AI_BASE_URL` | Custom-LLM | OpenAI-kompatible Base-URL |
| `VITE_AI_API_KEY` | Custom-LLM | API-Key zum Endpunkt |
| `VITE_OPENROUTER_API_KEY` | OpenRouter | OpenRouter-Key (`sk-or-…`) |
| `VITE_AI_MODEL` | optional | Modell-ID |
| `PORT` | optional | Game-Server-Port (Default 3001) |
| `MCP_PORT` | optional | MCP-Server-Port (Default 3002) |

---

## Tests ausführen

```bash
npm test               # Unit-/Integrationstests (Vitest)
npm run test:watch     # Vitest im Watch-Modus
npm run test:e2e       # E2E-Tests (Playwright, Dev-Server startet automatisch)
npm run test:scenarios # YAML-Regel-Szenarien
npm run lint           # ESLint
```

---

## Spiel starten (im Programm)

1. **Spieleranzahl** wählen (2–5) und je Spieler einen **Modus** setzen
   (Mensch · Zufall · Heuristik · Reasoning AI).
2. **Lokal:** „Spiel starten" → Hot-Seat am selben Gerät.
   **Online:** „Create" → 5-stelligen **Spiel-Code** teilen; Mitspieler „Join" + Code; Host „Start Game".
3. Kachel ziehen → drehen → auf ein legales Feld legen → optional Meeple setzen → Zug beenden.
4. Bei leerem Stapel endet das Spiel automatisch mit der **Endabrechnung**.

---

## Häufige Stolpersteine

| Problem | Lösung |
|---------|--------|
| Falsche Node-Version | Node **≥ 22.12.0** verwenden (`nvm use`). |
| Port belegt (5173/3001/3002) | belegenden Prozess beenden oder `PORT`/`MCP_PORT` setzen. |
| KI „reagiert nicht" | `.env` prüfen oder bewusst Heuristik-Modus nutzen (Fallback greift automatisch). |
| Online-Spiel verbindet nicht | `npm run dev:full` (Server muss laufen) oder Live-Web-App nutzen. |

---

Weiter mit **[Kapitel 08 — Code-Leitfaden](08_code-leitfaden.md)**
