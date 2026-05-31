import type { Coord, Rotation } from '../core/types';
import type { GameState } from '../core/game/GameState';
import { canPlace } from '../core/board/placement';
import { candidatePlacements } from '../core/board/Board';
import { serializeState } from '../core/serialize';
import type { AIDecision } from './AI';
import { computeHeuristicMove } from './heuristic';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MOVE_TIMEOUT_MS = 20_000;
const MCP_BASE = 'http://localhost:3002';
const MAX_TOOL_ROUNDS = 6;
const ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270];

// ── Claude tool definitions ────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_legal_moves',
    description:
      'Returns all legal tile placements for the current pending tile. ' +
      'Call this first to see which coordinates and rotations are valid.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_board_features',
    description:
      'Returns all features (cities, roads, monasteries, fields) currently on the board. ' +
      'Shows each feature\'s kind, tile count, open edges, shield count, completion status, ' +
      'and which players have meeples on it.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_player_status',
    description:
      'Returns current player scores, available meeple counts, and how many tiles remain in the deck.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'submit_move',
    description:
      'Submit your chosen placement. Call this exactly once when you have decided on the best move.',
    input_schema: {
      type: 'object',
      properties: {
        coord: {
          type: 'object',
          description: 'Board coordinates where the tile should be placed',
          properties: {
            x: { type: 'integer' },
            y: { type: 'integer' },
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
];

// ── API key ────────────────────────────────────────────────────────────────

function getApiKey(): string | null {
  if (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.VITE_ANTHROPIC_API_KEY) {
    return (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env!.VITE_ANTHROPIC_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  return null;
}

// ── MCP tool execution (server with local fallback) ────────────────────────

async function executeTool(toolName: string, state: GameState, stateJson: string): Promise<unknown> {
  // Try MCP server first
  try {
    const res = await fetch(`${MCP_BASE}/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateJson }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // MCP server unavailable — run locally
  }
  return executeToolLocally(toolName, state);
}

function executeToolLocally(toolName: string, state: GameState): unknown {
  switch (toolName) {
    case 'list_legal_moves': {
      if (!state.pendingTile) return { moves: [], tileId: null };
      const candidates = candidatePlacements(state.board);
      const moves: { coord: { x: number; y: number }; rotation: number }[] = [];
      for (const coord of candidates) {
        for (const rot of ALL_ROTATIONS) {
          if (canPlace(state.board, state.pendingTile, coord, rot)) {
            moves.push({ coord: { x: coord.x, y: coord.y }, rotation: rot });
          }
        }
      }
      return {
        moves: moves.slice(0, 30),
        totalMoves: moves.length,
        tileId: state.pendingTile.id,
        hasMonastery: state.pendingTile.hasMonastery,
        hasShield: state.pendingTile.hasShield,
      };
    }
    case 'get_board_features': {
      const features = [...state.board.registry.features.values()].map(f => {
        const tileIds = new Set([...f.segments].map(s => s.split('#')[0]));
        return {
          id: f.id,
          kind: f.kind,
          tileCount: tileIds.size,
          openEdges: f.openEdges,
          shieldCount: f.shieldCount,
          completed: f.completed,
          meeples: f.meeples.map(m => m.playerId),
        };
      });
      return {
        features,
        boardTileCount: state.board.tiles.size,
        activeFeaturesWithMeeples: features.filter(f => f.meeples.length > 0 && !f.completed),
      };
    }
    case 'get_player_status': {
      const currentPlayer = state.players[state.currentPlayerIndex];
      return {
        players: state.players.map((p, i) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          meeplesAvailable: p.meeplesAvailable,
          isCurrent: i === state.currentPlayerIndex,
        })),
        tilesRemaining: state.deck.remaining.length,
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.name,
        pendingTileId: state.pendingTile?.id ?? null,
      };
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ── Prompt building ────────────────────────────────────────────────────────

function buildSystemPrompt(state: GameState): string {
  const currentPlayer = state.players[state.currentPlayerIndex];
  return `You are a strategic Carcassonne AI playing as "${currentPlayer.name}" (ID: ${currentPlayer.id}).

Your goal: maximize your score while preventing opponents from scoring.

Scoring rules:
- Completed ROAD: 1 point per tile in the road
- Completed CITY: 2 points per tile + 2 points per shield
- Completed MONASTERY: 9 points (tile itself + all 8 neighbors filled)
- End-game (incomplete features): 1 pt/tile for roads, 1 pt/tile+1/shield for cities, 1 pt per neighbor for monasteries

Decision process:
1. Call list_legal_moves to see your options
2. Optionally call get_board_features and get_player_status for context
3. Call submit_move with your chosen placement

Priority when choosing a move:
1. Complete your own high-value features (cities with shields > monasteries > roads)
2. Block opponents who are close to completing large features
3. Extend your own incomplete features
4. Avoid giving opponents easy completions`;
}

// ── Claude API with tool use ───────────────────────────────────────────────

interface ClaudeMessage {
  role: string;
  content: unknown;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

async function _callClaudeWithTools(state: GameState, apiKey: string): Promise<AIDecision | null> {
  const stateJson = serializeState(state);
  const systemPrompt = buildSystemPrompt(state);

  const messages: ClaudeMessage[] = [
    {
      role: 'user',
      content: 'It\'s your turn. Use the tools to analyze the position, then submit your move.',
    },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      stop_reason: string;
      content: Array<{ type: string; text?: string } | ToolUseBlock>;
    };

    if (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter(
        (b): b is ToolUseBlock => b.type === 'tool_use',
      );

      messages.push({ role: 'assistant', content: data.content });

      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolUse of toolUseBlocks) {
        if (toolUse.name === 'submit_move') {
          const input = toolUse.input as { coord: { x: number; y: number }; rotation: number };
          if (
            !input.coord ||
            typeof input.coord.x !== 'number' ||
            typeof input.coord.y !== 'number' ||
            ![0, 90, 180, 270].includes(input.rotation)
          ) {
            return null;
          }

          const coord: Coord = { x: input.coord.x, y: input.coord.y };
          const rotation = input.rotation as Rotation;

          if (!state.pendingTile || !canPlace(state.board, state.pendingTile, coord, rotation)) {
            return null;
          }

          return { coord, rotation, meepleRef: undefined };
        }

        const result = await executeTool(toolUse.name, state, stateJson);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
    } else if (data.stop_reason === 'end_turn') {
      // Claude responded with text — try to parse JSON fallback
      const textBlock = data.content.find(
        (b): b is { type: 'text'; text: string } => b.type === 'text',
      );
      if (textBlock?.text) {
        return _parseDecisionFromText(textBlock.text, state);
      }
      return null;
    } else {
      return null;
    }
  }

  return null;
}

function _parseDecisionFromText(text: string, state: GameState): AIDecision | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      coord?: { x: number; y: number };
      rotation?: number;
    };
    if (!parsed.coord || typeof parsed.coord.x !== 'number') return null;
    if (![0, 90, 180, 270].includes(parsed.rotation ?? -1)) return null;

    const coord: Coord = { x: parsed.coord.x, y: parsed.coord.y };
    const rotation = (parsed.rotation ?? 0) as Rotation;

    if (!state.pendingTile || !canPlace(state.board, state.pendingTile, coord, rotation)) {
      return null;
    }
    return { coord, rotation, meepleRef: undefined };
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Intelligent AI that uses Claude API with MCP tool use when available,
 * with heuristic fallback.
 *
 * Flow:
 * 1. Claude calls list_legal_moves to see options (via MCP server)
 * 2. Claude optionally calls get_board_features / get_player_status
 * 3. Claude calls submit_move with the chosen placement
 * 4. If API unavailable / timeout / invalid move → heuristic fallback
 */
export async function computeIntelligentMove(state: GameState): Promise<AIDecision> {
  const apiKey = getApiKey();

  if (apiKey) {
    try {
      const result = await Promise.race([
        _callClaudeWithTools(state, apiKey),
        new Promise<null>(resolve => setTimeout(() => resolve(null), MOVE_TIMEOUT_MS)),
      ]);

      if (result) return result;
    } catch {
      // Fall through to heuristic
    }
  }

  return computeHeuristicMove(state);
}
