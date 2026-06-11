import express from 'express';
import cors from 'cors';
import {
  createGame,
  getGameInfo,
  getLobby,
  getState,
  handleMessage,
  joinGame,
} from './gameService.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/api/games', async (req, res) => {
    const { playerName } = req.body as { playerName?: string };
    if (!playerName?.trim()) { res.status(400).json({ error: 'playerName required' }); return; }
    res.json(await createGame(playerName));
  });

  app.post('/api/games/:id/join', async (req, res) => {
    const { playerName, sessionId: existingSession } = req.body as { playerName?: string; sessionId?: string };
    const result = await joinGame(req.params.id, playerName, existingSession);
    if ('error' in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result);
  });

  app.get('/api/games/:id', async (req, res) => {
    const info = await getGameInfo(req.params.id);
    if (!info) { res.status(404).json({ error: 'Game not found' }); return; }
    res.json(info);
  });

  // Polling endpoints (used on Vercel where WebSockets are unavailable)
  app.get('/api/games/:id/lobby', async (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
    const lobby = await getLobby(sessionId);
    if ('error' in lobby) { res.status(lobby.status).json({ error: lobby.error }); return; }
    res.json(lobby);
  });

  app.get('/api/games/:id/state', async (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
    const payload = await getState(sessionId);
    if (payload && 'error' in payload) { res.status(payload.status).json({ error: payload.error }); return; }
    if (!payload) { res.status(204).end(); return; }
    res.json(payload);
  });

  app.post('/api/games/:id/action', async (req, res) => {
    const { sessionId, ...msg } = req.body as { sessionId?: string; type: string; name?: string; args?: unknown[] };
    if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
    const result = await handleMessage(sessionId, msg);
    if (result.error) { res.status(result.status ?? 400).json({ error: result.error }); return; }
    res.json({ ok: true });
  });

  return app;
}

export const app = createApp();
