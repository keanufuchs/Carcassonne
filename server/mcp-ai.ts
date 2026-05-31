import express from 'express';
import cors from 'cors';
import { deserializeState } from '../src/core/serialize.js';
import { candidatePlacements } from '../src/core/board/Board.js';
import { canPlace } from '../src/core/board/placement.js';

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3002;
const ALL_ROTATIONS = [0, 90, 180, 270] as const;

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
        description: 'Returns all legal tile placements for the current pending tile',
      },
      {
        name: 'get_board_features',
        description: 'Returns all features on the board with ownership and completion status',
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
    const state = deserializeState(stateJson);

    if (!state.pendingTile) {
      res.json({ moves: [], tileId: null });
      return;
    }

    const candidates = candidatePlacements(state.board);
    const moves: { coord: { x: number; y: number }; rotation: number }[] = [];

    for (const coord of candidates) {
      for (const rot of ALL_ROTATIONS) {
        if (canPlace(state.board, state.pendingTile, coord, rot)) {
          moves.push({ coord: { x: coord.x, y: coord.y }, rotation: rot });
        }
      }
    }

    // Limit to 30 moves to keep token usage manageable
    res.json({
      moves: moves.slice(0, 30),
      totalMoves: moves.length,
      tileId: state.pendingTile.id,
      hasMonastery: state.pendingTile.hasMonastery,
      hasShield: state.pendingTile.hasShield,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Tool: get_board_features ───────────────────────────────────────────────

app.post('/tools/get_board_features', (req, res) => {
  try {
    const { state: stateJson } = req.body as { state: string };
    const state = deserializeState(stateJson);

    const features = [...state.board.registry.features.values()].map(f => {
      const tileIds = new Set([...f.segments].map(s => s.split('#')[0]));
      return {
        id: f.id,
        kind: f.kind,
        tileCount: tileIds.size,
        openEdges: f.openEdges,
        shieldCount: f.shieldCount,
        completed: f.completed,
        meeples: f.meeples.map(m => m.playerId),
      };
    });

    res.json({
      features,
      boardTileCount: state.board.tiles.size,
      activeFeaturesWithMeeples: features.filter(f => f.meeples.length > 0 && !f.completed),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Tool: get_player_status ────────────────────────────────────────────────

app.post('/tools/get_player_status', (req, res) => {
  try {
    const { state: stateJson } = req.body as { state: string };
    const state = deserializeState(stateJson);

    const currentPlayer = state.players[state.currentPlayerIndex];
    const players = state.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      meeplesAvailable: p.meeplesAvailable,
      isCurrent: i === state.currentPlayerIndex,
    }));

    res.json({
      players,
      tilesRemaining: state.deck.remaining.length,
      currentPlayerId: currentPlayer.id,
      currentPlayerName: currentPlayer.name,
      pendingTileId: state.pendingTile?.id ?? null,
    });
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
