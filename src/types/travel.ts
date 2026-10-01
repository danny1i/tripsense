/**
 * Core travel domain model.
 *
 * These types are shared by the frontend, the BFF and the agent so that the
 * contract between layers is checked by the compiler.
 */

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type Month = (typeof MONTHS)[number];

export const HOLIDAY_TYPES = [
  'beach',
  'city',
  'culture',
  'relaxation',
  'nightlife',
  'food',
  'adventure',
  'luxury',
  'family',
] as const;

export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export type SceneKind = 'beach' | 'island' | 'city' | 'desert' | 'canal' | 'mountain';

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: 'Canary Islands' | 'Mediterranean' | 'Atlantic' | 'Western Europe' | 'North Africa' | 'Middle East';
  /** Average daytime high in °C for each month. */
  temperatureByMonth: Record<Month, number>;
  hasBeach: boolean;
  flightHoursFromLondon: number;
  summary: string;
  activities: string[];
  bestFor: string[];
  /** Visual theme used by the illustrated destination artwork. */
  scene: SceneKind;
  palette: { sky: string; horizon: string; accent: string; ground: string };
}

export interface TripOption {
  id: string;
  destinationId: string;
  hotelName: string;
  /** Price per person in GBP, including flights and hotel. */
  price: number;
  currency: 'GBP';
  nights: number;
  /** Trip length in days (nights + 1). */
  duration: number;
  hotelRating: number;
  /** Metres from hotel to nearest beach. `null` means no beach nearby. */
  beachDistance: number | null;
  nightlifeScore: 1 | 2 | 3 | 4 | 5;
  familyFriendly: boolean;
  coupleFriendly: boolean;
  holidayTypes: HolidayType[];
  amenities: string[];
  boardBasis: 'Room only' | 'Bed & breakfast' | 'Half board' | 'All inclusive';
  departureAirport: string;
  /** Months this package is offered in. */
  availableMonths: Month[];
  description: string;
  itinerary: string[];
}

export type TemperaturePreference = 'mild' | 'warm' | 'hot';
export type BudgetLevel = 'low' | 'mid' | 'luxury';

/**
 * Structured travel intent extracted from natural language.
 * Every field is optional: we never invent information the user did not give.
 */
export interface TravelPreferences {
  destinationIds?: string[];
  europeOnly?: boolean;
  month?: Month;
  durationDays?: number;
  temperature?: TemperaturePreference;
  budgetMax?: number;
  budgetLevel?: BudgetLevel;
  beach?: boolean;
  beachMaxDistance?: number;
  holidayTypes?: HolidayType[];
  nightlife?: 'high';
  familyFriendly?: boolean;
  coupleFriendly?: boolean;
  minRating?: number;
  travellers?: number;
}

export type PreferenceKey = keyof TravelPreferences;

export interface ScoreBreakdown {
  budget: number;
  preference: number;
  destination: number;
  rating: number;
  convenience: number;
}

export interface RankedTrip {
  trip: TripOption;
  destination: Destination;
  /** 0–100 demonstration match score. */
  score: number;
  breakdown: ScoreBreakdown;
  /** Short, user-facing reasons this trip matches. */
  matchReasons: string[];
  /** One-sentence explanation. */
  explanation: string;
  /** Temperature for the requested month, or the annual high if no month. */
  temperatureForMonth: number;
}
