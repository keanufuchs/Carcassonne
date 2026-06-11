import { useState } from 'react';
import type { AIStatusEvent } from '../../ai';

interface Props {
  events: AIStatusEvent[];
}

const TOOL_LABELS: Record<string, string> = {
  list_legal_moves:   'List legal moves',
  get_board_features: 'Read board features',
  get_player_status:  'Read player status',
};

function summarizeToolResult(_name: string, summary: string) {
  return summary ? `— ${summary}` : '';
}

function splitIntoTurns(events: AIStatusEvent[]): AIStatusEvent[][] {
  const turns: AIStatusEvent[][] = [];
  let current: AIStatusEvent[] = [];
  for (const e of events) {
    if (e.type === 'start' && current.length > 0) {
      turns.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) turns.push(current);
  return turns;
}

function TurnEntry({ turnEvents, isLatest }: { turnEvents: AIStatusEvent[]; isLatest: boolean }) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  const startEvent  = turnEvents.find(e => e.type === 'start') as Extract<AIStatusEvent, { type: 'start' }> | undefined;
  const mcpEvent    = turnEvents.find(e => e.type === 'mcp_status') as Extract<AIStatusEvent, { type: 'mcp_status' }> | undefined;
  const reasoning   = turnEvents.find(e => e.type === 'reasoning') as Extract<AIStatusEvent, { type: 'reasoning' }> | undefined;
  const fallback    = turnEvents.find(e => e.type === 'fallback') as Extract<AIStatusEvent, { type: 'fallback' }> | undefined;
  const errorEvent  = turnEvents.find(e => e.type === 'error') as Extract<AIStatusEvent, { type: 'error' }> | undefined;
  const isDone      = turnEvents.some(e => e.type === 'done') || !!fallback;

  const toolCalls   = turnEvents.filter(e => e.type === 'tool_call') as Extract<AIStatusEvent, { type: 'tool_call' }>[];
  const toolResults = turnEvents.filter(e => e.type === 'tool_result') as Extract<AIStatusEvent, { type: 'tool_result' }>[];

  const modelShort = startEvent?.model.replace('anthropic/', '').replace('openai/', '').replace('google/', '') ?? '…';

  const PREVIEW_LEN = 120;
  const reasoningText = reasoning?.text ?? '';
  const isLong = reasoningText.length > PREVIEW_LEN;
  const displayedReasoning = reasoningExpanded || !isLong
    ? reasoningText
    : reasoningText.slice(0, PREVIEW_LEN) + '…';

  // Completed past turns: condensed single line
  if (!isLatest && isDone) {
    return (
      <div style={{ padding: '5px 0', borderBottom: '1px solid #1e1e30' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4b5563', fontSize: 11 }}>
          <span style={{ color: '#4ade80' }}>✓</span>
          <span>{modelShort}</span>
          {mcpEvent !== undefined && (
            <span style={{ color: mcpEvent.online ? '#4ade80' : '#f59e0b', marginLeft: 'auto' }}>
              MCP {mcpEvent.online ? '✓' : '⚠'}
            </span>
          )}
        </div>
        {reasoning && (
          <div style={{ color: '#6b7280', fontSize: 11, fontStyle: 'italic', marginTop: 2, lineHeight: 1.4 }}>
            "{reasoning.text.length > 80 ? reasoning.text.slice(0, 80) + '…' : reasoning.text}"
          </div>
        )}
        {fallback && (
          <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 2 }}>
            ⚠ fallback ({fallback.reason})
          </div>
        )}
      </div>
    );
  }

  // Current (latest) turn: full detail
  return (
    <div style={{ paddingBottom: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>🤖</span>
        <span style={{ color: '#4ade80', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          AI {isDone ? 'done' : 'thinking'}
        </span>
        {!isDone && (
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: '#4ade80', marginLeft: 'auto',
            animation: 'ai-pulse 1.2s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Model + MCP */}
      {startEvent && (
        <div style={{ color: '#4b5563', fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span>{modelShort}</span>
          {mcpEvent !== undefined && (
            <span style={{ color: mcpEvent.online ? '#4ade80' : '#f59e0b' }}>
              MCP {mcpEvent.online ? '✓ online' : '⚠ offline'}
            </span>
          )}
        </div>
      )}

      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 5 }}>
          {toolCalls.map((tc, i) => {
            const result = toolResults.find(r => r.name === tc.name);
            const isPending = !result && i === toolCalls.length - 1 && !isDone;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, color: isPending ? '#fbbf24' : '#86efac', fontSize: 12 }}>
                <span style={{ width: 12, textAlign: 'center' }}>{isPending ? '⏳' : '✓'}</span>
                <span style={{ flex: 1 }}>{TOOL_LABELS[tc.name] ?? tc.name}</span>
                {result && <span style={{ color: '#4b5563', fontSize: 11 }}>{summarizeToolResult(tc.name, result.summary)}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Reasoning */}
      {reasoning && (
        <div style={{
          background: 'rgba(74, 222, 128, 0.06)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          borderRadius: 4, padding: '7px 9px',
          color: '#d1fae5', fontSize: 12, fontStyle: 'italic', lineHeight: 1.6,
        }}>
          "{displayedReasoning}"
          {isLong && (
            <button
              onClick={() => setReasoningExpanded(e => !e)}
              style={{
                display: 'block', marginTop: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4ade80', fontSize: 11, fontStyle: 'normal',
                padding: 0, textDecoration: 'underline',
              }}
            >
              {reasoningExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <div style={{ marginTop: 4, color: '#4b5563', fontStyle: 'normal', fontSize: 11 }}>
            → ({reasoning.coord.x}, {reasoning.coord.y}) {reasoning.rotation}°
          </div>
        </div>
      )}

      {/* Error */}
      {errorEvent && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 4, padding: '6px 9px', color: '#fca5a5', fontSize: 11, marginTop: 4,
        }}>
          ⚠ {errorEvent.message}
        </div>
      )}

      {/* Fallback */}
      {fallback && (
        <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 4 }}>
          {fallback.reason === 'no_config'    && '⚠ No API key — using heuristic AI'}
          {fallback.reason === 'timeout'      && '⚠ Timeout — using heuristic AI'}
          {fallback.reason === 'error'        && '⚠ Error — using heuristic AI'}
          {fallback.reason === 'invalid_move' && '⚠ Invalid move — using heuristic AI'}
        </div>
      )}
    </div>
  );
}

export function AIStatusPanel({ events }: Props) {
  if (events.length === 0) return null;

  const turns = splitIntoTurns(events);

  return (
    <div style={{ padding: '10px 12px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 6, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>AI Log</span>
        <span>{turns.length} turn{turns.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {turns.slice(0, -1).map((t, i) => (
          <TurnEntry key={i} turnEvents={t} isLatest={false} />
        ))}
        <TurnEntry turnEvents={turns[turns.length - 1]} isLatest={true} />
      </div>

      <style>{`
        @keyframes ai-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
