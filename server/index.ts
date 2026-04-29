import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { db, type GameRow, type SessionRow } from './db.js';
import { serializeState, deserializeState } from '../src/core/serialize.js';
import {
  startGame,
  drawTile,
  rotatePending,
  placeTile,
  placeMeeple,
  skipMeeple,
  endGame,
} from '../src/core/game/Game.js';
import type { GameState } from '../src/core/game/GameState.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ── In-memory game states ──────────────────────────────────────────────────
const gameStates = new Map<string, GameState>();

function generateGameId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getOrLoadState(gameId: string): GameState | null {
  if (gameStates.has(gameId)) return gameStates.get(gameId)!;
  const row = db.prepare('SELECT state_json FROM games WHERE id = ?').get(gameId) as GameRow | undefined;
  if (!row?.state_json) return null;
  const state = deserializeState(row.state_json);
  gameStates.set(gameId, state);
  return state;
}

function saveState(gameId: string, state: GameState): void {
  const status = state.phase === 'GAME_OVER' ? 'GAME_OVER' : 'PLAYING';
  db.prepare('UPDATE games SET state_json = ?, status = ?, updated_at = unixepoch() WHERE id = ?')
    .run(serializeState(state), status, gameId);
}

// ── WebSocket rooms ────────────────────────────────────────────────────────
const rooms = new Map<string, Set<WebSocket>>();
interface WsMeta { gameId: string; sessionId: string; playerIndex: number }
const wsMeta = new Map<WebSocket, WsMeta>();

function broadcastState(gameId: string): void {
  const state = gameStates.get(gameId);
  const room = rooms.get(gameId);
  if (!state || !room) return;
  const stateJson = serializeState(state);
  for (const ws of room) {
    const meta = wsMeta.get(ws);
    if (ws.readyState === WebSocket.OPEN && meta) {
      ws.send(JSON.stringify({ type: 'state', state: stateJson, playerIndex: meta.playerIndex }));
    }
  }
}

function broadcastLobby(gameId: string): void {
  const sessions = db.prepare('SELECT * FROM sessions WHERE game_id = ? ORDER BY player_index').all(gameId) as SessionRow[];
  const game = db.prepare('SELECT host_session_id FROM games WHERE id = ?').get(gameId) as GameRow | undefined;
  const room = rooms.get(gameId);
  if (!room) return;
  const players = sessions.map(s => ({ name: s.player_name, index: s.player_index }));
  for (const ws of room) {
    const meta = wsMeta.get(ws);
    if (ws.readyState === WebSocket.OPEN && meta) {
      ws.send(JSON.stringify({ type: 'lobby', gameId, players, isHost: meta.sessionId === game?.host_session_id }));
    }
  }
}

// ── HTTP API ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/games', (req, res) => {
  try {
    const { playerName } = req.body as { playerName?: string };
    if (!playerName?.trim()) { res.status(400).json({ error: 'playerName required' }); return; }

    let gameId = generateGameId();
    while (db.prepare('SELECT id FROM games WHERE id = ?').get(gameId)) gameId = generateGameId();

    const sessionId = randomUUID();
    db.prepare('INSERT INTO games (id, host_session_id) VALUES (?, ?)').run(gameId, sessionId);
    db.prepare('INSERT INTO sessions (id, game_id, player_name, player_index) VALUES (?, ?, ?, ?)').run(sessionId, gameId, playerName.trim(), 0);

    res.json({ gameId, sessionId, playerIndex: 0 });
  } catch (e) {
    console.error('POST /api/games error:', e);
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/games/:id/join', (req, res) => {
  try {
    const gameId = req.params.id;
    const { playerName, sessionId: existingSession } = req.body as { playerName?: string; sessionId?: string };

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as GameRow | undefined;
    if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
    if (game.status !== 'LOBBY') { res.status(400).json({ error: 'Game already started' }); return; }

    if (existingSession) {
      const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND game_id = ?').get(existingSession, gameId) as SessionRow | undefined;
      if (s) { res.json({ gameId, sessionId: existingSession, playerIndex: s.player_index }); return; }
    }

    if (!playerName?.trim()) { res.status(400).json({ error: 'playerName required' }); return; }
    const sessions = db.prepare('SELECT * FROM sessions WHERE game_id = ?').all(gameId) as SessionRow[];
    if (sessions.length >= 5) { res.status(400).json({ error: 'Game is full' }); return; }

    const newSessionId = randomUUID();
    db.prepare('INSERT INTO sessions (id, game_id, player_name, player_index) VALUES (?, ?, ?, ?)').run(newSessionId, gameId, playerName.trim(), sessions.length);

    res.json({ gameId, sessionId: newSessionId, playerIndex: sessions.length });
  } catch (e) {
    console.error('POST /api/games/:id/join error:', e);
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/games/:id', (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as GameRow | undefined;
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  const sessions = db.prepare('SELECT * FROM sessions WHERE game_id = ? ORDER BY player_index').all(req.params.id) as SessionRow[];
  res.json({ gameId: req.params.id, status: game.status, hostSessionId: game.host_session_id, players: sessions.map(s => ({ name: s.player_name, index: s.player_index })) });
});

