import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Standalone Tile-Lab dev app. Lives in the same repo as the game but builds
// and serves independently — no impact on the game's bundle or architecture.
// Shares the game's tile assets via a `publicDir` pointer (no file duplication)
// and imports the TS tile definitions directly from `../src/core/**`.
const dir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: dir,
  publicDir: path.resolve(dir, '../public'),
  plugins: [react()],
  server: { port: 5174, host: true },
  build: { outDir: path.resolve(dir, 'dist') },
});
