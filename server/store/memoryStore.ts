import type { GameRecord, SessionRecord } from '../types.js';

const games = new Map<string, GameRecord>();
const sessions = new Map<string, SessionRecord>();

export const memoryStore = {
  async getGame(id: string): Promise<GameRecord | null> {
    return games.get(id) ?? null;
  },

  async setGame(id: string, game: GameRecord): Promise<void> {
    games.set(id, game);
  },

  async hasGame(id: string): Promise<boolean> {
    return games.has(id);
  },

  async getSession(id: string): Promise<SessionRecord | null> {
    return sessions.get(id) ?? null;
  },

  async setSession(id: string, session: SessionRecord): Promise<void> {
    sessions.set(id, session);
  },

  async getGameSessions(gameId: string): Promise<SessionRecord[]> {
    return [...sessions.values()]
      .filter(s => s.gameId === gameId)
      .sort((a, b) => a.playerIndex - b.playerIndex);
  },
};
