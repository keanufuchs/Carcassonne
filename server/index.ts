import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { app } from './app.js';
import { buildLobbyMessage, buildStateMessage, handleMessage } from './gameService.js';
import { store } from './store/index.js';

// ── WebSocket rooms (local dev only) ───────────────────────────────────────

const rooms = new Map<string, Set<WebSocket>>();
interface WsMeta { gameId: string; sessionId: string; playerIndex: number }
const wsMeta = new Map<WebSocket, WsMeta>();

async function broadcastState(gameId: string): Promise<void> {
  const room = rooms.get(gameId);
  if (!room) return;
  for (const ws of room) {
    const meta = wsMeta.get(ws);
    if (ws.readyState === WebSocket.OPEN && meta) {
      const msg = await buildStateMessage(meta.sessionId);
      if (msg) ws.send(JSON.stringify(msg));
    }
  }
}

async function broadcastLobby(gameId: string): Promise<void> {
  const room = rooms.get(gameId);
  if (!room) return;
  for (const ws of room) {
    const meta = wsMeta.get(ws);
    if (ws.readyState === WebSocket.OPEN && meta) {
      const msg = await buildLobbyMessage(meta.sessionId);
      if (msg) ws.send(JSON.stringify(msg));
    }
  }
}

// ── WebSocket server ───────────────────────────────────────────────────────

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) { ws.close(4001, 'sessionId required'); return; }

  void (async () => {
    const session = await store.getSession(sessionId);
    if (!session) { ws.close(4002, 'Invalid session'); return; }

    const { gameId, playerIndex } = session;
    wsMeta.set(ws, { gameId, sessionId, playerIndex });
    if (!rooms.has(gameId)) rooms.set(gameId, new Set());
    rooms.get(gameId)!.add(ws);

    const game = await store.getGame(gameId);
    if (game?.status === 'LOBBY') {
      await broadcastLobby(gameId);
    } else if (game?.state) {
      const msg = await buildStateMessage(sessionId);
      if (msg) ws.send(JSON.stringify(msg));
    }

    ws.on('message', (data) => {
      void (async () => {
        let msg: { type: string; name?: string; args?: unknown[] };
        try { msg = JSON.parse(data.toString()); } catch { return; }

        const meta = wsMeta.get(ws);
        if (!meta) return;

        const result = await handleMessage(meta.sessionId, msg);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
          return;
        }

        if (msg.type === 'startGame' || msg.type === 'action') {
          await broadcastState(meta.gameId);
        }
      })();
    });

    ws.on('close', () => {
      const m = wsMeta.get(ws);
      if (m) { rooms.get(m.gameId)?.delete(ws); wsMeta.delete(ws); }
    });
  })();
});

// ── Start ──────────────────────────────────────────────────────────────────

export function startServer(port = 3001): void {
  httpServer.listen(port, () => console.log(`Carcassonne server on :${port}`));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer(process.env.PORT ? parseInt(process.env.PORT) : 3001);
}
