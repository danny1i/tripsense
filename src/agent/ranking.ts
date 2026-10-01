import type { Destination, Month, PreferenceKey, RankedTrip, ScoreBreakdown, TravelPreferences, TripOption } from '../types/travel';

/**
 * Transparent DEMONSTRATION ranking model.
 *
 * This is deliberately simple and explainable. It is not a commercial
 * recommendation algorithm. Weights are shown in the UI and docs.
 */
export const RANKING_WEIGHTS: Readonly<ScoreBreakdown> = {
  budget: 0.3,
  preference: 0.25,
  destination: 0.2,
  rating: 0.15,
  convenience: 0.1,
};

export const TEMPERATURE_RULES = {
  warm: { min: 20 },
  hot: { min: 27 },
  mild: { min: 14, max: 24 },
} as const;

/** Upper price used when the user says "cheap" without a number. */
export const CHEAP_PRICE_CEILING = 500;
const DEFAULT_BEACH_DISTANCE = 2000;
const NON_EUROPE_REGIONS: Destination['region'][] = ['North Africa', 'Middle East'];

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function durationTolerance(days: number): number {
  return days >= 7 ? 2 : 1;
}

export function meetsTemperature(temp: number, pref: NonNullable<TravelPreferences['temperature']>): boolean {
  const rule = TEMPERATURE_RULES[pref];
  return temp >= rule.min && ('max' in rule ? temp <= rule.max : true);
}

export interface ConstraintCheck {
  ok: boolean;
  /** Which preferences this trip fails — used to suggest how to broaden. */
  failed: PreferenceKey[];
}

/** Apply the user's hard constraints to a single trip. */
export function checkConstraints(trip: TripOption, destination: Destination, prefs: TravelPreferences, month: Month): ConstraintCheck {
  const failed: PreferenceKey[] = [];

  if (prefs.destinationIds?.length && !prefs.destinationIds.includes(trip.destinationId)) failed.push('destinationIds');
  if (prefs.europeOnly && NON_EUROPE_REGIONS.includes(destination.region)) failed.push('europeOnly');
  if (prefs.month && !trip.availableMonths.includes(prefs.month)) failed.push('month');
  if (prefs.durationDays && Math.abs(trip.duration - prefs.durationDays) > durationTolerance(prefs.durationDays)) failed.push('durationDays');
  if (prefs.temperature && !meetsTemperature(destination.temperatureByMonth[month], prefs.temperature)) failed.push('temperature');
  if (prefs.budgetMax !== undefined && trip.price > prefs.budgetMax) failed.push('budgetMax');
  if (prefs.budgetMax === undefined && prefs.budgetLevel === 'low' && trip.price > CHEAP_PRICE_CEILING) failed.push('budgetLevel');
  if (prefs.budgetLevel === 'luxury' && trip.hotelRating < 4.4 && !trip.holidayTypes.includes('luxury')) failed.push('budgetLevel');
  if (prefs.beach) {
    const limit = prefs.beachMaxDistance ?? DEFAULT_BEACH_DISTANCE;
    if (trip.beachDistance === null || trip.beachDistance > limit) failed.push(prefs.beachMaxDistance !== undefined ? 'beachMaxDistance' : 'beach');
  }
  const styleTypes = (prefs.holidayTypes ?? []).filter((t) => !(t === 'beach' && prefs.beach) && !(t === 'luxury' && prefs.budgetLevel === 'luxury'));
  if (styleTypes.length > 0 && !styleTypes.some((t) => trip.holidayTypes.includes(t))) failed.push('holidayTypes');
  if (prefs.nightlife === 'high' && trip.nightlifeScore < 4) failed.push('nightlife');
  if (prefs.familyFriendly && !trip.familyFriendly) failed.push('familyFriendly');
  if (prefs.coupleFriendly && !trip.coupleFriendly) failed.push('coupleFriendly');
  if (prefs.minRating !== undefined && trip.hotelRating < prefs.minRating) failed.push('minRating');

  return { ok: failed.length === 0, failed };
}

interface ScoreContext {
  month: Month;
  minPrice: number;
  maxPrice: number;
}

function scoreBudget(trip: TripOption, prefs: TravelPreferences, ctx: ScoreContext): number {
  if (prefs.budgetMax !== undefined) return clamp(0.6 + 0.4 * (1 - trip.price / prefs.budgetMax));
  const spread = Math.max(1, ctx.maxPrice - ctx.minPrice);
  const cheapness = 1 - (trip.price - ctx.minPrice) / spread;
  if (prefs.budgetLevel === 'low') return clamp(cheapness);
  if (prefs.budgetLevel === 'luxury') return clamp(1 - cheapness * 0.5);
  return 0.5 + cheapness * 0.3;
}

