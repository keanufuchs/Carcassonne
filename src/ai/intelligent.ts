import type { GameState } from '../core/game/GameState';
import { serializeState } from '../core/serialize';
import type { AIDecision } from './AI';
import { computeHeuristicMove } from './heuristic';
import type { AIStatusEvent } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// Reasoning AI (EW-02) — CLIENT SIDE.
//
// SECURITY: this module deliberately holds NO API key and never calls the LLM
// provider. The whole tool loop runs on the server (see server/aiService.ts).
// The client behaves like an online opponent: it serializes the game state,
// posts it to `POST /api/ai/move`, and the server returns the chosen move plus a
// replayable log of status events for the UI. The provider API key lives only in
// the server's process env and is never shipped in the client bundle.
// ─────────────────────────────────────────────────────────────────────────────

/** Hard cap so a hung server request can't freeze the AI turn forever. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Same-origin relative base URL (matches NetworkController): requests go to
 * whatever origin served the page and are forwarded by the Vite dev proxy
 * (`/api → :3001`) or the serverless functions in prod. `VITE_API_URL` can
 * override it. This is just a routing hint — it carries no secret.
 */
function apiBase(): string {
  return import.meta.env.VITE_API_URL || '';
}

interface AIMoveResponse {
  decision: AIDecision | null;
  events?: AIStatusEvent[];
}

/**
 * Intelligent AI move. Delegates the LLM call to the server and returns its
 * decision. Falls back to the local heuristic AI when the server has no
 * credentials, times out, errors, or returns no valid move — so the game stays
 * playable without ever needing a key on the client.
 */
export async function computeIntelligentMove(
  state: GameState,
  onStatus?: (e: AIStatusEvent) => void,
  model?: string,
): Promise<AIDecision> {
  const stateJson = serializeState(state);

  try {
    const res = await fetch(`${apiBase()}/api/ai/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateJson, model }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json() as { error?: string };
        detail = body.error ?? detail;
      } catch { /* non-JSON body */ }
      throw new Error(`AI server ${res.status}: ${detail}`);
    }

    const data = await res.json() as AIMoveResponse;

    // Replay the server's status events so the UI (AIStatusPanel) shows the tool
    // calls and reasoning exactly as if they had happened locally.
    for (const e of data.events ?? []) onStatus?.(e);

    if (data.decision) return data.decision;
    // Server reported a fallback reason via events; fall through to heuristic.
  } catch (e) {
    console.error('[AI] server move request failed:', e);
    onStatus?.({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    onStatus?.({ type: 'fallback', reason: 'error' });
  }

  return computeHeuristicMove(state).decision;
}
