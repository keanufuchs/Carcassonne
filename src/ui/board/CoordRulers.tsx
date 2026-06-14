import { useLayoutEffect, useRef } from 'react';
import type { BoardTransform } from '../hooks/useBoardTransform';
import { getVisibleTicks } from './rulerTicks';

const TILE_SIZE = 80;
const COORD_OFFSET = 40;
const RULER_SIZE = 20;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Props {
  transform: BoardTransform;
}

export function CoordRulers({ transform }: Props) {
  const xRef = useRef<SVGSVGElement>(null);
  const yRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    drawXRuler(xRef.current, transform);
    drawYRuler(yRef.current, transform);
  });

  return (
    <>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: RULER_SIZE, height: RULER_SIZE,
        background: '#1a1a2e',
        borderRight: '1px solid #2a2a4a',
        borderBottom: '1px solid #2a2a4a',
        zIndex: 20,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: RULER_SIZE, right: 0, height: RULER_SIZE,
        background: '#1a1a2e',
        borderBottom: '1px solid #2a2a4a',
        zIndex: 19,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <svg ref={xRef} width="100%" height={RULER_SIZE} style={{ display: 'block' }} />
      </div>
      <div style={{
        position: 'absolute', top: RULER_SIZE, left: 0, width: RULER_SIZE, bottom: 0,
        background: '#1a1a2e',
        borderRight: '1px solid #2a2a4a',
        zIndex: 19,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <svg ref={yRef} width={RULER_SIZE} height="100%" style={{ display: 'block' }} />
      </div>
    </>
  );
}

function drawXRuler(svg: SVGSVGElement | null, transform: BoardTransform): void {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const { offsetX, scale } = transform;
  const viewportW = svg.clientWidth;
  if (viewportW === 0) return;

  for (const { gameCoord: gx, screenPos: px } of getVisibleTicks(offsetX, scale, viewportW, TILE_SIZE, COORD_OFFSET)) {
    const isOrigin = gx === 0;
    svg.appendChild(makeLine(px, isOrigin ? 0 : 12, px, RULER_SIZE, isOrigin ? '#ffd700' : '#374151', isOrigin ? 1.5 : 1));
    svg.appendChild(makeXLabel(px + 2, 11, String(gx), isOrigin));
  }
}

function drawYRuler(svg: SVGSVGElement | null, transform: BoardTransform): void {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const { offsetY, scale } = transform;
  const viewportH = svg.clientHeight;
  if (viewportH === 0) return;

  for (const { gameCoord: gy, screenPos: py } of getVisibleTicks(offsetY, scale, viewportH, TILE_SIZE, COORD_OFFSET)) {
    const isOrigin = gy === 0;
    svg.appendChild(makeLine(isOrigin ? 0 : 12, py, RULER_SIZE, py, isOrigin ? '#ffd700' : '#374151', isOrigin ? 1.5 : 1));
    svg.appendChild(makeYLabel(10, py, String(gy), isOrigin));
  }
}

function makeLine(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number): SVGLineElement {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('x1', String(Math.round(x1)));
  el.setAttribute('y1', String(Math.round(y1)));
  el.setAttribute('x2', String(Math.round(x2)));
  el.setAttribute('y2', String(Math.round(y2)));
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', String(width));
  return el;
}

function makeXLabel(x: number, y: number, text: string, isOrigin: boolean): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', String(Math.round(x)));
  el.setAttribute('y', String(y));
  el.setAttribute('fill', isOrigin ? '#ffd700' : '#6b7280');
  el.setAttribute('font-size', '9');
  el.setAttribute('font-family', 'monospace');
  el.setAttribute('font-weight', isOrigin ? 'bold' : 'normal');
  el.textContent = text;
  return el;
}

function makeYLabel(cx: number, py: number, text: string, isOrigin: boolean): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', String(cx));
  el.setAttribute('y', String(Math.round(py)));
  el.setAttribute('fill', isOrigin ? '#ffd700' : '#6b7280');
  el.setAttribute('font-size', '9');
  el.setAttribute('font-family', 'monospace');
  el.setAttribute('font-weight', isOrigin ? 'bold' : 'normal');
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('dominant-baseline', 'central');
  el.setAttribute('transform', `rotate(-90, ${cx}, ${Math.round(py)})`);
  el.textContent = text;
  return el;
}
