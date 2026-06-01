import { get, head, put, BlobPreconditionFailedError } from '@vercel/blob';
import { deserializeState, serializeState } from '../../src/core/serialize.js';
import type { GameRecord, SessionRecord } from '../types.js';

interface StoredGame {
  id: string;
  hostSessionId: string;
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  stateJson: string | null;
}

interface GameBundle {
  game: StoredGame;
  sessions: SessionRecord[];
}

interface SessionIndex {
  gameId: string;
}

const gamePath = (id: string) => `games/${id}.json`;
const sessionIndexPath = (id: string) => `sessions/${id}.json`;

function toStored(game: GameRecord): StoredGame {
  return {
    id: game.id,
    hostSessionId: game.hostSessionId,
    status: game.status,
    stateJson: game.state ? serializeState(game.state) : null,
  };
}

function fromStored(stored: StoredGame): GameRecord {
  return {
    id: stored.id,
    hostSessionId: stored.hostSessionId,
    status: stored.status,
    state: stored.stateJson ? deserializeState(stored.stateJson) : null,
  };
}

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(pathname: string, data: unknown, retries = 3): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    let etag: string | undefined;
    try {
      const meta = await head(pathname);
      etag = meta.etag;
    } catch {
      // new blob
    }

    try {
      await put(pathname, JSON.stringify(data), {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError && attempt < retries - 1) continue;
      throw err;
    }
  }
}

async function readBundle(gameId: string): Promise<GameBundle | null> {
  return readJson<GameBundle>(gamePath(gameId));
}

async function writeBundle(bundle: GameBundle): Promise<void> {
  await writeJson(gamePath(bundle.game.id), bundle);
}

export const blobStore = {
  async getGame(id: string): Promise<GameRecord | null> {
    const bundle = await readBundle(id);
    return bundle ? fromStored(bundle.game) : null;
  },

  async setGame(id: string, game: GameRecord): Promise<void> {
    const bundle = await readBundle(id);
    if (!bundle) {
      await writeBundle({ game: toStored(game), sessions: [] });
      return;
    }
    bundle.game = toStored(game);
    await writeBundle(bundle);
  },

  async hasGame(id: string): Promise<boolean> {
    try {
      await head(gamePath(id));
      return true;
    } catch {
      return false;
    }
  },

  async getSession(id: string): Promise<SessionRecord | null> {
    const index = await readJson<SessionIndex>(sessionIndexPath(id));
    if (!index) return null;
    const bundle = await readBundle(index.gameId);
    return bundle?.sessions.find(s => s.id === id) ?? null;
  },

  async setSession(id: string, session: SessionRecord): Promise<void> {
    await writeJson(sessionIndexPath(id), { gameId: session.gameId } satisfies SessionIndex);

    const bundle = await readBundle(session.gameId);
    if (!bundle) {
      throw new Error(`Game ${session.gameId} not found`);
    }

    const idx = bundle.sessions.findIndex(s => s.id === id);
    if (idx >= 0) bundle.sessions[idx] = session;
    else bundle.sessions.push(session);

    await writeBundle(bundle);
  },

  async getGameSessions(gameId: string): Promise<SessionRecord[]> {
    const bundle = await readBundle(gameId);
    return (bundle?.sessions ?? []).sort((a, b) => a.playerIndex - b.playerIndex);
  },
};
