import type { Destination, TripOption } from '../types/travel';
import { DESTINATIONS, DESTINATIONS_BY_ID } from '../data/destinations';
import { TRIPS } from '../data/trips';

export interface FlightOption {
  destinationId: string;
  origin: string;
  durationHours: number;
  /** Illustrative return fare per person, already included in package prices. */
  indicativeFare: number;
  direct: boolean;
}

/**
 * The boundary between the agent and travel inventory.
 *
 * In this prototype it is backed by local demo data. In production each
 * method would call a real service (search service, hotel content API,
 * flight availability API) — the agent and tools would not need to change.
 */
export interface TravelProvider {
  readonly name: string;
  listDestinations(): Promise<Destination[]>;
  getDestination(id: string): Promise<Destination | undefined>;
  listTrips(filter?: { destinationIds?: string[] }): Promise<TripOption[]>;
  getTrip(id: string): Promise<TripOption | undefined>;
  searchFlights(origin: string, destinationIds: string[]): Promise<FlightOption[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly operation: string,
    message = `Travel provider failed during ${operation}`,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

type Operation = 'listDestinations' | 'getDestination' | 'listTrips' | 'getTrip' | 'searchFlights';

export interface MockProviderOptions {
  /** Operations that should throw — used by tests to simulate outages. */
  failOn?: Operation[];
}

/** Local demo-data implementation of {@link TravelProvider}. */
export class MockTravelProvider implements TravelProvider {
  readonly name = 'demo-data';
  private readonly failOn: ReadonlySet<Operation>;

  constructor(options: MockProviderOptions = {}) {
    this.failOn = new Set(options.failOn ?? []);
  }

  private guard(operation: Operation): void {
    if (this.failOn.has(operation)) throw new ProviderError(operation);
  }

  async listDestinations(): Promise<Destination[]> {
    this.guard('listDestinations');
    return DESTINATIONS;
  }

  async getDestination(id: string): Promise<Destination | undefined> {
    this.guard('getDestination');
    return DESTINATIONS_BY_ID.get(id);
  }

  async listTrips(filter: { destinationIds?: string[] } = {}): Promise<TripOption[]> {
    this.guard('listTrips');
    const ids = filter.destinationIds;
    if (!ids || ids.length === 0) return TRIPS;
    const wanted = new Set(ids);
    return TRIPS.filter((trip) => wanted.has(trip.destinationId));
  }

  async getTrip(id: string): Promise<TripOption | undefined> {
    this.guard('getTrip');
    return TRIPS.find((trip) => trip.id === id);
  }

  async searchFlights(origin: string, destinationIds: string[]): Promise<FlightOption[]> {
    this.guard('searchFlights');
    return destinationIds.flatMap((id) => {
      const destination = DESTINATIONS_BY_ID.get(id);
      if (!destination) return [];
      return [
        {
          destinationId: id,
          origin,
          durationHours: destination.flightHoursFromLondon,
          indicativeFare: Math.round(60 + destination.flightHoursFromLondon * 28),
          direct: destination.flightHoursFromLondon < 6,
        },
      ];
    });
  }
}
