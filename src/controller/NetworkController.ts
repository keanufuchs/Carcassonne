import { canPlace } from '../core/board/placement';
import { getMeepleTargets } from '../core/game/Game';
import { deserializeState } from '../core/serialize';
import type { GameState } from '../core/game/GameState';
import type { Coord, SegmentRef, Result, Rotation, ErrorCode } from '../core/types';
import { okVoid } from '../core/types';
import type { GameController } from './GameController';
import { createPubSub } from './pubsub';
import type { Unsubscribe } from './pubsub';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const WS  = import.meta.env.VITE_WS_URL  ?? 'ws://localhost:3001';

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
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function apiError(res: Response): Promise<never> {
  try {
    const e = await res.json() as { error?: string };
    throw new Error(e.error ?? `HTTP ${res.status}`);
  } catch {
    throw new Error(`Server error (HTTP ${res.status}). Is the server running? Use: npm run dev:full`);
  }
}

export async function createGame(playerName: string): Promise<NetworkSession> {
  const res = await fetch(`${API}/api/games`, {
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
  const res = await fetch(`${API}/api/games/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, sessionId: existingSessionId }),
  });
  if (!res.ok) return apiError(res);
  return res.json() as Promise<NetworkSession>;
}

// ── Controller factory ─────────────────────────────────────────────────────

export function createNetworkController(session: NetworkSession): NetworkController {
  let state: GameState | null = null;
  const pubsub      = createPubSub<Readonly<GameState>>();
  const lobbyPubsub = createPubSub<LobbyInfo>();

  const ws = new WebSocket(`${WS}?sessionId=${session.sessionId}`);

  function send(msg: object): void {
    const payload = JSON.stringify(msg);
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    else ws.addEventListener('open', () => ws.send(payload), { once: true });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data as string) as {
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
  });

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
  };

  return controller;
}

// Re-export for convenience
export type { SegmentRef, Coord };
