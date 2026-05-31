import type { Coord, Rotation } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import { serializeState } from '../core/serialize';
import type { AIDecision } from './AI';
import { computeHeuristicMove } from './heuristic';

// ── Config ─────────────────────────────────────────────────────────────────

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL   = 'anthropic/claude-sonnet-4-6';
const MOVE_TIMEOUT_MS = 20_000;
const MCP_BASE        = 'http://localhost:3002';
const MAX_TOOL_ROUNDS = 6;
const ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270];

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
        'Call this first to see which coordinates and rotations are valid.',
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
        'and which players own meeples on each.',
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
            description: 'Brief explanation of why this is the best move',
          },
        },
        required: ['coord', 'rotation'],
      },
    },
  },
];

// ── MCP tool execution (server → local fallback) ───────────────────────────

async function executeTool(name: string, state: GameState, stateJson: string): Promise<unknown> {
  try {
    const res = await fetch(`${MCP_BASE}/tools/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateJson }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch { /* MCP server offline */ }
  return executeToolLocally(name, state);
}

function executeToolLocally(name: string, state: GameState): unknown {
  switch (name) {
    case 'list_legal_moves': {
      if (!state.pendingTile) return { moves: [] };
      const moves: { coord: { x: number; y: number }; rotation: number }[] = [];
      for (const coord of candidatePlacements(state.board))
        for (const rot of ALL_ROTATIONS)
          if (canPlace(state.board, state.pendingTile, coord, rot))
            moves.push({ coord: { x: coord.x, y: coord.y }, rotation: rot });
      return {
        moves: moves.slice(0, 30),
        totalMoves: moves.length,
        tileId: state.pendingTile.id,
        hasMonastery: state.pendingTile.hasMonastery,
        hasShield: state.pendingTile.hasShield,
      };
    }
    case 'get_board_features': {
      const features = [...state.board.registry.features.values()].map(f => ({
        id: f.id,
        kind: f.kind,
        tileCount: new Set([...f.segments].map(s => s.split('#')[0])).size,
        openEdges: f.openEdges,
        shieldCount: f.shieldCount,
        completed: f.completed,
        meeples: f.meeples.map(m => m.playerId),
      }));
      return { features, boardTileCount: state.board.tiles.size };
    }
    case 'get_player_status': {
      const cur = state.players[state.currentPlayerIndex];
      return {
        players: state.players.map((p, i) => ({
          id: p.id, name: p.name, score: p.score,
          meeplesAvailable: p.meeplesAvailable,
          isCurrent: i === state.currentPlayerIndex,
        })),
        tilesRemaining: state.deck.remaining.length,
        currentPlayerId: cur.id,
        currentPlayerName: cur.name,
        pendingTileId: state.pendingTile?.id ?? null,
      };
    }
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(state: GameState): string {
  const p = state.players[state.currentPlayerIndex];
  return `You are a strategic Carcassonne AI playing as "${p.name}" (ID: ${p.id}).

Scoring rules:
- Completed ROAD: 1 pt/tile
- Completed CITY: 2 pts/tile + 2 pts/shield
- Completed MONASTERY: 9 pts (tile + all 8 neighbors filled)
- End-game incomplete: 1 pt/tile for roads/monasteries, 1 pt/tile + 1/shield for cities

Strategy: complete your own features > block opponent completions > extend your features.

Use the tools to analyze the board, then call submit_move with your decision.`;
}

// ── OpenAI-compatible multi-turn tool loop ─────────────────────────────────

interface OAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

async function _callWithTools(state: GameState, apiKey: string, model: string): Promise<AIDecision | null> {
  const stateJson = serializeState(state);

  const messages: OAIMessage[] = [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user',   content: "It's your turn. Analyze the board and submit your move." },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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

    if (!response.ok) return null;

    const data = await response.json() as {
      choices: Array<{
        finish_reason: string;
        message: OAIMessage;
      }>;
    };

    const choice = data.choices?.[0];
    if (!choice) return null;

    const msg = choice.message;
    messages.push(msg);

    if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length) {
      const toolResults: OAIMessage[] = [];

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }

        if (toolName === 'submit_move') {
          const coord: Coord = { x: args.x as number ?? (args.coord as { x: number })?.x, y: args.y as number ?? (args.coord as { y: number })?.y };
          // Handle both flat {x,y} and nested {coord:{x,y}} argument shapes
          const flat = args as { x?: number; y?: number; rotation?: number; coord?: { x: number; y: number } };
          const cx = flat.x ?? flat.coord?.x;
          const cy = flat.y ?? flat.coord?.y;
          const rotation = (flat.rotation ?? 0) as Rotation;

          if (cx === undefined || cy === undefined || ![0, 90, 180, 270].includes(rotation)) return null;

          const finalCoord: Coord = { x: cx, y: cy };
          if (!state.pendingTile || !canPlace(state.board, state.pendingTile, finalCoord, rotation)) return null;

          return { coord: finalCoord, rotation, meepleRef: undefined };
        }

        const result = await executeTool(toolName, state, stateJson);
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
      return _parseDecisionFromText(msg.content ?? '', state);
    } else {
      return null;
    }
  }

  return null;
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
export async function computeIntelligentMove(state: GameState): Promise<AIDecision> {
  const config = getConfig();

  if (config) {
    try {
      const result = await Promise.race([
        _callWithTools(state, config.apiKey, config.model),
        new Promise<null>(resolve => setTimeout(() => resolve(null), MOVE_TIMEOUT_MS)),
      ]);
      if (result) return result;
    } catch { /* fall through */ }
  }

  return computeHeuristicMove(state);
}
