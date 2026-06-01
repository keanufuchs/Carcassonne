import type { Coord, Rotation } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { serializeState } from '../core/serialize';
import { legalMovesView, boardFeaturesView, playerStatusView, connectionsForMove, generateMoveReasoning, meeplesView } from './boardAnalysis';
import type { AIDecision } from './AI';
import { computeHeuristicMove } from './heuristic';
import type { AIStatusEvent } from './index';

// ── Config ─────────────────────────────────────────────────────────────────

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL   = 'anthropic/claude-sonnet-4-6';
const MOVE_TIMEOUT_MS = 20_000;
const MCP_BASE        = 'http://localhost:3002';
const MAX_TOOL_ROUNDS = 6;

// ── Credentials ────────────────────────────────────────────────────────────

function getConfig(): { apiKey: string; model: string } | null {
  const env = (typeof import.meta !== 'undefined')
    ? (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env ?? {}
    : (typeof process !== 'undefined' ? process.env ?? {} : {});

  const apiKey = env.VITE_OPENROUTER_API_KEY ?? env.OPENROUTER_API_KEY ?? '';
  const model  = env.VITE_AI_MODEL ?? env.AI_MODEL ?? DEFAULT_MODEL;

  return apiKey ? { apiKey, model } : null;
}

// ── OpenAI-compatible tool definitions ────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_legal_moves',
      description:
        'Returns all legal tile placements for the current pending tile. ' +
        'Call this first to see which coordinates and rotations are valid. ' +
        'Each move includes "connectsTo": the existing city/road features that ' +
        'placing the tile there would actually join (with each feature\'s id, kind, ' +
        'openEdges, shieldCount, completed, and meeple owner ids). A move with an ' +
        'empty connectsTo starts a NEW feature and does not extend anything. Use ' +
        'this to verify—not guess—whether a move extends or completes a feature.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_board_features',
      description:
        'Returns all features (cities, roads, monasteries, fields) on the board ' +
        'with their kind, tile count, open edges, shield count, completion status, ' +
        'and which players own meeples on each. Each feature also includes ' +
        '"tileCoords" (board {x,y} of its tiles) and "openEdgeNeighborCoords" ' +
        '(empty cells adjacent to open edges — placing a tile there extends/closes the feature).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_status',
      description:
        'Returns current player scores, available meeple counts, and tiles remaining.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_meeple_targets',
      description:
        'Given a planned tile placement, returns which segments on the tile are legally ' +
        'claimable with a meeple (i.e. their connected feature has no existing meeples) ' +
        'and how many meeples you have left. Call this after choosing a coord/rotation ' +
        'but before submit_move, to decide whether to claim a segment or conserve meeples.',
      parameters: {
        type: 'object',
        properties: {
          coord: {
            type: 'object',
            properties: {
              x: { type: 'integer' },
              y: { type: 'integer' },
            },
            required: ['x', 'y'],
          },
          rotation: { type: 'integer', enum: [0, 90, 180, 270] },
        },
        required: ['coord', 'rotation'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_move',
      description: 'Submit your chosen placement. Call this once when you have decided.',
      parameters: {
        type: 'object',
        properties: {
          coord: {
            type: 'object',
            properties: {
              x: { type: 'integer', description: 'Board X coordinate' },
              y: { type: 'integer', description: 'Board Y coordinate' },
            },
            required: ['x', 'y'],
          },
          rotation: {
            type: 'integer',
            enum: [0, 90, 180, 270],
            description: 'Tile rotation in degrees clockwise',
          },
          reasoning: {
            type: 'string',
            description: 'Briefly explain why this is the best move and how this decision was made.',
          },
          meeple: {
            type: 'object',
            description:
              'Optional. Claim one segment of the tile you are placing with a meeple. ' +
              'Omit entirely to place no meeple.',
            properties: {
              segmentLocalId: {
                type: 'integer',
                description: "localId of the pending tile's segment to claim (see segment list)",
              },
            },
            required: ['segmentLocalId'],
          },
        },
        required: ['coord', 'rotation', 'reasoning'],
      },
    },
  },
];

