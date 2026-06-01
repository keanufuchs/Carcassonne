import * as esbuild from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';

// Catch-all api/[...path].js handles /api/games, /api/games/:id/join, etc.
// (api/index.js only serves /api and causes 405 on subpaths.)
for (const name of readdirSync('api')) {
  if (name.endsWith('.js')) rmSync(`api/${name}`, { force: true });
}

await esbuild.build({
  entryPoints: ['server/vercel.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/[...path].js',
  packages: 'external',
  logLevel: 'info',
});
