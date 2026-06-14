import { useEffect, useRef } from 'react';
import { parseSegmentLocalId, segmentClasses } from './tileHighlight';

interface Props {
  /** raw <svg>…</svg> markup of the tile (its own viewBox 0 0 100 100) */
  markup: string;
  rotation: number;
  size: number;
  /** localIds that are placeable this turn (subtle persistent affordance) */
  targetLocalIds?: number[];
  /** localIds of the currently hovered feature (strong highlight) */
  highlightLocalIds?: number[];
  altText?: string;
}

/**
 * Renders a tile as its real, inline SVG and highlights feature segments in
 * place. Because the segments keep their original fills and paint order, a
 * highlight on (say) a field only shows where the field is actually visible —
 * the city/road painted on top clips it. This is what makes highlights match
 * the drawn shapes instead of bleeding across the tile.
 */
export function InlineTile({ markup, rotation, size, targetLocalIds = [], highlightLocalIds = [], altText }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  const targetKey = targetLocalIds.join(',');
  const highlightKey = highlightLocalIds.join(',');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const targets = new Set(targetLocalIds);
    const highlights = new Set(highlightLocalIds);
    const segs = host.querySelectorAll<SVGElement>('[id^="segment-"]');
    segs.forEach(el => {
      const localId = parseSegmentLocalId(el.id);
      el.classList.remove('tile-seg--target', 'tile-seg--hl');
      if (localId === null) return;
      const classes = segmentClasses(localId, targets, highlights);
      if (classes.length) el.classList.add(...classes);
    });
    // markup is a dependency so classes are re-applied after the SVG (re)mounts
  }, [markup, targetKey, highlightKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={hostRef}
      className="tile-inline-svg"
      role="img"
      aria-label={altText}
      style={{ width: size, height: size, transform: `rotate(${rotation}deg)`, display: 'block' }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