// ── WebSocket ──────────────────────────────────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) { ws.close(4001, 'sessionId required'); return; }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
  if (!session) { ws.close(4002, 'Invalid session'); return; }

  const { game_id: gameId, player_index: playerIndex } = session;
  wsMeta.set(ws, { gameId, sessionId, playerIndex });
  if (!rooms.has(gameId)) rooms.set(gameId, new Set());
  rooms.get(gameId)!.add(ws);

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as GameRow;
  if (game.status === 'LOBBY') {
    broadcastLobby(gameId);
  } else {
    const state = getOrLoadState(gameId);
    if (state) ws.send(JSON.stringify({ type: 'state', state: serializeState(state), playerIndex }));
  }

  ws.on('message', (data) => {
    let msg: { type: string; name?: string; args?: unknown[] };
    try { msg = JSON.parse(data.toString()); } catch { return; }

    const meta = wsMeta.get(ws);
    if (!meta) return;
    const { gameId, playerIndex } = meta;

    if (msg.type === 'startGame') {
      const g = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as GameRow;
      if (meta.sessionId !== g.host_session_id) { ws.send(JSON.stringify({ type: 'error', message: 'Only host can start' })); return; }
      const s = db.prepare('SELECT * FROM sessions WHERE game_id = ? ORDER BY player_index').all(gameId) as SessionRow[];
      if (s.length < 2) { ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' })); return; }
      const state = startGame(s.map(p => p.player_name));
      gameStates.set(gameId, state);
      saveState(gameId, state);
      broadcastState(gameId);
      return;
    }

    if (msg.type === 'action') {
      const state = getOrLoadState(gameId);
      if (!state) { ws.send(JSON.stringify({ type: 'error', message: 'Game not found' })); return; }

      const isEndGame = msg.name === 'endGame';
      const isRotate   = msg.name === 'rotatePending';
      if (!isEndGame && !isRotate && playerIndex !== state.currentPlayerIndex) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' })); return;
      }

      let result: { ok: boolean; message?: string } = { ok: false, message: 'Unknown action' };
      try {
        switch (msg.name) {
          case 'drawTile':      result = drawTile(state); break;
          case 'rotatePending': result = rotatePending(state, (msg.args as ['CW'|'CCW'])[0]); break;
          case 'placeTile':     result = placeTile(state, (msg.args as [{ x: number; y: number }])[0]); break;
          case 'placeMeeple':   result = placeMeeple(state, (msg.args as [{ tileId: string; localId: number }])[0]); break;
          case 'skipMeeple':    result = skipMeeple(state); break;
          case 'endGame':       result = endGame(state); break;
        }
      } catch (e) { ws.send(JSON.stringify({ type: 'error', message: String(e) })); return; }

      if (result.ok) { saveState(gameId, state); broadcastState(gameId); }
      else { ws.send(JSON.stringify({ type: 'error', message: result.message })); }
    }
  });

  ws.on('close', () => {
    const m = wsMeta.get(ws);
    if (m) { rooms.get(m.gameId)?.delete(ws); wsMeta.delete(ws); }
  });
});

server.listen(PORT, () => console.log(`Carcassonne server on :${PORT}`));
