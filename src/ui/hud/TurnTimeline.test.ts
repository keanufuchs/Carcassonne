import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TurnTimeline, type MoveRecord } from './TurnTimeline';

function renderMove(move: MoveRecord): string {
  return renderToStaticMarkup(React.createElement(TurnTimeline, { moves: [move] }));
}

const baseMove: MoveRecord = {
  turn: 1,
  playerName: 'Reasoning AI',
  playerColor: '#facc15',
  prototypeId: 'TILE-A',
  coord: { x: 0, y: 0 },
  rotation: 0,
};

describe('TurnTimeline reasoning display', () => {
  it('shows a Reasoning section for Reasoning AI moves even when reasoning is missing', () => {
    const html = renderMove({
      ...baseMove,
      aiMode: 'intelligent',
      reasoningUnavailableReason: 'timeout',
    });

    expect(html).toContain('Reasoning:');
    expect(html).toContain('reasoning request timed out');
  });

  it('renders available Reasoning AI reasoning text', () => {
    const html = renderMove({
      ...baseMove,
      aiMode: 'intelligent',
      reasoning: 'Complete own city for immediate points.',
    });

    expect(html).toContain('Reasoning:');
    expect(html).toContain('Complete own city for immediate points.');
  });

  it('does not show Reasoning for non-reasoning moves without reasoning data', () => {
    const html = renderMove({
      ...baseMove,
      playerName: 'Heuristic AI',
      aiMode: 'heuristic',
    });

    expect(html).not.toContain('Reasoning:');
  });
});
