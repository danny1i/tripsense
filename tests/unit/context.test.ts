import { describe, expect, it } from 'vitest';
import { mergeIntent, removePreference, diffPreferences } from '../../src/agent/context';
import { parseIntent } from '../../src/agent/intent';
import { TRIPS } from '../../src/data/trips';

const trips = (ids: string[]) => TRIPS.filter((t) => ids.includes(t.id));

describe('conversation context', () => {
  it('keeps the original context when the user says "make it cheaper"', () => {
    const first = mergeIntent({}, parseIntent('Find me somewhere warm in November'), []);
    const second = mergeIntent(first.preferences, parseIntent('Make it cheaper'), trips(['trip-001', 'trip-005', 'trip-008']));
    expect(second.preferences.temperature).toBe('warm');
    expect(second.preferences.month).toBe('November');
    expect(second.preferences.budgetMax).toBeLessThan(469);
    expect(second.changes.map((c) => c.key)).toContain('budgetMax');
  });

  it('lowers an existing budget when asked to make it cheaper', () => {
    const { preferences } = mergeIntent({ budgetMax: 500 }, parseIntent('make it cheaper'), []);
    expect(preferences.budgetMax).toBe(400);
  });

  it('combines preferences across turns ("and somewhere near the beach")', () => {
    const { preferences } = mergeIntent({ temperature: 'warm', month: 'November', budgetLevel: 'low' }, parseIntent('And somewhere near the beach'), []);
    expect(preferences).toMatchObject({ temperature: 'warm', month: 'November', budgetLevel: 'low', beach: true, beachMaxDistance: 1000 });
  });

  it('halves the beach distance on "closer to the beach" when one is set', () => {
    const { preferences } = mergeIntent({ beach: true, beachMaxDistance: 1000 }, parseIntent('even closer to the beach'), []);
    expect(preferences.beachMaxDistance).toBe(500);
  });

  it('replaces context for a clearly new request', () => {
    const { preferences } = mergeIntent({ temperature: 'warm', beach: true }, parseIntent('Find me a city break in Paris'), []);
    expect(preferences.temperature).toBeUndefined();
    expect(preferences.destinationIds).toEqual(['paris']);
  });

  it('removes a single preference and its dependants', () => {
    const next = removePreference({ beach: true, beachMaxDistance: 500, holidayTypes: ['beach'], month: 'May' }, 'beach');
    expect(next).toEqual({ month: 'May' });
  });

  it('describes changes for the "I\'ve updated your search" message', () => {
    expect(diffPreferences({ month: 'May' }, { month: 'May', budgetMax: 400 })).toEqual([{ key: 'budgetMax', label: 'Under £400' }]);
  });
});
