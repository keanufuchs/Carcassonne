import { useState, useCallback } from 'react';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1; // multiply/divide factor per wheel tick

interface BoardTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface UseBoardTransform {
  transform: BoardTransform;
  handleWheel: (e: React.WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  isPanning: boolean;
}

export function useBoardTransform(): UseBoardTransform {
  const [transform, setTransform] = useState<BoardTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number; origX: number; origY: number } | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform(prev => {
      const factor = e.deltaY < 0 ? 1 + SCALE_STEP : 1 - SCALE_STEP;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));

      // Zoom relative to mouse position: adjust offset so the point under the cursor stays put
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleRatio = newScale / prev.scale;
      const newOffsetX = mouseX - scaleRatio * (mouseX - prev.offsetX);
      const newOffsetY = mouseY - scaleRatio * (mouseY - prev.offsetY);

      return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start pan on left button
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanOrigin({
      x: e.clientX,
      y: e.clientY,
      origX: transform.offsetX,
      origY: transform.offsetY,
    });
  }, [transform.offsetX, transform.offsetY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panOrigin) return;
    const dx = e.clientX - panOrigin.x;
    const dy = e.clientY - panOrigin.y;
    setTransform(prev => ({
      ...prev,
      offsetX: panOrigin.origX + dx,
      offsetY: panOrigin.origY + dy,
    }));
  }, [isPanning, panOrigin]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setPanOrigin(null);
  }, []);

  return { transform, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, isPanning };
}
