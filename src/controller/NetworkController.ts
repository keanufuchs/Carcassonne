import { canPlace } from '../core/board/placement';
import { getMeepleTargets } from '../core/game/Game';
import { deserializeState } from '../core/serialize';
import type { GameState } from '../core/game/GameState';
import type { Coord, SegmentRef, Result, Rotation, ErrorCode } from '../core/types';
import { okVoid } from '../core/types';
import type { GameController } from './GameController';
import { createPubSub } from './pubsub';
import type { Unsubscribe } from './pubsub';

/**
 * Same-origin relative base URL. Requests go to whatever origin served the page
 * (localhost, LAN-IP, ngrok, …) and are forwarded by the Vite dev proxy
 * (`/api → :3001`) or the serverless functions in prod. An explicit VITE_API_URL
 * can override this, but the default must stay origin-relative so that a second
 * player joining over the LAN does not hit their own `localhost`.
 */
function apiBase(): string {
  return import.meta.env.VITE_API_URL || '';
}

/** Host is directly reachable on the game-server port (localhost or a private LAN IP). */
function isDirectlyReachable(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host.endsWith('.local')) return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

/**
 * WebSocket endpoint. Returns the page host on the game-server port (3001) when
 * that port is directly reachable (localhost / LAN), so a second player on the
 * LAN connects to the host instead of their own `localhost`.
 *
 * For tunneled origins (e.g. ngrok serving only :5173 over https) port 3001 is
 * NOT reachable, so we return '' → the client falls back to HTTP polling, which
 * is forwarded through the same-origin `/api` proxy.
 */
function wsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window === 'undefined') return '';
  const { protocol, hostname } = window.location;
  if (protocol === 'https:' || !isDirectlyReachable(hostname)) return '';
  return `ws://${hostname}:3001`;
}

const WS = wsUrl();
// Polling is the only transport without a reachable WS server (prod / tunneled / serverless).
const USE_POLLING = import.meta.env.PROD || !WS;

export interface NetworkSession {
  gameId: string;
  sessionId: string;
  playerIndex: number;
}

export interface LobbyInfo {
  gameId: string;
  players: { name: string; index: number }[];
  isHost: boolean;
}

export interface NetworkController extends GameController {
  readonly playerIndex: number;
  subscribeLobby(listener: (info: LobbyInfo) => void): Unsubscribe;
  /** Tear down the transport (stops polling / closes the socket). */
  leave(): void;
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function apiError(res: Response): Promise<never> {
  const body = await res.text();
  if (body) {
    try {
      const e = JSON.parse(body) as { error?: string };
      throw new Error(e.error ?? `HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(body.length > 200 ? `${body.slice(0, 200)}…` : body);
      }
      throw err;
    }
  }
  throw new Error(`Server error (HTTP ${res.status})`);
}

async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error('Server not reachable. Check your network connection.');
  }
}

export async function createGame(playerName: string): Promise<NetworkSession> {
  const res = await apiFetch(`${apiBase()}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName }),
  });
  if (!res.ok) return apiError(res);
  return res.json() as Promise<NetworkSession>;
}

export async function joinGame(
  gameId: string,
  playerName: string,
  existingSessionId?: string,
): Promise<NetworkSession> {
  const res = await apiFetch(`${apiBase()}/api/games/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, sessionId: existingSessionId }),
  });
  if (!res.ok) return apiError(res);
  return res.json() as Promise<NetworkSession>;
}

// ── Polling transport (Vercel / serverless) ────────────────────────────────

function createPollingTransport(session: NetworkSession, onMessage: (msg: object) => void): {
  send(msg: object): void;
  stop(): void;
} {
  let lobbyTimer: ReturnType<typeof setInterval> | null = null;
  let stateTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let inGame = false;

  async function pollLobby(): Promise<void> {
    if (stopped || inGame) return;
    try {
      const res = await fetch(
        `${apiBase()}/api/games/${session.gameId}/lobby?sessionId=${session.sessionId}`,
      );
      if (res.ok) onMessage({ type: 'lobby', ...(await res.json() as LobbyInfo) });
    } catch { /* retry on next tick */ }
  }

  async function pollState(): Promise<void> {
    if (stopped) return;
    try {
      const res = await fetch(
        `${apiBase()}/api/games/${session.gameId}/state?sessionId=${session.sessionId}`,
      );
      if (res.status === 204) return;
      if (res.ok) {
        inGame = true;
        if (lobbyTimer) { clearInterval(lobbyTimer); lobbyTimer = null; }
        const { state, playerIndex } = await res.json() as { state: string; playerIndex: number };
        onMessage({ type: 'state', state, playerIndex });
      }
    } catch { /* retry on next tick */ }
  }

  function startStatePolling(): void {
    if (stateTimer) return;
    stateTimer = setInterval(() => void pollState(), 500);
    void pollState();
  }

  lobbyTimer = setInterval(() => void pollLobby(), 1000);
  void pollLobby();
  startStatePolling();

  return {
    send(msg: object) {
      void apiFetch(`${apiBase()}/api/games/${session.gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, ...msg }),
      }).then(async (res) => {
        if (!res.ok) return;
        void pollState();
      });
    },
    stop() {
      stopped = true;
      if (lobbyTimer) clearInterval(lobbyTimer);
      if (stateTimer) clearInterval(stateTimer);
    },
  };
}

