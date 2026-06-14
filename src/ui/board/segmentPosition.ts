import type { EdgeSlot, SegmentKind } from '../../core/types/tile';

// Unrotated percentage coordinates for each edge slot.
// N/S: L=west end, C=center, R=east end
// E/W: L=north end, C=center, R=south end (viewed from outside)
const SLOT_XY: Record<string, [number, number]> = {
  'N/L': [20, 10], 'N/C': [50, 10], 'N/R': [80, 10],
  'E/L': [90, 20], 'E/C': [90, 50], 'E/R': [90, 80],
  'S/L': [80, 90], 'S/C': [50, 90], 'S/R': [20, 90],
  'W/L': [10, 80], 'W/C': [10, 50], 'W/R': [10, 20],
};

function rotatePoint(x: number, y: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  const dx = x - 50, dy = y - 50;
  return [
    50 + dx * Math.cos(rad) - dy * Math.sin(rad),
    50 + dx * Math.sin(rad) + dy * Math.cos(rad),
  ];
}

/**
 * Returns the visual center of a segment on the tile as percentages [0..100].
 * Rotation matches the CSS transform applied to the tile image.
 */
export function segmentPosition(
  kind: SegmentKind,
  edgeSlots: EdgeSlot[],
  rotation: number,
): { x: number; y: number } {
  if (kind === 'MONASTERY' || edgeSlots.length === 0) {
    return { x: 50, y: 50 };
  }
  let sumX = 0, sumY = 0;
  for (const { side, pos } of edgeSlots) {
    const [ex, ey] = SLOT_XY[`${side}/${pos}`];
    sumX += ex;
    sumY += ey;
  }
  const [rx, ry] = rotatePoint(sumX / edgeSlots.length, sumY / edgeSlots.length, rotation);
  return { x: rx, y: ry };
}
