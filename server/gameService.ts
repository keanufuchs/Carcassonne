import { randomUUID } from 'crypto';
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
import { store } from './store/index.js';
import type { GameRecord, LobbyPayload, SessionRecord } from './types.js';

function generateGameId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export async function createGame(playerName: string): Promise<{ gameId: string; sessionId: string; playerIndex: number }> {
  let gameId = generateGameId();
  while (await store.hasGame(gameId)) gameId = generateGameId();

  const sessionId = randomUUID();
  const game: GameRecord = { id: gameId, hostSessionId: sessionId, status: 'LOBBY', state: null };
  const session: SessionRecord = { id: sessionId, gameId, playerName: playerName.trim(), playerIndex: 0 };

  await store.setGame(gameId, game);
  await store.setSession(sessionId, session);

  return { gameId, sessionId, playerIndex: 0 };
}

export async function joinGame(
  gameId: string,
  playerName: string | undefined,
  existingSessionId: string | undefined,
): Promise<{ gameId: string; sessionId: string; playerIndex: number } | { error: string; status: number }> {
  const game = await store.getGame(gameId);
  if (!game) return { error: 'Game not found', status: 404 };
  if (game.status !== 'LOBBY') return { error: 'Game already started', status: 400 };

  if (existingSessionId) {
    const s = await store.getSession(existingSessionId);
    if (s && s.gameId === gameId) {
      return { gameId, sessionId: existingSessionId, playerIndex: s.playerIndex };
    }
  }

  if (!playerName?.trim()) return { error: 'playerName required', status: 400 };
  const gameSessions = await store.getGameSessions(gameId);
  if (gameSessions.length >= 5) return { error: 'Game is full', status: 400 };

  const newSessionId = randomUUID();
  const session: SessionRecord = {
    id: newSessionId,
    gameId,
    playerName: playerName.trim(),
    playerIndex: gameSessions.length,
  };
  await store.setSession(newSessionId, session);

  return { gameId, sessionId: newSessionId, playerIndex: gameSessions.length };
}

export async function getGameInfo(gameId: string) {
  const game = await store.getGame(gameId);
  if (!game) return null;
  const players = (await store.getGameSessions(gameId)).map(s => ({ name: s.playerName, index: s.playerIndex }));
  return { gameId, status: game.status, players };
}

export async function getLobby(sessionId: string): Promise<LobbyPayload | { error: string; status: number }> {
  const session = await store.getSession(sessionId);
  if (!session) return { error: 'Invalid session', status: 401 };

  const game = await store.getGame(session.gameId);
  if (!game) return { error: 'Game not found', status: 404 };

  const players = (await store.getGameSessions(session.gameId)).map(s => ({ name: s.playerName, index: s.playerIndex }));
  return {
    gameId: session.gameId,
    players,
    isHost: session.id === game.hostSessionId,
  };
}

export async function getState(sessionId: string): Promise<{ state: string; playerIndex: number } | { error: string; status: number } | null> {
  const session = await store.getSession(sessionId);
  if (!session) return { error: 'Invalid session', status: 401 };

  const game = await store.getGame(session.gameId);
  if (!game?.state) return null;

  return { state: serializeState(game.state), playerIndex: session.playerIndex };
}

export async function handleMessage(
  sessionId: string,
  msg: { type: string; name?: string; args?: unknown[] },
): Promise<{ error?: string; status?: number }> {
  const session = await store.getSession(sessionId);
  if (!session) return { error: 'Invalid session', status: 401 };

  const game = await store.getGame(session.gameId);
  if (!game) return { error: 'Game not found', status: 404 };

  if (msg.type === 'startGame') {
    if (sessionId !== game.hostSessionId) return { error: 'Only host can start', status: 403 };
    const gameSessions = await store.getGameSessions(session.gameId);
    if (gameSessions.length < 2) return { error: 'Need at least 2 players', status: 400 };

    game.state = startGame(gameSessions.map(p => p.playerName));
    game.status = 'PLAYING';
    await store.setGame(session.gameId, game);
    return {};
  }

  if (msg.type === 'action') {
    if (!game.state) return { error: 'Game not started', status: 400 };

    const state = game.state;
    const isEndGame = msg.name === 'endGame';
    const isRotate = msg.name === 'rotatePending';
    if (!isEndGame && !isRotate && session.playerIndex !== state.currentPlayerIndex) {
      return { error: 'Not your turn', status: 403 };
    }

    let result: { ok: boolean; message?: string } = { ok: false, message: 'Unknown action' };
    try {
      switch (msg.name) {
        case 'drawTile':      result = drawTile(state); break;
        case 'rotatePending': result = rotatePending(state, (msg.args as ['CW' | 'CCW'])[0]); break;
        case 'placeTile':     result = placeTile(state, (msg.args as [{ x: number; y: number }])[0]); break;
        case 'placeMeeple':   result = placeMeeple(state, (msg.args as [{ tileId: string; localId: number }])[0]); break;
        case 'skipMeeple':    result = skipMeeple(state); break;
        case 'endGame':       result = endGame(state); break;
      }
    } catch (e) {
      return { error: String(e), status: 500 };
    }

    if (!result.ok) return { error: result.message ?? 'Action failed', status: 400 };

    if (state.phase === 'GAME_OVER') game.status = 'GAME_OVER';
    await store.setGame(session.gameId, game);
    return {};
  }

  return { error: 'Unknown message type', status: 400 };
}

// ── WebSocket helpers (local dev) ─────────────────────────────────────────

export async function buildLobbyMessage(sessionId: string): Promise<{ type: 'lobby'; gameId: string; players: LobbyPayload['players']; isHost: boolean } | null> {
  const lobby = await getLobby(sessionId);
  if ('error' in lobby) return null;
  return { type: 'lobby', gameId: lobby.gameId, players: lobby.players, isHost: lobby.isHost };
}

export async function buildStateMessage(sessionId: string): Promise<{ type: 'state'; state: string; playerIndex: number } | null> {
  const payload = await getState(sessionId);
  if (!payload || 'error' in payload) return null;
  return { type: 'state', state: payload.state, playerIndex: payload.playerIndex };
}

export { store };
