import { describe, expect, it } from 'vitest';
import { checkConstraints, rankTrips, RANKING_WEIGHTS } from '../../src/agent/ranking';
import { TRIPS } from '../../src/data/trips';
import { DESTINATIONS_BY_ID } from '../../src/data/destinations';
import type { TravelPreferences } from '../../src/types/travel';

const all = TRIPS.map((trip) => ({ trip, destination: DESTINATIONS_BY_ID.get(trip.destinationId)! }));
const filter = (prefs: TravelPreferences, month = prefs.month ?? 'November') =>
  all.filter((c) => checkConstraints(c.trip, c.destination, prefs, month).ok);

describe('filtering and ranking', () => {
  it('weights add up to 100%', () => {
    const total = Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
  });

  it('removes results over the requested budget', () => {
    const results = filter({ budgetMax: 400 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.trip.price <= 400)).toBe(true);
  });

  it('only keeps destinations that are warm in the requested month', () => {
    const results = filter({ temperature: 'warm', month: 'November' });
    const names = new Set(results.map((r) => r.destination.name));
    expect(names.has('Tenerife')).toBe(true);
    expect(names.has('Paris')).toBe(false);
    expect(names.has('Amsterdam')).toBe(false);
  });

  it('enforces beach distance', () => {
    const results = filter({ beach: true, beachMaxDistance: 500 });
    expect(results.every((r) => r.trip.beachDistance !== null && r.trip.beachDistance <= 500)).toBe(true);
  });

  it('prioritises trips closer to the beach when beach is a preference', () => {
    const prefs: TravelPreferences = { beach: true };
    const ranked = rankTrips(
      filter(prefs).filter((c) => ['trip-002', 'trip-008'].includes(c.trip.id)),
      prefs,
      'November',
    );
    // trip-002 is 250m from the beach, trip-008 is 1.5km.
    expect(ranked[0]?.trip.id).toBe('trip-002');
  });

  it('ranks cheaper trips higher for a "cheap" search, all else being equal', () => {
    const prefs: TravelPreferences = { budgetLevel: 'low', destinationIds: ['gran-canaria'] };
    const ranked = rankTrips(filter(prefs), prefs, 'November');
    expect(ranked[0]?.trip.price).toBe(Math.min(...ranked.map((r) => r.trip.price)));
  });

  it('produces scores between 0 and 100 with an explanation', () => {
    const ranked = rankTrips(filter({ temperature: 'warm', month: 'November', budgetMax: 450 }), { temperature: 'warm', month: 'November', budgetMax: 450 }, 'November');
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.explanation).toMatch(/match/i);
      expect(r.matchReasons.length).toBeGreaterThan(0);
    }
    // Sorted by score, best first.
    expect(ranked.map((r) => r.score)).toEqual([...ranked.map((r) => r.score)].sort((a, b) => b - a));
  });

  it('excludes trips not offered in the requested month', () => {
    expect(filter({ destinationIds: ['amsterdam'], month: 'November' }).map((r) => r.trip.id)).not.toContain('trip-037');
  });
});
