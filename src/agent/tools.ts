import type { ComparisonSummary, ToolName } from '../types/agent';
import type { Destination, Month, TravelPreferences, TripOption } from '../types/travel';
import type { FlightOption, TravelProvider } from '../providers/travelProvider';
import { meetsTemperature } from './ranking';

/**
 * Agent tools. Each tool is a small, typed function over the
 * {@link TravelProvider}. Swapping the provider for real APIs does not change
 * the tool signatures the agent depends on.
 */

export interface DestinationCriteria {
  preferences: TravelPreferences;
  month: Month;
}

export interface PackageCriteria {
  destinationIds: string[];
  month?: Month;
}

export interface TravelTools {
  searchDestinations(criteria: DestinationCriteria): Promise<Destination[]>;
  searchFlights(origin: string, destinationIds: string[], dates: { month?: Month }, travellers: number): Promise<FlightOption[]>;
  searchHotels(destinationIds: string[], dates: { month?: Month }, travellers: number, budget?: number): Promise<TripOption[]>;
  searchPackages(criteria: PackageCriteria): Promise<TripOption[]>;
  getDestinationDetails(destinationId: string): Promise<Destination | undefined>;
  compareTravelOptions(optionIds: string[]): Promise<ComparisonSummary | null>;
}

/** Descriptions used in the UI and documentation (and usable as LLM tool specs). */
export const TOOL_CATALOGUE: { name: ToolName; signature: string; description: string }[] = [
  { name: 'searchDestinations', signature: 'searchDestinations(criteria)', description: 'Find destinations that suit the weather, region and beach preferences for the travel month.' },
  { name: 'searchFlights', signature: 'searchFlights(origin, destination, dates, travellers)', description: 'Look up indicative flight time and directness from the departure airport.' },
  { name: 'searchHotels', signature: 'searchHotels(destination, dates, travellers, budget)', description: 'Find hotels in a specific destination, optionally under a budget.' },
  { name: 'searchPackages', signature: 'searchPackages(criteria)', description: 'Find flight + hotel packages for candidate destinations and dates.' },
  { name: 'getDestinationDetails', signature: 'getDestinationDetails(destination)', description: 'Fetch destination facts: climate, activities and what it is best for.' },
  { name: 'compareTravelOptions', signature: 'compareTravelOptions(optionIds)', description: 'Compare shortlisted options on price, rating and beach distance.' },
];

const availableIn = (trip: TripOption, month?: Month) => !month || trip.availableMonths.includes(month);

export function createTravelTools(provider: TravelProvider): TravelTools {
  return {
    async searchDestinations({ preferences, month }) {
      const all = await provider.listDestinations();
      return all.filter((d) => {
        if (preferences.destinationIds?.length && !preferences.destinationIds.includes(d.id)) return false;
        if (preferences.europeOnly && (d.region === 'North Africa' || d.region === 'Middle East')) return false;
        if (preferences.temperature && !meetsTemperature(d.temperatureByMonth[month], preferences.temperature)) return false;
        if (preferences.beach && !d.hasBeach) return false;
        return true;
      });
    },

    async searchFlights(origin, destinationIds) {
      return provider.searchFlights(origin, destinationIds);
    },

    async searchHotels(destinationIds, dates, _travellers, budget) {
      const trips = await provider.listTrips({ destinationIds });
      return trips.filter((t) => availableIn(t, dates.month) && (budget === undefined || t.price <= budget));
    },

    async searchPackages({ destinationIds, month }) {
      const trips = await provider.listTrips({ destinationIds });
      return trips.filter((t) => availableIn(t, month));
    },

    async getDestinationDetails(destinationId) {
      return provider.getDestination(destinationId);
    },

    async compareTravelOptions(optionIds) {
      const trips = (await Promise.all(optionIds.map((id) => provider.getTrip(id)))).filter((t): t is TripOption => Boolean(t));
      if (trips.length === 0) return null;
      const bestValue = trips.reduce((a, b) => (b.price < a.price ? b : a));
      const topRated = trips.reduce((a, b) => (b.hotelRating > a.hotelRating ? b : a));
      const withBeach = trips.filter((t) => t.beachDistance !== null);
      const closest = withBeach.length ? withBeach.reduce((a, b) => ((b.beachDistance ?? Infinity) < (a.beachDistance ?? Infinity) ? b : a)) : null;
      const prices = trips.map((t) => t.price);
      return {
        bestValueId: bestValue.id,
        topRatedId: topRated.id,
        closestBeachId: closest?.id ?? null,
        priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      };
    },
  };
}
