import { describe, expect, it } from 'vitest';
import { answerTripQuestion } from '../../src/agent/tripQA';
import { TRIPS } from '../../src/data/trips';
import { DESTINATIONS_BY_ID } from '../../src/data/destinations';

const ask = (tripId: string, question: string) => {
  const trip = TRIPS.find((t) => t.id === tripId)!;
  return answerTripQuestion({ trip, destination: DESTINATIONS_BY_ID.get(trip.destinationId)!, question, preferences: { budgetMax: 400 }, month: 'November' });
};

describe('Ask AI about this trip', () => {
  it('answers couple suitability from the data', () => {
    expect(ask('trip-001', 'Is this suitable for a couple?').answer).toMatch(/^Yes/);
    expect(ask('trip-012', 'Is this good for a couple?').answer).toMatch(/not our top pick/);
  });

  it('answers beach distance precisely', () => {
    expect(ask('trip-001', 'How far is it from the beach?').answer).toContain('600 m');
    expect(ask('trip-017', 'Is there a beach?').answer).toMatch(/no beach/i);
  });

  it('answers weather for the requested month and price vs budget', () => {
    expect(ask('trip-001', 'What will the weather be like?').answer).toContain('24°C');
    expect(ask('trip-001', 'How much does it cost?').answer).toContain('within your £400 budget');
  });

  it('admits when it cannot answer instead of inventing facts', () => {
    const res = ask('trip-001', 'Can I bring my pet iguana?');
    expect(res.answer).toMatch(/only answer from the trip information/);
    expect(res.basedOn).toEqual([]);
  });
});
