import * as esbuild from 'esbuild';
import { rmSync } from 'node:fs';

// Vercel runs api/*.js as serverless handlers. Bundle server + core so Node ESM
// does not need extensionless imports under /var/task/src.
rmSync('api/index.js', { force: true });

await esbuild.build({
  entryPoints: ['server/vercel.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.js',
  packages: 'external',
  logLevel: 'info',
});
