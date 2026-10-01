import { describe, expect, it } from 'vitest';
import { converse, makeAgent } from '../helpers';
import type { IntentExtractor } from '../../src/agent/intent';

describe('TravelAgent — search, orchestration and context', () => {
  it('returns warm November results for the demo request', async () => {
    const [res] = await converse(makeAgent(), ['Find me a cheap 4-day trip somewhere warm in November.']);
    expect(res!.outcome).toBe('results');
    expect(res!.totalMatches).toBeGreaterThan(5);
    expect(res!.results.every((r) => r.temperatureForMonth >= 20)).toBe(true);
    expect(res!.results.every((r) => Math.abs(r.trip.duration - 4) <= 1)).toBe(true);
    expect(res!.reply).toMatch(/I found \d+ trips matching your preferences/);
  });

  it('records the tools it used, in order, without exposing reasoning', async () => {
    const [res] = await converse(makeAgent(), ['Find me a cheap beach holiday']);
    expect(res!.steps.map((s) => s.tool)).toEqual([
      'extractIntent',
      'searchDestinations',
      'searchFlights',
      'searchPackages',
      'filterResults',
      'rankResults',
      'compareTravelOptions',
    ]);
    expect(res!.telemetry.toolCalls).toBeGreaterThanOrEqual(5);
  });

  it('uses getDestinationDetails + searchHotels for "a hotel near the beach in Tenerife"', async () => {
    const [res] = await converse(makeAgent(), ['Find a hotel near the beach in Tenerife']);
    const tools = res!.steps.map((s) => s.tool);
    expect(tools).toContain('getDestinationDetails');
    expect(tools).toContain('searchHotels');
    expect(tools).not.toContain('searchDestinations');
    expect(res!.results.every((r) => r.destination.id === 'tenerife' && (r.trip.beachDistance ?? Infinity) <= 1000)).toBe(true);
  });

  it('retains context: "warm" → "make it cheaper" keeps warm and adds a budget', async () => {
    const [first, second] = await converse(makeAgent(), ['Find somewhere warm.', 'Make it cheaper.']);
    expect(first!.preferences.temperature).toBe('warm');
    expect(second!.preferences.temperature).toBe('warm');
    expect(second!.preferences.budgetMax).toBeDefined();
    expect(second!.reply).toMatch(/^I've updated your search/);
    expect(second!.results.every((r) => r.trip.price <= second!.preferences.budgetMax!)).toBe(true);
  });

  it('runs the full demo script refinement and keeps Tenerife available', async () => {
    const [, refined, tenerife] = await converse(makeAgent(), [
      'Find me a cheap 4-day trip somewhere warm in November.',
      'Make it cheaper and closer to the beach.',
      'What about Tenerife?',
    ]);
    expect(refined!.changes.map((c) => c.label)).toEqual(['Under £400', 'Beach within 1 km']);
    expect(refined!.results.some((r) => r.destination.id === 'tenerife')).toBe(true);
    expect(refined!.results.every((r) => r.trip.price <= 400 && (r.trip.beachDistance ?? Infinity) <= 1000)).toBe(true);
    expect(tenerife!.reply).toMatch(/Here are Tenerife options matching your current preferences/);
    expect(tenerife!.preferences.month).toBe('November');
  });

  it('asks a clarification question when nothing actionable was given', async () => {
    const [res] = await converse(makeAgent(), ['Help me plan a trip']);
    expect(res!.outcome).toBe('clarification');
    expect(res!.reply).toMatch(/preferred travel month or budget/);
    expect(res!.steps.map((s) => s.tool)).toEqual(['extractIntent']);
  });

  it('returns an invalid outcome for non-travel input', async () => {
    const [res] = await converse(makeAgent(), ['asdf qwerty']);
    expect(res!.outcome).toBe('invalid');
    expect(res!.reply).toMatch(/couldn't understand that request/);
  });

  it('never shows a blank page: empty results come with ways to broaden', async () => {
    const [res] = await converse(makeAgent(), ['Find a beach holiday for under £200']);
    expect(res!.outcome).toBe('no_results');
    expect(res!.results).toHaveLength(0);
    expect(res!.suggestions[0]).toMatchObject({ id: 'increase-budget' });
    expect(res!.suggestions[0]!.resultCount).toBeGreaterThan(0);
    expect(res!.reply).toMatch(/0 options under £200, but there (is|are) \d+ options? between £200–£\d+/);
  });

  it('degrades gracefully when a non-critical tool fails', async () => {
    const [res] = await converse(makeAgent({ provider: { failOn: ['searchFlights'] } }), ['Find somewhere warm']);
    expect(res!.outcome).toBe('results');
    expect(res!.telemetry.toolErrors).toBe(1);
    expect(res!.steps.find((s) => s.tool === 'searchFlights')?.status).toBe('error');
  });

  it('throws a search error when a critical tool fails', async () => {
    await expect(converse(makeAgent({ provider: { failOn: ['listTrips'] } }), ['Find somewhere warm'])).rejects.toMatchObject({ kind: 'search' });
  });

  it('falls back to rules when the AI model fails', async () => {
    const broken: IntentExtractor = { source: 'llm', extract: async () => { throw new Error('timeout'); } };
    const [res] = await converse(makeAgent({ intentExtractor: broken }), ['Find somewhere warm under £400']);
    expect(res!.outcome).toBe('results');
    expect(res!.intentSource).toBe('rules');
    expect(res!.steps[0]).toMatchObject({ status: 'error', label: 'AI model unavailable' });
    expect(res!.preferences).toMatchObject({ temperature: 'warm', budgetMax: 400 });
  });

  it('uses the AI extractor output when it succeeds', async () => {
    const fake: IntentExtractor = {
      source: 'llm',
      extract: async () => ({ set: { destinationIds: ['malta'] }, remove: [], relative: {}, mode: 'new', focus: 'packages', travelRelated: true }),
    };
    const [res] = await converse(makeAgent({ intentExtractor: fake }), ['anything']);
    expect(res!.intentSource).toBe('llm');
    expect(res!.results.every((r) => r.destination.id === 'malta')).toBe(true);
  });

  it('provides trip details with similar options from other destinations', async () => {
    const details = await makeAgent().getTripDetails('trip-001', { temperature: 'warm', month: 'November' });
    expect(details?.destination.name).toBe('Tenerife');
    expect(details?.similar.length).toBeGreaterThan(0);
    expect(details?.similar.every((s) => s.destination.id !== 'tenerife')).toBe(true);
  });
});
