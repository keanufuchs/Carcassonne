// ── Reasoning-AI model catalogue ────────────────────────────────────────────
//
// The models the user can pick from in the UI are configured in .env via
// `VITE_AI_MODELS` (comma-separated). Example for the RH Köln endpoint:
//
//   VITE_AI_MODELS=openai-gpt-oss-120b,gemma-4-31b-it,qwen3.6-35b-a3b
//
// `VITE_AI_MODEL` stays supported as a single-model / default override.

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Models offered in the setup UI, de-duplicated and order-preserving.
 * Built from `VITE_AI_MODELS`, with `VITE_AI_MODEL` prepended if set.
 * Falls back to the built-in default when nothing is configured.
 */
export function getAvailableModels(): string[] {
  const list = parseList(import.meta.env.VITE_AI_MODELS);
  const single = import.meta.env.VITE_AI_MODEL?.trim();
  const ordered = [...(single ? [single] : []), ...list];
  const seen = new Set<string>();
  const result = ordered.filter(m => (seen.has(m) ? false : (seen.add(m), true)));
  return result.length > 0 ? result : [DEFAULT_MODEL];
}

/** The model selected by default in the UI (first available). */
export function getDefaultModel(): string {
  return getAvailableModels()[0];
}
