export interface Tick {
  gameCoord: number;
  screenPos: number;
}

/**
 * Returns the coordinate ticks visible inside a ruler of `viewportSize` pixels,
 * given the board canvas transform (offset + scale) along one axis.
 *
 * offset       — translateX or translateY of the board canvas (pixels)
 * scale        — uniform scale of the board canvas
 * viewportSize — width (X ruler) or height (Y ruler) of the ruler in pixels
 */
export function getVisibleTicks(
  offset: number,
  scale: number,
  viewportSize: number,
  tileSize: number,
  coordOffset: number,
): Tick[] {
  const tileScreenSize = tileSize * scale;
  const first = Math.floor(-offset / tileScreenSize) - coordOffset;
  const last  = Math.ceil((viewportSize - offset) / tileScreenSize) - coordOffset;
  const skipFactor = Math.max(1, Math.ceil(28 / tileScreenSize));

  const ticks: Tick[] = [];
  for (let g = first; g <= last; g++) {
    if (g % skipFactor !== 0) continue;
    ticks.push({
      gameCoord: g,
      screenPos: (g + coordOffset) * tileScreenSize + offset,
    });
  }
  return ticks;
}
