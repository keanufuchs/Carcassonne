import { blobStore } from './blobStore.js';
import { memoryStore } from './memoryStore.js';
import type { GameRecord, SessionRecord } from '../types.js';

export interface GameStore {
  getGame(id: string): Promise<GameRecord | null>;
  setGame(id: string, game: GameRecord): Promise<void>;
  hasGame(id: string): Promise<boolean>;
  getSession(id: string): Promise<SessionRecord | null>;
  setSession(id: string, session: SessionRecord): Promise<void>;
  getGameSessions(gameId: string): Promise<SessionRecord[]>;
}

/** Vercel Blob (BLOB_READ_WRITE_TOKEN) on production; in-memory locally. */
function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const store: GameStore = useBlob() ? blobStore : memoryStore;
