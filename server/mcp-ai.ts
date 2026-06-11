import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deserializeState } from '../src/core/serialize.js';
import { legalMovesView, boardFeaturesView, playerStatusView, meeplesView } from '../src/ai/boardAnalysis.js';
import type { Coord, Rotation } from '../src/core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_ROOT = path.resolve(__dirname, '../logs');

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3002;

const app = express();
app.use(cors());
app.use(express.json());

// ── Tool manifest ──────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'carcassonne-mcp',
    version: '1.0.0',
    tools: [
      {
        name: 'list_legal_moves',
        description:
          'Returns all legal tile placements for the current pending tile, each ' +
          'annotated with "connectsTo": the existing city/road features that move ' +
          'would actually join (empty = starts a new feature)',
      },
      {
        name: 'get_board_features',
        description:
          'Returns all features on the board with ownership and completion status, ' +
          'plus each feature\'s tileCoords and openEdgeNeighborCoords for spatial orientation',
      },
      {
        name: 'get_player_status',
        description: 'Returns player scores, meeple counts, and tiles remaining',
      },
    ],
  });
});

// ── Tool: list_legal_moves ─────────────────────────────────────────────────

app.post('/tools/list_legal_moves', (req, res) => {
  try {
    const { state: stateJson } = req.body as { state: string };
    res.json(legalMovesView(deserializeState(stateJson)));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Tool: get_board_features ───────────────────────────────────────────────

app.post('/tools/get_board_features', (req, res) => {
  try {
    const { state: stateJson } = req.body as { state: string };
    res.json(boardFeaturesView(deserializeState(stateJson)));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Tool: get_player_status ────────────────────────────────────────────────

app.post('/tools/get_player_status', (req, res) => {
  try {
    const { state: stateJson } = req.body as { state: string };
    res.json(playerStatusView(deserializeState(stateJson)));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Tool: get_meeple_targets ───────────────────────────────────────────────

app.post('/tools/get_meeple_targets', (req, res) => {
  try {
    const { state: stateJson, coord, rotation } = req.body as { state: string; coord: Coord; rotation: Rotation };
    res.json(meeplesView(deserializeState(stateJson), coord, rotation));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Log: conversation dump ─────────────────────────────────────────────────

app.post('/log/conversation', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const gameId = String(body.gameId ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const gameDir = path.join(LOGS_ROOT, gameId);
    fs.mkdirSync(gameDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const player = String(body.player ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${ts}_${player}.json`;
    fs.writeFileSync(path.join(gameDir, filename), JSON.stringify(body, null, 2));
    res.json({ ok: true, filename });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Carcassonne MCP AI Server on :${PORT}`);
  console.log(`Tools: list_legal_moves, get_board_features, get_player_status`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
