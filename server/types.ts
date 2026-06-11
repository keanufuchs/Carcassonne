import type { GameState } from '../src/core/game/GameState.js';

export interface GameRecord {
  id: string;
  hostSessionId: string;
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  state: GameState | null;
}

export interface SessionRecord {
  id: string;
  gameId: string;
  playerName: string;
  playerIndex: number;
}

export interface LobbyPayload {
  gameId: string;
  players: { name: string; index: number }[];
  isHost: boolean;
}

export interface StatePayload {
  type: 'state';
  state: string;
  playerIndex: number;
}

export interface LobbyMessage {
  type: 'lobby';
  gameId: string;
  players: LobbyPayload['players'];
  isHost: boolean;
}
