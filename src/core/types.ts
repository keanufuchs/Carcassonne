export type {
  Terrain, EdgeSide, SlotPos, Rotation,
  SegmentKind, SegmentLocalId, EdgeSlot,
  SegmentBlueprint, TilePrototype,
} from './types/tile';

export type Coord = { x: number; y: number };
export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const parseCoordKey = (k: string): Coord => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};

export type PlayerId  = string;
export type FeatureId = string;
export type TileId    = string;
export type SegmentLocalId = number;

export type SegmentRef = { tileId: TileId; localId: SegmentLocalId };
export const segmentKey = (s: SegmentRef): string => `${s.tileId}#${s.localId}`;
export const parseSegmentKey = (k: string): SegmentRef => {
  const hash = k.lastIndexOf('#');
  return { tileId: k.slice(0, hash), localId: Number(k.slice(hash + 1)) };
};

export type ErrorCode =
  | 'CELL_OCCUPIED'
  | 'EDGE_MISMATCH'
  | 'NOT_ADJACENT'
  | 'WRONG_PHASE'
  | 'NO_PENDING_TILE'
  | 'MEEPLE_FEATURE_OCCUPIED'
  | 'MEEPLE_NOT_ON_PLACED_TILE'
  | 'MEEPLE_FEATURE_COMPLETED'
  | 'NO_MEEPLES_AVAILABLE'
  | 'GAME_OVER';

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: ErrorCode; message: string };

export const ok     = <T>(value: T): Result<T> => ({ ok: true, value });
export const okVoid = (): Result<void>          => ({ ok: true, value: undefined });
export const err    = (error: ErrorCode, message: string): Result<never> =>
  ({ ok: false, error, message });

export const MEEPLES_PER_PLAYER = 7;
export const PLAYER_COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#457b9d', '#6a0572'] as const;

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  score: number;
  meeplesAvailable: number;
}

export type GamePhase =
  | 'NOT_STARTED'
  | 'PLACING_TILE'
  | 'PLACING_MEEPLE'
  | 'GAME_OVER';
