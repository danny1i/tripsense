import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createController, type Controller } from '../src/bff/controller';
import { MockTravelProvider } from '../src/providers/travelProvider';
import type { ServerConfig } from './config';
import { createLlmIntentExtractor } from './llmIntent';

const MAX_BODY_BYTES = 32 * 1024;

/** Lets the frontend tell the real BFF apart from any other host answering /api/*. */
export const BFF_MARKER_HEADER = 'X-TripSense-BFF';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'";

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/** Structured JSON log line — what CloudWatch Logs would ingest in production. */
export function log(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

/** Very small fixed-window rate limiter. Production would use API Gateway / WAF. */
export function createRateLimiter(limitPerMinute: number) {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart >= 60_000) {
      hits.set(key, { count: 1, windowStart: now });
      if (hits.size > 10_000) hits.clear();
      return true;
    }
    entry.count += 1;
    return entry.count <= limitPerMinute;
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new RangeError('Body too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    [BFF_MARKER_HEADER]: '1',
    ...SECURITY_HEADERS,
    ...extra,
  });
  res.end(JSON.stringify(body));
}

export function createBffController(config: ServerConfig): Controller {
  const intentExtractor = config.anthropicApiKey
    ? createLlmIntentExtractor({ apiKey: config.anthropicApiKey, model: config.llmModel, timeoutMs: config.llmTimeoutMs })
    : undefined;
  return createController({
    provider: new MockTravelProvider(),
    intentExtractor,
    onEvents: (events) => {
      if (config.logEvents) for (const event of events) log('info', 'analytics_event', { event });
    },
    onError: (error, context) => log('error', 'request_failed', { context, error: error instanceof Error ? error.message : String(error) }),
  });
}

/**
 * Node request handler for `/api/*`. Returns false if the request is not an
 * API request so the caller can serve static files (or let Vite handle it).
 */
export function createApiHandler(config: ServerConfig, controller = createBffController(config)) {
  const allowRequest = createRateLimiter(config.rateLimitPerMinute);

  return async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;

    const started = performance.now();
    const origin = req.headers.origin;
    const cors: Record<string, string> = {};
    if (origin && config.allowedOrigins.includes(origin)) {
      cors['Access-Control-Allow-Origin'] = origin;
      cors.Vary = 'Origin';
      cors['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
      cors['Access-Control-Allow-Headers'] = 'Content-Type';
      cors['Access-Control-Expose-Headers'] = BFF_MARKER_HEADER;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(origin && cors['Access-Control-Allow-Origin'] ? 204 : 403, { ...cors, ...SECURITY_HEADERS });
      res.end();
      return true;
    }

    const clientKey = req.socket.remoteAddress ?? 'unknown';
    if (!allowRequest(clientKey)) {
      sendJson(res, 429, { error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } }, { ...cors, 'Retry-After': '60' });
      return true;
    }

    let body: unknown;
    if (req.method === 'POST') {
      if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
        sendJson(res, 415, { error: { code: 'unsupported_media_type', message: 'Requests must be JSON.' } }, cors);
        return true;
      }
      try {
        body = await readJson(req);
      } catch (error) {
        const tooLarge = error instanceof RangeError;
        sendJson(res, tooLarge ? 413 : 400, { error: { code: tooLarge ? 'payload_too_large' : 'invalid_json', message: 'The request could not be read.' } }, cors);
        return true;
      }
    }

    const result = await controller.handle({ method: req.method ?? 'GET', path: url.pathname, query: url.searchParams, body });
    sendJson(res, result.status, result.body, cors);
    if (url.pathname !== '/api/events') {
      log('info', 'api_request', { method: req.method, path: url.pathname, status: result.status, latencyMs: Math.round(performance.now() - started) });
    }
    return true;
  };
}

/** Serve the built frontend from `dist/` with SPA fallback (production only). */
export function createStaticHandler(root: string) {
  const base = resolve(root);
  return function serveStatic(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const requested = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let filePath = resolve(join(base, requested));
    if (!filePath.startsWith(base)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(base, 'index.html');
    const ext = extname(filePath);
    const immutable = filePath.includes(`${base}/assets/`);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': CSP,
      ...SECURITY_HEADERS,
    });
    createReadStream(filePath).pipe(res);
  };
}
