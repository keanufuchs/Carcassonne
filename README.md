# Carcassonne

Digital implementation of the Carcassonne base game — Electron + React + TypeScript.

## Quick Start

```bash
npm install
npm run dev:full   # starts all servers (game + MCP AI)
```

Open [http://localhost:5173](http://localhost:5173).

---

## AI Modes

When starting a local game, each player can be set to one of four modes:

| Mode | Description |
|------|-------------|
| 👤 Human | Manual play |
| 🎲 Random AI | Places tiles randomly |
| 🧠 Heuristic AI | Rule-based strategy (no API key needed) |
| 🤖 Claude AI | Claude uses game-analysis tools to pick the best move |

---

## Claude AI Setup (API Key)

The Claude AI mode requires an Anthropic API key.

### 1. Get an API key

Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key.

### 2. Set the key

Create a `.env` file in the project root:

```bash
# .env
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

> The key is only used client-side in the Electron/browser renderer. It is never sent to the game server.

### 3. Start the app

```bash
npm run dev:full
```

If no API key is set (or the request times out), the Claude AI falls back to the **Heuristic AI** automatically — no crash, no error.

---

## MCP AI Server

The Claude AI communicates with a local **MCP (Model Context Protocol) server** that provides game-analysis tools to Claude.

### What it does

The MCP server runs on **port 3002** and exposes three tools:

| Tool | Description |
|------|-------------|
| `list_legal_moves` | All valid placements for the current tile |
| `get_board_features` | Cities, roads, monasteries with meeple ownership |
| `get_player_status` | Scores, meeple counts, tiles remaining |

Claude calls these tools during its turn to understand the board before deciding where to place a tile.

### Start manually

```bash
npm run mcp
```

```
Carcassonne MCP AI Server on :3002
Tools: list_legal_moves, get_board_features, get_player_status
Health: http://localhost:3002/health
```

### Test it

```bash
curl http://localhost:3002/health
```

```json
{
  "status": "ok",
  "name": "carcassonne-mcp",
  "tools": ["list_legal_moves", "get_board_features", "get_player_status"]
}
```

The MCP server is **optional** — if it is not running, Claude executes the same tools locally as a fallback.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run server` | Start game/WebSocket server (port 3001) |
| `npm run mcp` | Start MCP AI server (port 3002) |
| `npm run dev:full` | Start all three servers concurrently |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |

---

## Network Multiplayer

1. One player clicks **Create** and shares the 5-letter game code
2. Other players click **Join** and enter the code
3. The host clicks **Start Game**

The game server runs on port 3001. On a LAN, other devices can join via `http://<your-ip>:5173`.

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
specs/          — Architecture and domain specs
docs/           — Test system documentation, meeting prep
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ANTHROPIC_API_KEY` | For Claude AI | Anthropic API key (prefix `sk-ant-`) |
| `PORT` | No | Game server port (default: 3001) |
| `MCP_PORT` | No | MCP AI server port (default: 3002) |
