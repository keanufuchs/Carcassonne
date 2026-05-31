import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { serializeState } from '../src/core/serialize.js';
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

// ── In-memory state ────────────────────────────────────────────────────────

interface GameRecord {
  id: string;
  hostSessionId: string;
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  state: GameState | null;
}

interface SessionRecord {
  id: string;
  gameId: string;
  playerName: string;
  playerIndex: number;
}

const games    = new Map<string, GameRecord>();
const sessions = new Map<string, SessionRecord>();

function generateGameId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getGameSessions(gameId: string): SessionRecord[] {
  return [...sessions.values()]
    .filter(s => s.gameId === gameId)
    .sort((a, b) => a.playerIndex - b.playerIndex);
}

// ── WebSocket rooms ────────────────────────────────────────────────────────

const rooms = new Map<string, Set<WebSocket>>();
interface WsMeta { gameId: string; sessionId: string; playerIndex: number }
const wsMeta = new Map<WebSocket, WsMeta>();

function broadcastState(gameId: string): void {
  const game = games.get(gameId);
  const room = rooms.get(gameId);
  if (!game?.state || !room) return;
  const stateJson = serializeState(game.state);
  for (const ws of room) {
    const meta = wsMeta.get(ws);
    if (ws.readyState === WebSocket.OPEN && meta) {
      ws.send(JSON.stringify({ type: 'state', state: stateJson, playerIndex: meta.playerIndex }));
    }
  }
}

function broadcastLobby(gameId: string): void {
  const game = games.get(gameId);
  const room = rooms.get(gameId);
  if (!game || !room) return;
  const players = getGameSessions(gameId).map(s => ({ name: s.playerName, index: s.playerIndex }));
  for (const ws of room) {
    const meta = wsMeta.get(ws);
    if (ws.readyState === WebSocket.OPEN && meta) {
      ws.send(JSON.stringify({ type: 'lobby', gameId, players, isHost: meta.sessionId === game.hostSessionId }));
    }
  }
}

// ── HTTP API ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/games', (req, res) => {
  const { playerName } = req.body as { playerName?: string };
  if (!playerName?.trim()) { res.status(400).json({ error: 'playerName required' }); return; }

  let gameId = generateGameId();
  while (games.has(gameId)) gameId = generateGameId();

  const sessionId = randomUUID();
  games.set(gameId, { id: gameId, hostSessionId: sessionId, status: 'LOBBY', state: null });
  sessions.set(sessionId, { id: sessionId, gameId, playerName: playerName.trim(), playerIndex: 0 });

  res.json({ gameId, sessionId, playerIndex: 0 });
});

app.post('/api/games/:id/join', (req, res) => {
  const gameId = req.params.id;
  const { playerName, sessionId: existingSession } = req.body as { playerName?: string; sessionId?: string };

  const game = games.get(gameId);
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  if (game.status !== 'LOBBY') { res.status(400).json({ error: 'Game already started' }); return; }

  if (existingSession) {
    const s = sessions.get(existingSession);
    if (s && s.gameId === gameId) { res.json({ gameId, sessionId: existingSession, playerIndex: s.playerIndex }); return; }
  }

  if (!playerName?.trim()) { res.status(400).json({ error: 'playerName required' }); return; }
  const gameSessions = getGameSessions(gameId);
  if (gameSessions.length >= 5) { res.status(400).json({ error: 'Game is full' }); return; }

  const newSessionId = randomUUID();
  sessions.set(newSessionId, { id: newSessionId, gameId, playerName: playerName.trim(), playerIndex: gameSessions.length });

  res.json({ gameId, sessionId: newSessionId, playerIndex: gameSessions.length });
});

app.get('/api/games/:id', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  const players = getGameSessions(req.params.id).map(s => ({ name: s.playerName, index: s.playerIndex }));
  res.json({ gameId: req.params.id, status: game.status, players });
});

// ── WebSocket ──────────────────────────────────────────────────────────────

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) { ws.close(4001, 'sessionId required'); return; }

  const session = sessions.get(sessionId);
  if (!session) { ws.close(4002, 'Invalid session'); return; }

  const { gameId, playerIndex } = session;
  wsMeta.set(ws, { gameId, sessionId, playerIndex });
  if (!rooms.has(gameId)) rooms.set(gameId, new Set());
  rooms.get(gameId)!.add(ws);

  const game = games.get(gameId)!;
  if (game.status === 'LOBBY') {
    broadcastLobby(gameId);
  } else if (game.state) {
    ws.send(JSON.stringify({ type: 'state', state: serializeState(game.state), playerIndex }));
  }

  ws.on('message', (data) => {
    let msg: { type: string; name?: string; args?: unknown[] };
    try { msg = JSON.parse(data.toString()); } catch { return; }

    const meta = wsMeta.get(ws);
    if (!meta) return;
    const currentGame = games.get(meta.gameId);
    if (!currentGame) return;

    if (msg.type === 'startGame') {
      if (meta.sessionId !== currentGame.hostSessionId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only host can start' })); return;
      }
      const gameSessions = getGameSessions(meta.gameId);
      if (gameSessions.length < 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' })); return;
      }
      const state = startGame(gameSessions.map(p => p.playerName));
      currentGame.state = state;
      currentGame.status = 'PLAYING';
      broadcastState(meta.gameId);
      return;
    }

    if (msg.type === 'action') {
      if (!currentGame.state) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not started' })); return;
      }
      const state = currentGame.state;
      const isEndGame = msg.name === 'endGame';
      const isRotate  = msg.name === 'rotatePending';
      if (!isEndGame && !isRotate && meta.playerIndex !== state.currentPlayerIndex) {
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

      if (result.ok) {
        if (state.phase === 'GAME_OVER') currentGame.status = 'GAME_OVER';
        broadcastState(meta.gameId);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: result.message }));
      }
    }
  });

  ws.on('close', () => {
    const m = wsMeta.get(ws);
    if (m) { rooms.get(m.gameId)?.delete(ws); wsMeta.delete(ws); }
  });
});

// ── Start ──────────────────────────────────────────────────────────────────

export function startServer(port = 3001): void {
  httpServer.listen(port, () => console.log(`Carcassonne server on :${port}`));
}

// Direct execution: tsx server/index.ts
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer(process.env.PORT ? parseInt(process.env.PORT) : 3001);
}
