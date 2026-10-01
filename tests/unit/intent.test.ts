import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/agent/intent';

describe('intent extraction (rule-based)', () => {
  it('extracts temperature and budget from "Find somewhere warm under £400."', () => {
    const intent = parseIntent('Find somewhere warm under £400.');
    expect(intent.set.temperature).toBe('warm');
    expect(intent.set.budgetMax).toBe(400);
    expect(intent.mode).toBe('new');
  });

  it('extracts the full brief example without inventing fields', () => {
    const { set } = parseIntent('I want a cheap 4-day trip somewhere warm in November');
    expect(set).toEqual({ month: 'November', durationDays: 4, temperature: 'warm', budgetLevel: 'low' });
  });

  it('understands a beach holiday under £500 with good nightlife', () => {
    const { set } = parseIntent('Find a beach holiday for under £500 with good nightlife');
    expect(set.beach).toBe(true);
    expect(set.holidayTypes).toContain('beach');
    expect(set.budgetMax).toBe(500);
    expect(set.nightlife).toBe('high');
  });

  it('converts nights into days and understands weekends', () => {
    expect(parseIntent('7 nights in Cyprus').set.durationDays).toBe(8);
    expect(parseIntent('a long weekend in Rome').set.durationDays).toBe(4);
    expect(parseIntent('four-day break').set.durationDays).toBe(4);
  });

  it('recognises destinations, countries and Europe', () => {
    expect(parseIntent('What about Tenerife?').set.destinationIds).toEqual(['tenerife']);
    expect(parseIntent('somewhere in Portugal').set.destinationIds).toEqual(['lisbon', 'madeira']);
    expect(parseIntent('I want a 4-day European city break').set).toMatchObject({ europeOnly: true, durationDays: 4, holidayTypes: ['city'] });
  });

  it('treats relative requests as refinements, not new searches', () => {
    const intent = parseIntent('Make it cheaper and closer to the beach.');
    expect(intent.mode).toBe('refine');
    expect(intent.relative).toEqual({ cheaper: true, closerToBeach: true });
    expect(intent.set.beachMaxDistance).toBeUndefined();
  });

  it('detects family and couple preferences', () => {
    expect(parseIntent('Find a family-friendly beach holiday').set.familyFriendly).toBe(true);
    expect(parseIntent('a romantic break for my partner').set.coupleFriendly).toBe(true);
  });

  it('flags non-travel input so the UI can show a helpful error', () => {
    expect(parseIntent('asdf qwerty').travelRelated).toBe(false);
    expect(parseIntent('Help me plan a trip').travelRelated).toBe(true);
  });

  it('handles reset and removal phrases', () => {
    expect(parseIntent('start over').mode).toBe('reset');
    expect(parseIntent("don't worry about the budget").remove).toEqual(expect.arrayContaining(['budgetMax', 'budgetLevel']));
  });

  it('reads "which is the best rated?" as a question, not a filter', () => {
    const intent = parseIntent('Which is the best rated?');
    expect(intent.question).toBe('top_rated');
    expect(intent.set).toEqual({});
  });

  it('chooses hotel focus for hotel-only requests', () => {
    expect(parseIntent('Find a hotel near the beach in Tenerife').focus).toBe('hotels');
    expect(parseIntent('Find a beach holiday').focus).toBe('packages');
  });
});
