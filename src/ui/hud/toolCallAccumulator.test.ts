import { describe, it, expect } from 'vitest';
import { accumulateToolCall } from './toolCallAccumulator';
import type { AIStatusEvent } from '../../ai/index';

describe('accumulateToolCall', () => {
  it('appends a tool_result event to the list', () => {
    const event: AIStatusEvent = { type: 'tool_result', name: 'list_legal_moves', summary: '47 moves' };
    const result = accumulateToolCall([], event);
    expect(result).toEqual([{ name: 'list_legal_moves', summary: '47 moves' }]);
  });

  it('appends multiple tool results in order', () => {
    const e1: AIStatusEvent = { type: 'tool_result', name: 'list_legal_moves', summary: '12 moves' };
    const e2: AIStatusEvent = { type: 'tool_result', name: 'get_board_features', summary: '5 features' };
    const after1 = accumulateToolCall([], e1);
    const after2 = accumulateToolCall(after1, e2);
    expect(after2).toEqual([
      { name: 'list_legal_moves', summary: '12 moves' },
      { name: 'get_board_features', summary: '5 features' },
    ]);
  });

  it('ignores non-tool_result events', () => {
    const event: AIStatusEvent = { type: 'tool_call', name: 'list_legal_moves' };
    const result = accumulateToolCall([], event);
    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input: { name: string; summary: string }[] = [];
    const event: AIStatusEvent = { type: 'tool_result', name: 'get_player_status', summary: '2 players' };
    accumulateToolCall(input, event);
    expect(input).toHaveLength(0);
  });
});
