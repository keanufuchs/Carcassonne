# MCP AI Server + Claude Tool Use — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement EW-02 (Intelligent AI Agent) via MCP server + Claude tool use for Stakeholder Meeting #3

**Architecture:** A standalone HTTP MCP server (port 3002) exposes game-analysis tools. The intelligent AI calls Claude with tool definitions; Claude uses these tools to query game state, then submits its move via a `submit_move` tool. Local fallback executes tools in-process if MCP server is unavailable.

**Tech Stack:** Express + TypeScript (MCP server), Anthropic Claude API (claude-sonnet-4-6), Claude tool_use feature

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `server/mcp-ai.ts` | Create | Standalone HTTP MCP server exposing game-analysis tools |
| `src/ai/intelligent.ts` | Rewrite | Claude tool-use multi-turn loop with MCP server calls |
| `package.json` | Modify | Add `mcp` script, update `dev:full` |
| `docs/Stakeholder-Meeting-3-Vorbereitung.md` | Create | Meeting preparation document |

---

## Task 1: MCP AI Server

**Files:**
- Create: `server/mcp-ai.ts`

- [x] **Step 1: Create the MCP server**

```typescript
// server/mcp-ai.ts
import express from 'express';
import cors from 'cors';
import { deserializeState } from '../src/core/serialize.js';
import { candidatePlacements } from '../src/core/board/Board.js';
import { canPlace } from '../src/core/board/placement.js';

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3002;
const ALL_ROTATIONS = [0, 90, 180, 270] as const;
const app = express();
app.use(cors()); app.use(express.json());

app.get('/health', (_req, res) => { res.json({ status: 'ok', name: 'carcassonne-mcp' }); });

app.post('/tools/list_legal_moves', (req, res) => {
  const { state: stateJson } = req.body;
  const state = deserializeState(stateJson);
  if (!state.pendingTile) { res.json({ moves: [] }); return; }
  const moves = [];
  for (const coord of candidatePlacements(state.board))
    for (const rot of ALL_ROTATIONS)
      if (canPlace(state.board, state.pendingTile, coord, rot))
        moves.push({ coord, rotation: rot });
  res.json({ moves: moves.slice(0, 30), tileId: state.pendingTile.id });
});
// ... (get_board_features, get_player_status similar)
app.listen(PORT);
```

- [x] **Step 2: Verify server starts**
```bash
npx tsx server/mcp-ai.ts &
curl http://localhost:3002/health
# Expected: {"status":"ok","name":"carcassonne-mcp",...}
```

---

## Task 2: Claude Tool Use in intelligent.ts

**Files:**
- Modify: `src/ai/intelligent.ts`

- [x] **Step 1: Define tools**

Four tools: `list_legal_moves`, `get_board_features`, `get_player_status`, `submit_move`

- [x] **Step 2: Implement multi-turn tool loop**

Loop up to MAX_TOOL_ROUNDS=6. On each iteration:
- Call Claude API with tools
- If stop_reason=tool_use: handle each tool call
  - submit_move → parse coord/rotation, validate, return AIDecision
  - others → call MCP server (or local fallback), add tool_result
- If stop_reason=end_turn → parse JSON from text (fallback)

- [x] **Step 3: MCP server call with local fallback**

```typescript
async function executeTool(name, state, stateJson): Promise<unknown> {
  try {
    const res = await fetch(`${MCP_BASE}/tools/${name}`, {
      method: 'POST', body: JSON.stringify({ state: stateJson }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return res.json();
  } catch { /* MCP offline */ }
  return executeToolLocally(name, state);
}
```

- [x] **Step 4: Tests pass**
```bash
npm test
# Expected: 84 tests passed
```

---

## Task 3: package.json + scripts

- [x] Add `"mcp": "tsx server/mcp-ai.ts"`
- [x] Update `"dev:full"` to include MCP server

---

## Status

- [x] All tasks complete
- [x] TypeScript: no errors (`tsc --noEmit`)
- [x] Tests: 84/84 passing
- [x] Git tag: `stakeholder-v3-2026-06-01`
