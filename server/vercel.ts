import type { IncomingMessage, ServerResponse } from 'node:http';
import serverless from 'serverless-http';
import { app } from './app.js';

const expressHandler = serverless(app);

/** Keep Express path when Vercel rewrites strip /api/... segments. */
export default function vercelHandler(req: IncomingMessage, res: ServerResponse): ReturnType<typeof expressHandler> {
  const original = req.headers['x-vercel-original-url'] ?? req.headers['x-invoke-path'];
  if (typeof original === 'string') {
    const pathOnly = original.split('?')[0]!;
    const query = (req.url ?? '').includes('?') ? (req.url ?? '').slice((req.url ?? '').indexOf('?')) : '';
    req.url = pathOnly + query;
  }
  return expressHandler(req, res);
}
