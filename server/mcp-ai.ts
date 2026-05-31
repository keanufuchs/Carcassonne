import express from 'express';
import cors from 'cors';
import { deserializeState } from '../src/core/serialize.js';
import { legalMovesView, boardFeaturesView, playerStatusView } from '../src/ai/boardAnalysis.js';

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

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Carcassonne MCP AI Server on :${PORT}`);
  console.log(`Tools: list_legal_moves, get_board_features, get_player_status`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
