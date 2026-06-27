// ─────────────────────────────────────────────────────────────────────────────
// Minimal, zero-dependency .env loader for the Node server.
//
// Why not `node --env-file`? That flag needs Node ≥20.6 (and --env-file-if-exists
// needs ≥22) and hard-crashes older runtimes — but a dev machine may still have
// Node 18 active. This loader works on any version and never overrides a variable
// that is already set in the real environment (CI / shell / hosting take priority).
//
// Importing this module has the side effect of populating process.env, so it must
// be imported for its side effect BEFORE anything reads AI_API_KEY etc.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  if (!key) return null;
  let value = trimmed.slice(eq + 1).trim();
  // Strip matching surrounding quotes.
  if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const pair = parseLine(line);
    if (!pair) continue;
    const [key, value] = pair;
    // Real environment wins over the .env file.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Project root is one level up from server/. Load .env, then layer .env.local.
const root = path.resolve(__dirname, '..');
loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));
