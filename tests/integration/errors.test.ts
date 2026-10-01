import { describe, expect, it } from 'vitest';
import { createController } from '../../src/bff/controller';
import { MockTravelProvider } from '../../src/providers/travelProvider';
import type { IntentExtractor } from '../../src/agent/intent';

const body = { message: 'Find somewhere warm', sessionId: 'session-1' };

describe('BFF error handling', () => {
  it('maps a travel provider outage to a 503 with a friendly message', async () => {
    const errors: unknown[] = [];
    const controller = createController({ provider: new MockTravelProvider({ failOn: ['listTrips'] }), onError: (e) => errors.push(e) });
    const res = await controller.handle({ method: 'POST', path: '/api/conversation', body });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: 'search_unavailable', message: 'Travel search is temporarily unavailable. Please try again.' } });
    expect(errors).toHaveLength(1); // logged server-side
  });

  it('keeps working when the AI model fails (falls back to rules)', async () => {
    const failing: IntentExtractor = { source: 'llm', extract: () => Promise.reject(new Error('503 from model')) };
    const res = await createController({ intentExtractor: failing }).handle({ method: 'POST', path: '/api/conversation', body });
    expect(res.status).toBe(200);
  });

  it('maps unexpected errors to a generic 500 without leaking details', async () => {
    const provider = new MockTravelProvider();
    provider.getTrip = () => {
      throw new TypeError('Cannot read properties of undefined (secret internals)');
    };
    const res = await createController({ provider }).handle({ method: 'GET', path: '/api/trips/trip-001' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret internals');
  });
});
