import { useState, useEffect } from 'react';
import type { SegmentKind } from '../../core/types/tile';

export interface SegmentShape {
  tagName: 'rect' | 'polygon' | 'path' | 'circle' | 'line';
  attrs: Record<string, string>;
  localId: number;
  kind: SegmentKind;
}

const svgCache = new Map<string, SegmentShape[]>();
const markupCache = new Map<string, string>();

/**
 * Fetches the raw SVG markup of a tile (cached) so it can be rendered inline.
 * Rendering the real SVG — instead of an `<img>` plus a separate overlay — lets
 * us highlight individual `segment-*` elements in place, with the original
 * paint order intact (see tileHighlight.ts).
 */
export function useInlineTileSvg(srcPath: string): string | null {
  const [markup, setMarkup] = useState<string | null>(() => markupCache.get(srcPath) ?? null);

  useEffect(() => {
    if (typeof window === 'undefined' || !srcPath) return;
    const cached = markupCache.get(srcPath);
    if (cached !== undefined) {
      setMarkup(cached);
      return;
    }
    let cancelled = false;
    fetch(srcPath)
      .then(r => r.text())
      .then(svg => {
        markupCache.set(srcPath, svg);
        if (!cancelled) setMarkup(svg);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [srcPath]);

  return markup;
}

export function useTileSvgPaths(srcPath: string): SegmentShape[] | null {
  const [shapes, setShapes] = useState<SegmentShape[] | null>(
    () => svgCache.get(srcPath) ?? null,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !srcPath) return;
    if (svgCache.has(srcPath)) {
      setShapes(svgCache.get(srcPath)!);
      return;
    }
    fetch(srcPath)
      .then(r => r.text())
      .then(svg => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const elements = doc.querySelectorAll('[id^="segment-"]');
        const parsed: SegmentShape[] = [];
        elements.forEach(el => {
          const id = el.getAttribute('id') ?? '';
          const parts = id.split('-');
          if (parts.length < 3) return;
          const kind = parts[1] as SegmentKind;
          const localId = parseInt(parts[2], 10);
          if (isNaN(localId)) return;
          const attrs: Record<string, string> = {};
          for (const attr of Array.from(el.attributes)) {
            attrs[attr.name] = attr.value;
          }
          const tagName = el.tagName.toLowerCase() as SegmentShape['tagName'];
          parsed.push({ tagName, attrs, localId, kind });
        });
        svgCache.set(srcPath, parsed);
        setShapes(parsed);
      })
      .catch(() => {});
  }, [srcPath]);

  return shapes;
}