// ── WebSocket transport (local dev) ────────────────────────────────────────

function createWebSocketTransport(session: NetworkSession, onMessage: (msg: object) => void): {
  send(msg: object): void;
  stop(): void;
} {
  const ws = new WebSocket(`${WS}?sessionId=${session.sessionId}`);

  ws.addEventListener('message', (event) => {
    onMessage(JSON.parse(event.data as string) as object);
  });

  return {
    send(msg: object) {
      const payload = JSON.stringify(msg);
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
      else ws.addEventListener('open', () => ws.send(payload), { once: true });
    },
    stop() { ws.close(); },
  };
}

// ── Controller factory ─────────────────────────────────────────────────────

export function createNetworkController(session: NetworkSession): NetworkController {
  let state: GameState | null = null;
  const pubsub      = createPubSub<Readonly<GameState>>();
  const lobbyPubsub = createPubSub<LobbyInfo>();

  function handleMessage(raw: object): void {
    const msg = raw as {
      type: string;
      state?: string;
      gameId?: string;
      players?: LobbyInfo['players'];
      isHost?: boolean;
    };
    if (msg.type === 'state' && msg.state) {
      state = deserializeState(msg.state);
      pubsub.publish(state);
    } else if (msg.type === 'lobby') {
      lobbyPubsub.publish({
        gameId: msg.gameId!,
        players: msg.players!,
        isHost: msg.isHost!,
      });
    }
  }

  const transport = USE_POLLING
    ? createPollingTransport(session, handleMessage)
    : createWebSocketTransport(session, handleMessage);

  function send(msg: object): void {
    transport.send(msg);
  }

  function requireState(): GameState {
    if (!state) throw new Error('State not yet received');
    return state;
  }

  function action(name: string, ...args: unknown[]): Result {
    send({ type: 'action', name, args });
    return okVoid();
  }

  const controller: NetworkController = {
    playerIndex: session.playerIndex,

    startGame(_names: string[]) { send({ type: 'startGame' }); return okVoid(); },
    drawTile()         { return action('drawTile'); },
    rotatePending(dir) { return action('rotatePending', dir); },
    placeTile(coord)   { return action('placeTile', coord); },
    placeMeeple(ref)   { return action('placeMeeple', ref); },
    skipMeeple()       { return action('skipMeeple'); },
    endGame()          { return action('endGame'); },

    getState() { return requireState(); },

    previewPlacement(coord: Coord, rotation: Rotation) {
      if (!state || state.phase !== 'PLACING_TILE' || !state.pendingTile)
        return { legal: false, reason: 'WRONG_PHASE' as ErrorCode };
      if (canPlace(state.board, state.pendingTile, coord, rotation))
        return { legal: true };
      if (state.board.tiles.has(`${coord.x},${coord.y}`))
        return { legal: false, reason: 'CELL_OCCUPIED' as ErrorCode };
      return { legal: false, reason: 'EDGE_MISMATCH' as ErrorCode };
    },

    getMeepleTargetsForLastTile() {
      return state ? getMeepleTargets(state) : [];
    },

    subscribe(listener)      { return pubsub.subscribe(listener); },
    subscribeLobby(listener) { return lobbyPubsub.subscribe(listener); },

    leave() { transport.stop(); },
  };

  return controller;
}

export type { SegmentRef, Coord };
