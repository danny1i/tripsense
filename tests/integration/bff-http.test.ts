import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiHandler } from '../../server/app';
import { loadConfig } from '../../server/config';

/**
 * Integration tests over real HTTP: Node server → BFF controller → agent →
 * tools → provider → demo data. No API key is set, so this also proves Demo
 * Mode works end to end.
 */
let server: Server;
let base: string;

beforeAll(async () => {
  const config = { ...loadConfig({}), logEvents: false, rateLimitPerMinute: 1000, allowedOrigins: ['http://localhost:5173'] };
  const handle = createApiHandler(config);
  server = createServer((req, res) => {
    void handle(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('BFF over HTTP', () => {
  it('reports health in demo mode without an API key', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(await res.json()).toMatchObject({ status: 'ok', mode: 'demo' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-tripsense-bff')).toBe('1');
  });

  it('runs a conversation and a stateless follow-up', async () => {
    const first = await (await post('/api/conversation', { message: 'Find me somewhere warm in November', sessionId: 'session-1' })).json();
    expect(first.outcome).toBe('results');
    const second = await (
      await post('/api/conversation', {
        message: 'Make it cheaper',
        sessionId: 'session-1',
        preferences: first.preferences,
        visibleTripIds: first.results.map((r: { trip: { id: string } }) => r.trip.id),
      })
    ).json();
    expect(second.preferences).toMatchObject({ temperature: 'warm', month: 'November' });
    expect(second.preferences.budgetMax).toBeGreaterThan(0);
  });

  it('supports structured search for the filter panel', async () => {
    const res = await post('/api/search', { sessionId: 'session-1', preferences: { budgetMax: 350, beach: true } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results.every((r: { trip: { price: number } }) => r.trip.price <= 350)).toBe(true);
  });

  it('returns trip details, recommendations and answers questions', async () => {
    const trip = await (await fetch(`${base}/api/trips/trip-001?preferences=${encodeURIComponent('{"month":"November"}')}`)).json();
    expect(trip.trip.hotelName).toBe('Costa Adeje Sunset Hotel');
    const recs = await (await fetch(`${base}/api/recommendations?tripId=trip-001`)).json();
    expect(Array.isArray(recs.recommendations)).toBe(true);
    const qa = await (await post('/api/trips/trip-001/questions', { question: 'Is this suitable for a couple?' })).json();
    expect(qa.answer).toMatch(/couple/);
  });

  it('rejects invalid requests with a friendly message and no internals', async () => {
    const res = await post('/api/conversation', { message: '', sessionId: 'x' });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/couldn't understand that request/);
    expect(JSON.stringify(body)).not.toMatch(/at .*\.ts/); // no stack traces
  });

  it('rejects unknown preference fields and over-long messages', async () => {
    expect((await post('/api/search', { sessionId: 'session-1', preferences: { hack: true } })).status).toBe(400);
    expect((await post('/api/conversation', { message: 'a'.repeat(501), sessionId: 'session-1' })).status).toBe(400);
  });

  it('rejects non-JSON bodies and malformed JSON', async () => {
    expect((await fetch(`${base}/api/search`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' })).status).toBe(415);
    expect((await fetch(`${base}/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status).toBe(400);
  });

  it('returns 404 for unknown trips and routes', async () => {
    expect((await fetch(`${base}/api/trips/trip-999`)).status).toBe(404);
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });

  it('only allows configured CORS origins', async () => {
    const allowed = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const blocked = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('accepts analytics events', async () => {
    const res = await post('/api/events', { events: [{ name: 'search_started', sessionId: 'session-1', timestamp: Date.now(), properties: { source: 'test' } }] });
    expect(res.status).toBe(202);
  });
});
