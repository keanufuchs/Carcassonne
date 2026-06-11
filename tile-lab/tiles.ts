import type { TilePrototype } from '../src/core/types/tile';
import { BASE_GAME_DISTRIBUTION } from '../src/core/deck/baseGameTiles';
import tileDistribution from '../src/core/deck/tileDistribution.json';

// Shared source of truth — no duplication. Topology comes from the TS tile
// prototypes; asset paths come from the same tileDistribution.json the game
// uses; the SVG/PNG files are served from the game's `public/` via publicDir.

export interface LabTile {
  id: string;
  code: string;
  prototype: TilePrototype;
  pngPath: string;
  svgPath: string;
}

const protoById = new Map<string, TilePrototype>(
  BASE_GAME_DISTRIBUTION.map((entry) => [entry.prototype.id, entry.prototype]),
);

interface DistEntry { id: string; code: string; assetId: string; file: string }

export const LAB_TILES: LabTile[] = (tileDistribution.tiles as DistEntry[])
  .map((t) => {
    const prototype = protoById.get(t.id);
    if (!prototype) return null;
    return {
      id: t.id,
      code: t.code,
      prototype,
      pngPath: `/tiles/${t.assetId}.png`,
      svgPath: `/tiles/${t.file}`,
    } satisfies LabTile;
  })
  .filter((t): t is LabTile => t !== null);
