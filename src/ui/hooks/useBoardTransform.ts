import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.0;

export interface BoardTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function useBoardTransform(
  containerRef: RefObject<HTMLDivElement | null>,
  centerX: number,
  centerY: number,
) {
  const [transform, setTransform] = useState<BoardTransform>({ scale: 1.0, offsetX: 0, offsetY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const stopPan = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  // Center start tile (0,0) in viewport after mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setTransform(t => ({
      ...t,
      offsetX: el.clientWidth / 2 - centerX,
      offsetY: el.clientHeight / 2 - centerY,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Non-passive wheel listener (required to call preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform(prev => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const bx = (mx - prev.offsetX) / prev.scale;
        const by = (my - prev.offsetY) / prev.scale;
        return {
          scale: newScale,
          offsetX: mx - bx * newScale,
          offsetY: my - by * newScale,
        };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cancel pan when mouse is released outside the browser window
  useEffect(() => {
    if (!isPanning) return;
    const handler = () => stopPan();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [isPanning, stopPan]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-testid="ghost-tile"], [data-testid="meeple-target"]')) return;
    isPanningRef.current = true;
    setIsPanning(true);
    panStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: transformRef.current.offsetX,
      oy: transformRef.current.offsetY,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    setTransform(prev => ({
      ...prev,
      offsetX: panStart.current.ox + dx,
      offsetY: panStart.current.oy + dy,
    }));
  }, []);

  return { transform, isPanning, onMouseDown, onMouseMove, stopPan };
}
