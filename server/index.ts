import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { loadConfig } from './config';
import { createApiHandler, createStaticHandler, log } from './app';

/**
 * Standalone BFF server: serves `/api/*` and the built frontend from `dist/`.
 * Stateless — conversation context travels with each request — so it can be
 * scaled horizontally behind a load balancer.
 */
const config = loadConfig();
const handleApi = createApiHandler(config);
const serveStatic = existsSync('dist') ? createStaticHandler('dist') : null;

const server = createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (serveStatic) return serveStatic(req, res);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Frontend not built. Run `npm run build` first, or use `npm run dev`.');
  } catch (error) {
    log('error', 'unhandled_request_error', { error: error instanceof Error ? error.message : String(error) });
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } }));
  }
});

server.listen(config.port, () => {
  log('info', 'server_started', {
    port: config.port,
    aiMode: config.anthropicApiKey ? `llm (${config.llmModel})` : 'demo (rule-based)',
    staticFrontend: Boolean(serveStatic),
  });
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