// ── MCP tool execution (server → local fallback) ───────────────────────────

async function executeTool(
  name: string,
  state: GameState,
  stateJson: string,
  onMcpStatus?: (online: boolean) => void,
  args?: Record<string, unknown>,
): Promise<unknown> {
  try {
    console.debug('[MCP] calling tool via server:', name, MCP_BASE);
    const res = await fetch(`${MCP_BASE}/tools/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateJson, ...args }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      console.debug('[MCP] ✓ server responded for:', name);
      onMcpStatus?.(true);
      return await res.json();
    }
    console.debug('[MCP] server error for:', name, res.status);
  } catch (e) {
    console.debug('[MCP] server offline, using local fallback for:', name, e);
  }
  onMcpStatus?.(false);
  return executeToolLocally(name, state, args);
}

function executeToolLocally(name: string, state: GameState, args?: Record<string, unknown>): unknown {
  switch (name) {
    case 'list_legal_moves':    return legalMovesView(state);
    case 'get_board_features':  return boardFeaturesView(state);
    case 'get_player_status':   return playerStatusView(state);
    case 'get_meeple_targets': {
      const c = args?.coord as { x: number; y: number } | undefined;
      const r = args?.rotation as number | undefined;
      if (!c || r === undefined) return { error: 'Missing coord or rotation' };
      return meeplesView(state, c, r as import('../core/types').Rotation);
    }
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(state: GameState): string {
  const p = state.players[state.currentPlayerIndex];
  const segs = (state.pendingTile?.segments ?? [])
    .map(s => `localId ${s.localId}: ${s.kind}${s.isShielded ? ' (SHIELD)' : ''}`)
    .join('; ');
  const tileHasShield = state.pendingTile?.hasShield ?? false;

  return `You are a strategic Carcassonne AI playing as "${p.name}" (ID: ${p.id}).

Scoring rules:
- Completed ROAD: 1 pt/tile
- Completed CITY: 2 pts/tile + 2 pts PER SHIELD
- Completed MONASTERY: 9 pts (tile + all 8 neighbors filled)
- End-game incomplete: 1 pt/tile for roads/monasteries, 1 pt/tile + 1/shield for cities

SHIELDS ARE WORTH DOUBLE: every shield (pennant) in a completed city adds +2 points
on top of the per-tile points — so a shielded city tile is worth twice as much as a
plain one. Actively pursue and complete cities that contain shields, prefer claiming
a city that already has (or will gain) shields, and use get_board_features to read
each city's shieldCount. The tile you are placing ${tileHasShield ? 'HAS A SHIELD — placing it into a city you own is high value.' : 'has no shield.'}

Strategy: complete your own features (favouring shielded cities) > block opponent
completions > extend your features.

Meeples: you have ${p.meeplesAvailable} of 7 meeples left. After placing the tile
you may claim ONE of ITS OWN segments with a meeple (only if no connected feature
is already owned). The tile you are placing has these segments: ${segs || '(none)'}.
Prefer claiming cities and roads you can realistically complete; monasteries are
strong; avoid fields/farms unless clearly advantageous. To claim, include the
"meeple" object in submit_move with the chosen segment's localId. Omit it to place
no meeple.

Tool call strategy — follow this order every turn:
1. Call list_legal_moves first, always.
2. Read boardTileCount from the response.
   - If boardTileCount > 8 OR totalMoves > moves.length: call get_board_features before
     deciding. The board is complex enough that you need the global picture — feature
     sizes, which opponent features are near completion, and where high-value cities with
     shields are — to make a strategically sound choice. Do NOT skip this step.
3. Once you have chosen a coord and rotation, call get_meeple_targets with those values.
   It tells you which segments are legally claimable (connected feature has no meeple yet)
   and how many meeples you have left. Use this to decide:
   - Is it worth claiming? (FIELD: never; high openEdges features may never close)
   - Can you afford it? (meeplesAvailable <= 2: only claim near-complete features)
   - Which segmentLocalId to pass (must have claimable: true).
4. Call submit_move. reasoning is REQUIRED.

Verifying move consequences (do NOT guess the geometry — read it):
- list_legal_moves gives every legal move with a "connectsTo" array listing the
  existing city/road features that move would actually JOIN. If connectsTo is empty,
  the move starts a NEW feature and extends nothing — never claim otherwise.
- To EXTEND or COMPLETE your city/road, pick a move whose connectsTo contains a
  feature you own (your id appears in its "meeples"). A feature with openEdges:1 in
  connectsTo is one edge from closing.
- get_board_features gives each feature's full picture: tileCount, tileCoords,
  openEdgeNeighborCoords (empty cells that extend/close it), shieldCount, and meeple owners.

Your stated reasoning MUST match the data you retrieved: only say "extend"/"complete"
a feature if the chosen move's connectsTo actually contains it.`;
}

// ── Tool result summary ────────────────────────────────────────────────────

function summarizeToolResult(name: string, result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const r = result as Record<string, unknown>;
  if (name === 'list_legal_moves') return `${(r.totalMoves as number | undefined) ?? (r.moves as unknown[])?.length ?? '?'} moves`;
  if (name === 'get_board_features') return `${(r.features as unknown[])?.length ?? '?'} features`;
  if (name === 'get_player_status') return `${(r.players as unknown[])?.length ?? '?'} players`;
  if (name === 'get_meeple_targets') {
    const t = (r.targets as unknown[]) ?? [];
    const claimable = (t as { claimable: boolean }[]).filter(x => x.claimable).length;
    return `${claimable}/${t.length} claimable, ${r.meeplesAvailable ?? '?'} meeples left`;
  }
  return '';
}

// ── Conversation logger (fire-and-forget via MCP server) ──────────────────

function logConversation(
  messages: OAIMessage[],
  meta: { gameId: string; player: string; model: string; result: unknown; rounds: number },
): void {
  fetch(`${MCP_BASE}/log/conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...meta, messages }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => { /* best-effort */ });
}

// ── OpenAI-compatible multi-turn tool loop ─────────────────────────────────

interface OAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

async function _callWithTools(
  state: GameState,
  apiKey: string,
  model: string,
  onStatus?: (e: AIStatusEvent) => void,
): Promise<AIDecision | null> {
  const stateJson = serializeState(state);
  let mcpStatusReported = false;
  const playerName = state.players[state.currentPlayerIndex].name;
  const gameId = state.gameId;
  let roundsCompleted = 0;

  onStatus?.({ type: 'start', model });

  const messages: OAIMessage[] = [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user',   content: "It's your turn. Analyze the board and submit your move." },
  ];

  const done = (result: AIDecision | null): AIDecision | null => {
    logConversation(messages, { gameId, player: playerName, model, result, rounds: roundsCompleted });
    return result;
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    roundsCompleted = round + 1;
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/carcassonne-game',
        'X-Title': 'Carcassonne AI',
      },
      body: JSON.stringify({
        model,
        tools: TOOLS,
        tool_choice: 'auto',
        messages,
      }),
    });

    if (!response.ok) {
      onStatus?.({ type: 'error', message: `OpenRouter ${response.status}: ${response.statusText}` });
      return done(null);
    }

    const data = await response.json() as {
      choices: Array<{
        finish_reason: string;
        message: OAIMessage;
      }>;
    };

    const choice = data.choices?.[0];
    if (!choice) return done(null);

    const msg = choice.message;
    messages.push(msg);

    if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length) {
      const toolResults: OAIMessage[] = [];

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }

        if (toolName === 'submit_move') {
          const flat = args as {
            x?: number; y?: number; rotation?: number;
            coord?: { x: number; y: number }; reasoning?: string;
            meeple?: { segmentLocalId?: number };
          };
          const cx = flat.x ?? flat.coord?.x;
          const cy = flat.y ?? flat.coord?.y;
          const rotation = (flat.rotation ?? 0) as Rotation;

          if (cx === undefined || cy === undefined || ![0, 90, 180, 270].includes(rotation)) return done(null);

          const finalCoord: Coord = { x: cx, y: cy };
          if (!state.pendingTile || !canPlace(state.board, state.pendingTile, finalCoord, rotation)) return done(null);

          // Generate factual reasoning from ground-truth connection data instead of
          // trusting LLM free text, which hallucinates tile geometry.
          const actualConnections = connectionsForMove(state, finalCoord, rotation);
          const currentPlayerId = state.players[state.currentPlayerIndex].id;
          const factualReasoning = generateMoveReasoning(actualConnections, currentPlayerId);
          onStatus?.({ type: 'reasoning', text: factualReasoning, coord: finalCoord, rotation });
          onStatus?.({ type: 'done' });

          // localId is stable across placement; the runtime tile id is filled in
          // post-placement by matching localId against the real meeple targets.
          const localId = flat.meeple?.segmentLocalId;
          const meepleRef = (typeof localId === 'number'
            && state.pendingTile.segments.some(s => s.localId === localId))
            ? { tileId: state.pendingTile.id, localId } as const
            : undefined;

          // The LLM jointly decided tile + meeple; honour it verbatim, including
          // an explicit "no meeple" (meepleRef undefined) — see meepleResolved.
          return done({ coord: finalCoord, rotation, meepleRef, meepleResolved: true });
        }

        onStatus?.({ type: 'tool_call', name: toolName });
        const result = await executeTool(toolName, state, stateJson, mcpStatusReported ? undefined : (online) => {
          mcpStatusReported = true;
          onStatus?.({ type: 'mcp_status', online });
        }, args);
        onStatus?.({ type: 'tool_result', name: toolName, summary: summarizeToolResult(toolName, result) });
        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: toolName,
          content: JSON.stringify(result),
        });
      }

      messages.push(...toolResults);

    } else if (choice.finish_reason === 'stop') {
      // Model responded with text — try JSON parse as last resort
      return done(_parseDecisionFromText(msg.content ?? '', state));
    } else {
      return done(null);
    }
  }

  return done(null);
}

function _parseDecisionFromText(text: string, state: GameState): AIDecision | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { coord?: { x: number; y: number }; rotation?: number };
    if (!parsed.coord || typeof parsed.coord.x !== 'number') return null;
    if (![0, 90, 180, 270].includes(parsed.rotation ?? -1)) return null;

    const coord: Coord = { x: parsed.coord.x, y: parsed.coord.y };
    const rotation = (parsed.rotation ?? 0) as Rotation;
    if (!state.pendingTile || !canPlace(state.board, state.pendingTile, coord, rotation)) return null;

    return { coord, rotation, meepleRef: undefined };
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Intelligent AI via OpenRouter (OpenAI-compatible API).
 *
 * Supports any model available on openrouter.ai — Claude, GPT-4o, Llama,
 * Mistral, Gemini and more. Defaults to anthropic/claude-sonnet-4-6.
 *
 * Set env vars:
 *   VITE_OPENROUTER_API_KEY=sk-or-...
 *   VITE_AI_MODEL=anthropic/claude-sonnet-4-6   (optional override)
 *
 * Falls back to heuristic AI if key missing, timeout, or invalid move.
 */
export async function computeIntelligentMove(
  state: GameState,
  onStatus?: (e: AIStatusEvent) => void,
): Promise<AIDecision> {
  const config = getConfig();

  if (!config) {
    onStatus?.({ type: 'fallback', reason: 'no_config' });
    return computeHeuristicMove(state).decision;
  }

  try {
    let timedOut = false;
    const result = await Promise.race([
      _callWithTools(state, config.apiKey, config.model, onStatus),
      new Promise<null>(resolve => setTimeout(() => { timedOut = true; resolve(null); }, MOVE_TIMEOUT_MS)),
    ]);
    if (result) return result;
    onStatus?.({ type: 'fallback', reason: timedOut ? 'timeout' : 'invalid_move' });
  } catch (e) {
    console.error('[AI] intelligent move failed:', e);
    onStatus?.({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    onStatus?.({ type: 'fallback', reason: 'error' });
  }

  return computeHeuristicMove(state).decision;
}
