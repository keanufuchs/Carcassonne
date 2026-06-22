# Carcassonne

Digital implementation of the Carcassonne base game — React + TypeScript, playable in the browser, as a desktop app, and over the network.

**Notion (Single Source of Truth):** [Carcassonne Workspace](https://app.notion.com/p/Carcassonne-1c5e27f8f8af828b8f4c01711d86bf9d)

---

## Play

### 🌐 Web — no installation

The game is published as a live web app:

**[https://carcassonne.spelk.de](https://carcassonne.spelk.de)**

Open it in any browser, pick players and modes, and start playing. Online multiplayer via game code works out of the box.

### 💻 Desktop clients (Windows & macOS)

Native desktop builds wrap the live web app in an Electron window — always up to date, no local server required.

| Platform | Package | Build command |
|----------|---------|---------------|
| Windows | `.exe` installer (NSIS, x64) | `npm run electron:pack:win` |
| macOS | `.dmg` (Intel x64 + Apple Silicon arm64) | `npm run electron:pack:mac` |

Packaged installers are written to the `release/` folder.

---

## Local Development

### Requirements

| Tool | Version |
|------|---------|
| Node.js | ≥ 22.12.0 |
| npm | bundled with Node |

### Quick start

```bash
npm install
npm run dev:full   # UI + game/network server + MCP AI server
```

Open [http://localhost:5173](http://localhost:5173).

- `npm run dev` is enough for local play (hot-seat, random/heuristic AI).
- `npm run dev:full` is required for **network multiplayer** and the **Reasoning AI**.

---

## AI Modes

When starting a game, each player can be set to one of four modes:

| Mode | Description |
|------|-------------|
| 👤 Human | Manual play |
| 🎲 Random AI | Places tiles randomly |
| 🧠 Heuristic AI | Rule-based strategy (no API key needed) |
| 🤖 Reasoning AI | An LLM uses game-analysis tools to pick the best move |

The first three modes work everywhere with no configuration. The Reasoning AI needs an LLM endpoint (see below). If no endpoint is configured — or a request times out — the Reasoning AI **falls back to the Heuristic AI automatically**, so it never crashes.

---

## Reasoning AI Setup

The Reasoning AI calls any **OpenAI-compatible** `/v1/chat/completions` API that supports **tool use / function calling**. Configure it in `.env` (template: `.env.example`):

```bash
# .env
VITE_AI_BASE_URL=https://api.ai.rh-koeln.de/v1
VITE_AI_API_KEY=your-key-here
# Comma-separated list of models selectable per player in the setup screen.
# The first entry is the default.
VITE_AI_MODELS=openai-gpt-oss-120b,gemma-4-31b-it,qwen3.6-35b-a3b
```

Notes:

- The full URL `https://api.ai.rh-koeln.de/v1/chat/completions` also works as `VITE_AI_BASE_URL` — the `/chat/completions` suffix is stripped automatically.
- When several models are configured via `VITE_AI_MODELS`, each Reasoning AI player gets a model dropdown in the setup screen.
- `VITE_AI_MODEL` still works for a single model and is prepended to the list.

---

## MCP AI Server

The Reasoning AI communicates with a local **MCP (Model Context Protocol) server** that exposes game-analysis tools.

The MCP server runs on **port 3002** and exposes three tools:

| Tool | Description |
|------|-------------|
| `list_legal_moves` | All valid placements for the current tile |
| `get_board_features` | Cities, roads, monasteries with meeple ownership |
| `get_player_status` | Scores, meeple counts, tiles remaining |

The model calls these tools during its turn to understand the board before deciding where to place a tile.

```bash
npm run mcp                          # start manually
curl http://localhost:3002/health    # health check
```

The MCP server is **optional** — if it is not running, the same tools are executed locally as a fallback.

---

## Network Multiplayer

1. One player clicks **Create** and shares the 5-letter game code.
2. Other players click **Join** and enter the code.
3. The host clicks **Start Game**.

The game/WebSocket server runs on port 3001 (deployed to Vercel in production). On a LAN, other devices can join via `http://<your-ip>:5173`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run server` | Start game/WebSocket server (port 3001) |
| `npm run mcp` | Start MCP AI server (port 3002) |
| `npm run dev:full` | Start all three servers concurrently |
| `npm run build` | Production build (web + API bundle) |
| `npm run electron:dev` | Run the Electron desktop app in dev |
| `npm run electron:pack:win` | Build the Windows installer |
| `npm run electron:pack:mac` | Build the macOS `.dmg` |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:scenarios` | YAML rule-scenario tests (Playwright) |
| `npm run lint` | ESLint check |

---

## Project Structure

```
src/
  ai/           — AI modes (random, heuristic, intelligent)
  core/         — Game logic (framework-free TypeScript)
  controller/   — GameController + NetworkController
  ui/           — React components
server/
  index.ts      — Game + WebSocket server (port 3001)
  mcp-ai.ts     — MCP AI analysis server (port 3002)
electron/       — Electron main process (loads carcassonne.spelk.de)
api/            — Vercel serverless entry for the game API
specs/          — Architecture and domain specs
dokumentation/  — Project documentation (German)
docs/           — Test system documentation, meeting prep
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_AI_BASE_URL` | For Reasoning AI | OpenAI-compatible base URL, e.g. `https://api.ai.rh-koeln.de/v1` |
| `VITE_AI_API_KEY` | With `VITE_AI_BASE_URL` | API key for the endpoint |
| `VITE_AI_MODELS` | No | Comma-separated models offered in the setup screen (first = default) |
| `VITE_AI_MODEL` | No | Single model override, prepended to `VITE_AI_MODELS` |
| `VITE_API_URL` | No | REST API base URL (empty = same-origin via Vite proxy) |
| `VITE_WS_URL` | No | WebSocket URL (empty = derived from origin; LAN-capable) |
| `PORT` | No | Game server port (default: 3001) |
| `MCP_PORT` | No | MCP AI server port (default: 3002) |
