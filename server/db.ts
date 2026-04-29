import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const db = new Database(join(__dirname, '..', 'carcassonne.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id               TEXT PRIMARY KEY,
    host_session_id  TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'LOBBY',
    state_json       TEXT,
    created_at       INTEGER DEFAULT (unixepoch()),
    updated_at       INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    game_id      TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_name  TEXT NOT NULL,
    player_index INTEGER NOT NULL
  );
`);

export interface GameRow {
  id: string;
  host_session_id: string;
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  state_json: string | null;
}

export interface SessionRow {
  id: string;
  game_id: string;
  player_name: string;
  player_index: number;
}