function scorePreferences(trip: TripOption, prefs: TravelPreferences): number {
  const parts: number[] = [];
  if (prefs.beach) {
    const limit = prefs.beachMaxDistance ?? DEFAULT_BEACH_DISTANCE;
    parts.push(trip.beachDistance === null ? 0 : clamp(1 - trip.beachDistance / (limit * 1.25)));
  }
  if (prefs.durationDays) parts.push(clamp(1 - Math.abs(trip.duration - prefs.durationDays) / 3));
  const types = prefs.holidayTypes ?? [];
  if (types.length > 0) parts.push(types.filter((t) => trip.holidayTypes.includes(t)).length / types.length);
  if (prefs.nightlife) parts.push(trip.nightlifeScore / 5);
  if (prefs.familyFriendly) parts.push(trip.familyFriendly ? 1 : 0);
  if (prefs.coupleFriendly) parts.push(trip.coupleFriendly ? 1 : 0);
  if (parts.length === 0) return 0.7;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function scoreDestination(trip: TripOption, destination: Destination, prefs: TravelPreferences, month: Month): number {
  if (prefs.destinationIds?.includes(trip.destinationId)) return 1;
  if (!prefs.temperature) return 0.7;
  const temp = destination.temperatureByMonth[month];
  const target = prefs.temperature === 'hot' ? 30 : prefs.temperature === 'warm' ? 25 : 19;
  return clamp(1 - Math.abs(temp - target) / 12);
}

const scoreRating = (trip: TripOption) => clamp((trip.hotelRating - 3) / 2);
const scoreConvenience = (destination: Destination) => clamp(1 - (destination.flightHoursFromLondon - 1) / 7);

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km` : `${metres} m`;
}

function buildReasons(trip: TripOption, destination: Destination, prefs: TravelPreferences, month: Month): { reasons: string[]; phrases: string[] } {
  const reasons: string[] = [];
  const phrases: string[] = [];
  const temp = destination.temperatureByMonth[month];

  if (prefs.destinationIds?.includes(trip.destinationId)) {
    reasons.push(`In ${destination.name}, as requested`);
    phrases.push(`is in ${destination.name}`);
  }
  if (prefs.temperature) {
    reasons.push(`${prefs.temperature === 'hot' ? 'Hot' : prefs.temperature === 'mild' ? 'Mild' : 'Warm'} in ${month} (${temp}°C)`);
    phrases.push(`has ${prefs.temperature} ${month} temperatures (around ${temp}°C)`);
  }
  if (prefs.budgetMax !== undefined) {
    reasons.push(`Within budget (£${trip.price} of £${prefs.budgetMax})`);
    phrases.push('fits your budget');
  } else if (prefs.budgetLevel === 'low') {
    reasons.push(`Good value at £${trip.price}pp`);
    phrases.push('is good value');
  }
  if (prefs.beach && trip.beachDistance !== null) {
    reasons.push(`Beach ${formatDistance(trip.beachDistance)} away`);
    phrases.push(trip.beachDistance <= 1000 ? 'is within 1 km of the beach' : `is ${formatDistance(trip.beachDistance)} from the beach`);
  }
  if (prefs.durationDays) {
    reasons.push(trip.duration === prefs.durationDays ? `Exactly ${trip.duration} days` : `${trip.duration} days — close to your ${prefs.durationDays}`);
  }
  if (prefs.nightlife && trip.nightlifeScore >= 4) {
    reasons.push('Lively nightlife nearby');
    phrases.push('has lively nightlife');
  }
  if (prefs.familyFriendly && trip.familyFriendly) {
    reasons.push('Family-friendly hotel');
    phrases.push('is family-friendly');
  }
  if (prefs.coupleFriendly && trip.coupleFriendly) {
    reasons.push('Well suited to couples');
    phrases.push('suits couples');
  }
  const matchedTypes = (prefs.holidayTypes ?? []).filter((t) => t !== 'beach' && trip.holidayTypes.includes(t));
  if (matchedTypes.length > 0) {
    reasons.push(`Great for ${matchedTypes.join(' & ')}`);
    phrases.push(`is great for ${matchedTypes.join(' and ')}`);
  }
  if (trip.hotelRating >= 4.5) reasons.push(`Highly rated hotel (${trip.hotelRating}/5)`);
  if (reasons.length === 0) reasons.push(`${destination.summary}`);
  return { reasons, phrases };
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? '';
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

/** Score, explain and sort a set of trips that already passed the filters. */
export function rankTrips(
  candidates: { trip: TripOption; destination: Destination }[],
  prefs: TravelPreferences,
  month: Month,
): RankedTrip[] {
  if (candidates.length === 0) return [];
  const prices = candidates.map((c) => c.trip.price);
  const ctx: ScoreContext = { month, minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };

  return candidates
    .map(({ trip, destination }) => {
      const breakdown: ScoreBreakdown = {
        budget: scoreBudget(trip, prefs, ctx),
        preference: scorePreferences(trip, prefs),
        destination: scoreDestination(trip, destination, prefs, month),
        rating: scoreRating(trip),
        convenience: scoreConvenience(destination),
      };
      const weighted = (Object.keys(RANKING_WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
        (sum, key) => sum + breakdown[key] * RANKING_WEIGHTS[key],
        0,
      );
      const score = Math.round(weighted * 100);
      const { reasons, phrases } = buildReasons(trip, destination, prefs, month);
      const strength = score >= 80 ? 'Strong match' : score >= 65 ? 'Good match' : 'Partial match';
      const explanation = phrases.length
        ? `${strength} because it ${joinPhrases(phrases.slice(0, 3))}.`
        : `${strength}: ${destination.summary}`;
      return {
        trip,
        destination,
        score,
        breakdown,
        matchReasons: reasons.slice(0, 4),
        explanation,
        temperatureForMonth: destination.temperatureByMonth[month],
      };
    })
    .sort((a, b) => b.score - a.score || a.trip.price - b.trip.price);
}
