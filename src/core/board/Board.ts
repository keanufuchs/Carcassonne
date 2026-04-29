import type { Coord } from '../types';
import { coordKey } from '../types';
import type { PlacedTile } from '../tile/Tile';
import type { FeatureRegistry } from '../feature/segments';
import { createRegistry } from '../feature/segments';
import type { EdgeSide } from '../types/tile';
import { stepCoord } from '../tile/rotation';

export interface Board {
  tiles: Map<string, PlacedTile>;
  registry: FeatureRegistry;
}

export function createEmptyBoard(): Board {
  return { tiles: new Map(), registry: createRegistry() };
}

export function getTileAt(board: Board, coord: Coord): PlacedTile | undefined {
  return board.tiles.get(coordKey(coord));
}

export function getNeighbor(board: Board, coord: Coord, side: EdgeSide): PlacedTile | undefined {
  return getTileAt(board, stepCoord(coord, side));
}

export function allEightNeighborCoords(coord: Coord): Coord[] {
  const { x, y } = coord;
  return [
    { x: x - 1, y: y - 1 }, { x, y: y - 1 }, { x: x + 1, y: y - 1 },
    { x: x - 1, y },                           { x: x + 1, y },
    { x: x - 1, y: y + 1 }, { x, y: y + 1 }, { x: x + 1, y: y + 1 },
  ];
}

export function countPlacedNeighbors(board: Board, coord: Coord): number {
  return allEightNeighborCoords(coord).filter(c => board.tiles.has(coordKey(c))).length;
}

export function candidatePlacements(board: Board): Coord[] {
  const seen = new Set<string>();
  const result: Coord[] = [];
  for (const key of board.tiles.keys()) {
    const [x, y] = key.split(',').map(Number);
    for (const side of (['N', 'E', 'S', 'W'] as EdgeSide[])) {
      const n = stepCoord({ x, y }, side);
      const nk = coordKey(n);
      if (!board.tiles.has(nk) && !seen.has(nk)) {
        seen.add(nk);
        result.push(n);
      }
    }
  }
  return result;
}
