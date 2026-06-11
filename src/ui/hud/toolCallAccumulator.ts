import type { AIStatusEvent } from '../../ai/index';

export interface ToolCallEntry {
  name: string;
  summary: string;
}

export function accumulateToolCall(
  existing: ToolCallEntry[],
  event: AIStatusEvent,
): ToolCallEntry[] {
  if (event.type !== 'tool_result') return existing;
  return [...existing, { name: event.name, summary: event.summary }];
}
