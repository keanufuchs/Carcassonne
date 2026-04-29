import type { GameState } from './game/GameState';
import type { PlacedTile, SegmentInstance } from './tile/Tile';
import type { Feature, MeeplePlacement } from './feature/Feature';
import type { Board } from './board/Board';
import type { Deck } from './deck/Deck';
import type { TilePrototype } from './types/tile';
import type { Player } from './types';
import { BASE_GAME_DISTRIBUTION, START_TILE } from './deck/baseGameTiles';
import { _setNextTileSeq } from './tile/Tile';
import { registerProto } from './board/placement';

// ── Serialized shapes ──────────────────────────────────────────────────────

interface SerializedFeature {
  id: string;
  kind: string;
  segments: string[];
  openEdges: number;
  meeples: MeeplePlacement[];
  shieldCount: number;
  completed: boolean;
  monasteryTileId?: string;
  monasterySurroundCount?: number;
  closedCitiesAdjacent?: string[];
}

interface SerializedTile {
  tileId: string;
  prototypeId: string;
  coord: { x: number; y: number };
  rotation: number;
  segmentInstances: SegmentInstance[];
}

export interface SerializedState {
  version: number;
  currentPlayerIndex: number;
  phase: string;
  pendingTileId: string | null;
  pendingRotation: number;
  lastPlacedTileId: string | null;
  lastCompletedFeatures: string[];
  players: Player[];
  deck: { startTileId: string; remainingIds: string[] };
  board: {
    tiles: [string, SerializedTile][];
    registry: {
      nextId: number;
      features: [string, SerializedFeature][];
      segmentToFeature: [string, string][];
    };
  };
}

// ── Prototype lookup ───────────────────────────────────────────────────────

const protoById = new Map<string, TilePrototype>();
protoById.set(START_TILE.id, START_TILE);
for (const { prototype } of BASE_GAME_DISTRIBUTION) {
  protoById.set(prototype.id, prototype);
}

function getProto(id: string): TilePrototype {
  const p = protoById.get(id);
  if (!p) throw new Error(`Unknown prototype: ${id}`);
  return p;
}

// ── Serialize ──────────────────────────────────────────────────────────────

export function serializeState(state: GameState): string {
  const s: SerializedState = {
    version: state.version,
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    pendingTileId: state.pendingTile?.id ?? null,
    pendingRotation: state.pendingRotation,
    lastPlacedTileId: state.lastPlacedTileId,
    lastCompletedFeatures: state.lastCompletedFeatures,
    players: state.players,
    deck: {
      startTileId: state.deck.startTile.id,
      remainingIds: state.deck.remaining.map(t => t.id),
    },
    board: {
      tiles: [...state.board.tiles.entries()].map(([k, t]) => [k, {
        tileId: t.tileId,
        prototypeId: t.prototypeId,
        coord: t.coord,
        rotation: t.rotation,
        segmentInstances: t.segmentInstances,
      }]),
      registry: {
        nextId: state.board.registry.nextId,
        features: [...state.board.registry.features.entries()].map(([k, f]) => [k, {
          id: f.id,
          kind: f.kind,
          segments: [...f.segments],
          openEdges: f.openEdges,
          meeples: f.meeples,
          shieldCount: f.shieldCount,
          completed: f.completed,
          monasteryTileId: f.monasteryTileId,
          monasterySurroundCount: f.monasterySurroundCount,
          closedCitiesAdjacent: f.closedCitiesAdjacent ? [...f.closedCitiesAdjacent] : undefined,
        }]),
        segmentToFeature: [...state.board.registry.segmentToFeature.entries()],
      },
    },
  };
  return JSON.stringify(s);
}

// ── Deserialize ────────────────────────────────────────────────────────────

export function deserializeState(json: string): GameState {
  const d = JSON.parse(json) as SerializedState;

  const features = new Map<string, Feature>();
  for (const [k, f] of d.board.registry.features) {
    features.set(k, {
      id: f.id,
      kind: f.kind as Feature['kind'],
      segments: new Set(f.segments),
      openEdges: f.openEdges,
      meeples: f.meeples,
      shieldCount: f.shieldCount,
      completed: f.completed,
      monasteryTileId: f.monasteryTileId,
      monasterySurroundCount: f.monasterySurroundCount,
      closedCitiesAdjacent: f.closedCitiesAdjacent ? new Set(f.closedCitiesAdjacent) : undefined,
    });
  }

  const tiles = new Map<string, PlacedTile>();
  let maxSeq = 0;
  for (const [k, t] of d.board.tiles) {
    tiles.set(k, {
      tileId: t.tileId,
      prototypeId: t.prototypeId,
      coord: t.coord,
      rotation: t.rotation as PlacedTile['rotation'],
      segmentInstances: t.segmentInstances,
    });
    registerProto(getProto(t.prototypeId));
    const n = parseInt(t.tileId.slice(1));
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }

  _setNextTileSeq(maxSeq + 1);

  const board: Board = {
    tiles,
    registry: {
      nextId: d.board.registry.nextId,
      features,
      segmentToFeature: new Map(d.board.registry.segmentToFeature),
    },
  };

  const deck: Deck = {
    startTile: getProto(d.deck.startTileId),
    remaining: d.deck.remainingIds.map(getProto),
  };

  return {
    version: d.version,
    board,
    deck,
    players: d.players,
    currentPlayerIndex: d.currentPlayerIndex,
    phase: d.phase as GameState['phase'],
    pendingTile: d.pendingTileId ? (() => { const p = getProto(d.pendingTileId!); registerProto(p); return p; })() : null,
    pendingRotation: d.pendingRotation as GameState['pendingRotation'],
    lastPlacedTileId: d.lastPlacedTileId,
    lastCompletedFeatures: d.lastCompletedFeatures,
  };
}
