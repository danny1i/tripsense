import type { HolidayType, Month, TripOption } from '../types/travel';
import { MONTHS } from '../types/travel';
import { DESTINATIONS_BY_ID } from './destinations';

/**
 * Demo travel packages (flight + hotel, price per person in GBP).
 * Prices and availability are illustrative — not live inventory.
 */

interface TripSeed {
  id: string;
  destinationId: string;
  hotelName: string;
  price: number;
  nights: number;
  hotelRating: number;
  beachDistance: number | null;
  nightlifeScore: TripOption['nightlifeScore'];
  familyFriendly: boolean;
  coupleFriendly: boolean;
  holidayTypes: HolidayType[];
  amenities: string[];
  boardBasis: TripOption['boardBasis'];
  description: string;
  availableMonths?: Month[];
  departureAirport?: string;
}

const ALL_YEAR: Month[] = [...MONTHS];
const SUMMER_SEASON: Month[] = ['April', 'May', 'June', 'July', 'August', 'September', 'October'];

/** Build a simple day-by-day itinerary from the destination's activities. */
function buildItinerary(destinationId: string, nights: number, hotelName: string): string[] {
  const destination = DESTINATIONS_BY_ID.get(destinationId);
  const activities = destination?.activities ?? [];
  const days = nights + 1;
  const plan: string[] = [`Day 1 — Fly out, check in at ${hotelName} and settle in.`];
  for (let day = 2; day < days; day += 1) {
    const activity = activities[(day - 2) % Math.max(activities.length, 1)] ?? 'Free day to relax';
    plan.push(`Day ${day} — ${activity}.`);
  }
  plan.push(`Day ${days} — Relaxed morning, then fly home.`);
  return plan;
}

const SEEDS: TripSeed[] = [
  // Tenerife
  {
    id: 'trip-001', destinationId: 'tenerife', hotelName: 'Costa Adeje Sunset Hotel', price: 389, nights: 4, hotelRating: 4.4, beachDistance: 600,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'relaxation'],
    amenities: ['Outdoor pool', 'Sea-view terrace', 'Free Wi-Fi', 'Spa', 'Kids club'], boardBasis: 'Half board',
    description: 'A relaxed resort hotel above Playa del Duque with sunset views over La Gomera and an easy walk to the promenade.',
  },
  {
    id: 'trip-002', destinationId: 'tenerife', hotelName: 'Los Cristianos Bay Apartments', price: 329, nights: 3, hotelRating: 3.9, beachDistance: 250,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'family'],
    amenities: ['Kitchenette', 'Pool', 'Free Wi-Fi', 'Balcony'], boardBasis: 'Room only',
    description: 'Simple, good-value apartments a few minutes from the sandy bay and harbour of Los Cristianos.',
  },
  {
    id: 'trip-003', destinationId: 'tenerife', hotelName: 'Puerto de la Cruz Garden Hotel', price: 649, nights: 7, hotelRating: 4.6, beachDistance: 1800,
    nightlifeScore: 2, familyFriendly: true, coupleFriendly: true, holidayTypes: ['culture', 'adventure', 'relaxation'],
    amenities: ['Botanical garden', 'Heated pool', 'Spa', 'Restaurant'], boardBasis: 'Half board',
    description: 'A week in the greener north of the island, close to Teide National Park trails and the old town.',
  },
  {
    id: 'trip-004', destinationId: 'tenerife', hotelName: 'Playa de las Américas Lights', price: 459, nights: 4, hotelRating: 4.1, beachDistance: 300,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: true, holidayTypes: ['beach', 'nightlife'],
    amenities: ['Rooftop bar', 'Pool', 'Gym', 'Late check-out'], boardBasis: 'Bed & breakfast',
    description: 'Adults-focused hotel on the Veronicas strip — beach by day, bars and clubs by night.',
  },
  // Gran Canaria
  {
    id: 'trip-005', destinationId: 'gran-canaria', hotelName: 'Maspalomas Dunes Resort', price: 419, nights: 4, hotelRating: 4.5, beachDistance: 400,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'relaxation', 'family'],
    amenities: ['Three pools', 'Kids club', 'Spa', 'Free Wi-Fi'], boardBasis: 'All inclusive',
    description: 'All-inclusive resort beside the famous Maspalomas dunes and lighthouse.',
  },
  {
    id: 'trip-006', destinationId: 'gran-canaria', hotelName: 'Playa del Inglés Studios', price: 299, nights: 3, hotelRating: 3.7, beachDistance: 700,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: true, holidayTypes: ['beach', 'nightlife'],
    amenities: ['Pool', 'Bar', 'Free Wi-Fi'], boardBasis: 'Room only',
    description: 'Budget studios near the Yumbo Centre, the heart of the island’s nightlife.',
  },
  {
    id: 'trip-007', destinationId: 'gran-canaria', hotelName: 'Las Palmas Old Town Boutique', price: 359, nights: 3, hotelRating: 4.3, beachDistance: 900,
    nightlifeScore: 4, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'culture', 'food', 'beach'],
    amenities: ['Roof terrace', 'Breakfast', 'Free Wi-Fi'], boardBasis: 'Bed & breakfast',
    description: 'Stylish rooms in the Vegueta quarter, a short ride from Las Canteras city beach.',
  },
  // Madeira
  {
    id: 'trip-008', destinationId: 'madeira', hotelName: 'Funchal Cliffside Hotel', price: 469, nights: 4, hotelRating: 4.6, beachDistance: 1500,
    nightlifeScore: 2, familyFriendly: false, coupleFriendly: true, holidayTypes: ['relaxation', 'adventure', 'culture'],
    amenities: ['Infinity pool', 'Spa', 'Ocean-view rooms', 'Restaurant'], boardBasis: 'Bed & breakfast',
    description: 'Peaceful clifftop hotel with sweeping Atlantic views, ideal for walkers and couples.',
  },
  {
    id: 'trip-009', destinationId: 'madeira', hotelName: 'Calheta Marina Retreat', price: 729, nights: 7, hotelRating: 4.7, beachDistance: 200,
    nightlifeScore: 1, familyFriendly: true, coupleFriendly: true, holidayTypes: ['luxury', 'relaxation', 'beach'],
    amenities: ['Private beach access', 'Spa', 'Two pools', 'Fine dining'], boardBasis: 'Half board',
    description: 'A week of calm on the sunny south-west coast beside one of Madeira’s few sandy beaches.',
  },
  {
    id: 'trip-010', destinationId: 'madeira', hotelName: 'Funchal Old Town Guesthouse', price: 339, nights: 3, hotelRating: 4.0, beachDistance: 2500,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['culture', 'food', 'city'],
    amenities: ['Breakfast', 'Free Wi-Fi', 'Shared lounge'], boardBasis: 'Bed & breakfast',
    description: 'Friendly guesthouse among the painted doors of Rua de Santa Maria, close to the market.',
  },
  // Cyprus
  {
    id: 'trip-011', destinationId: 'cyprus', hotelName: 'Paphos Harbour Hotel', price: 399, nights: 4, hotelRating: 4.3, beachDistance: 350,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'culture', 'family'],
    amenities: ['Pool', 'Kids pool', 'Gym', 'Free Wi-Fi'], boardBasis: 'Half board',
    description: 'Harbour-side hotel near the mosaics of Kato Paphos and a sandy municipal beach.',
  },
  {
    id: 'trip-012', destinationId: 'cyprus', hotelName: 'Ayia Napa Strip Hotel', price: 279, nights: 3, hotelRating: 3.6, beachDistance: 500,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: false, holidayTypes: ['beach', 'nightlife'],
    amenities: ['Pool bar', 'Free Wi-Fi'], boardBasis: 'Room only', availableMonths: SUMMER_SEASON,
    description: 'Lively, low-cost base for Nissi Beach and Ayia Napa’s club scene. Summer season only.',
  },
  {
    id: 'trip-013', destinationId: 'cyprus', hotelName: 'Limassol Seafront Suites', price: 689, nights: 7, hotelRating: 4.5, beachDistance: 100,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'relaxation', 'luxury'],
    amenities: ['Beachfront', 'Spa', 'Kids club', 'Two restaurants'], boardBasis: 'All inclusive',
    description: 'Spacious suites right on the sand, with a calm bay that suits young children.',
  },
  // Malta
  {
    id: 'trip-014', destinationId: 'malta', hotelName: 'Valletta Heritage Rooms', price: 309, nights: 3, hotelRating: 4.4, beachDistance: 1200,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'culture', 'food'],
    amenities: ['Rooftop breakfast', 'Free Wi-Fi', 'Harbour views'], boardBasis: 'Bed & breakfast',
    description: 'Restored townhouse inside the walled capital, with swimming spots below the bastions.',
  },
  {
    id: 'trip-015', destinationId: 'malta', hotelName: "St Julian's Bay Hotel", price: 379, nights: 4, hotelRating: 4.0, beachDistance: 300,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: true, holidayTypes: ['beach', 'nightlife'],
    amenities: ['Pool', 'Lido', 'Bar', 'Free Wi-Fi'], boardBasis: 'Bed & breakfast',
    description: 'Bayside hotel next to Paceville’s bars, with a lido for sunbathing and swimming.',
  },
  {
    id: 'trip-016', destinationId: 'malta', hotelName: 'Gozo Farmhouse Escape', price: 449, nights: 4, hotelRating: 4.5, beachDistance: 2000,
    nightlifeScore: 1, familyFriendly: true, coupleFriendly: true, holidayTypes: ['relaxation', 'adventure'],
    amenities: ['Private pool', 'Garden', 'Kitchen'], boardBasis: 'Room only',
    description: 'Quiet stone farmhouse on Gozo, great for coastal walks and diving.',
  },
  // Lisbon
  {
    id: 'trip-017', destinationId: 'lisbon', hotelName: 'Alfama Rooftop Hotel', price: 339, nights: 3, hotelRating: 4.5, beachDistance: null,
    nightlifeScore: 4, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'culture', 'food'],
    amenities: ['Rooftop bar', 'Breakfast', 'Free Wi-Fi'], boardBasis: 'Bed & breakfast',
    description: 'Boutique hotel in the oldest quarter with a rooftop looking over the Tagus.',
  },
  {
    id: 'trip-018', destinationId: 'lisbon', hotelName: 'Cascais Coast Hotel', price: 449, nights: 4, hotelRating: 4.3, beachDistance: 300,
    nightlifeScore: 2, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'relaxation', 'family'],
    amenities: ['Pool', 'Sea views', 'Bike hire'], boardBasis: 'Bed & breakfast',
    description: 'Seaside town hotel 40 minutes from Lisbon by train, near three sandy coves.',
  },
  {
    id: 'trip-019', destinationId: 'lisbon', hotelName: 'Bairro Alto Budget Stay', price: 219, nights: 2, hotelRating: 3.8, beachDistance: null,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: true, holidayTypes: ['city', 'nightlife'],
    amenities: ['Free Wi-Fi', 'Shared kitchen'], boardBasis: 'Room only',
    description: 'Cheap and cheerful rooms in the middle of Lisbon’s busiest bar district.',
  },
  // Barcelona
  {
    id: 'trip-020', destinationId: 'barcelona', hotelName: 'Barceloneta Beach Hotel', price: 389, nights: 3, hotelRating: 4.2, beachDistance: 150,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: true, holidayTypes: ['city', 'beach', 'nightlife'],
    amenities: ['Rooftop pool', 'Bar', 'Free Wi-Fi'], boardBasis: 'Room only',
    description: 'City-beach hotel steps from the sand and the seafront bars of Port Olímpic.',
  },
  {
    id: 'trip-021', destinationId: 'barcelona', hotelName: 'Gothic Quarter Boutique', price: 469, nights: 4, hotelRating: 4.6, beachDistance: 1200,
    nightlifeScore: 4, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'culture', 'food'],
    amenities: ['Breakfast', 'Courtyard', 'Free Wi-Fi'], boardBasis: 'Bed & breakfast',
    description: 'Characterful hotel in a medieval lane, walking distance to the cathedral and La Rambla.',
  },
  {
    id: 'trip-022', destinationId: 'barcelona', hotelName: 'Eixample Family Apartments', price: 429, nights: 4, hotelRating: 4.1, beachDistance: 2000,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: false, holidayTypes: ['city', 'family'],
    amenities: ['Two bedrooms', 'Kitchen', 'Washing machine'], boardBasis: 'Room only',
    description: 'Roomy apartments near Sagrada Família with space for the whole family.',
  },
  // Rome
  {
    id: 'trip-023', destinationId: 'rome', hotelName: 'Trastevere Courtyard Hotel', price: 369, nights: 3, hotelRating: 4.5, beachDistance: null,
    nightlifeScore: 4, familyFriendly: false, coupleFriendly: true, holidayTypes: ['city', 'culture', 'food'],
    amenities: ['Breakfast', 'Courtyard garden', 'Free Wi-Fi'], boardBasis: 'Bed & breakfast',
    description: 'Romantic hideaway among Trastevere’s trattorias, a short walk across the river to the centre.',
  },
  {
    id: 'trip-024', destinationId: 'rome', hotelName: 'Vatican View Rooms', price: 419, nights: 4, hotelRating: 4.2, beachDistance: null,
    nightlifeScore: 2, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'culture', 'family'],
    amenities: ['Family rooms', 'Breakfast', 'Lift'], boardBasis: 'Bed & breakfast',
    description: 'Comfortable rooms in quiet Prati, next to the Vatican and the metro.',
  },
  {
    id: 'trip-025', destinationId: 'rome', hotelName: 'Spanish Steps Grand', price: 799, nights: 3, hotelRating: 4.9, beachDistance: null,
    nightlifeScore: 3, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'luxury', 'culture'],
    amenities: ['Spa', 'Rooftop restaurant', 'Concierge', 'Butler service'], boardBasis: 'Bed & breakfast',
    description: 'Five-star grandeur at the top of the Spanish Steps.',
  },
  // Marrakech
  {
    id: 'trip-026', destinationId: 'marrakech', hotelName: 'Riad Dar Zahra', price: 329, nights: 3, hotelRating: 4.6, beachDistance: null,
    nightlifeScore: 2, familyFriendly: false, coupleFriendly: true, holidayTypes: ['culture', 'food', 'relaxation'],
    amenities: ['Plunge pool', 'Roof terrace', 'Breakfast', 'Hammam'], boardBasis: 'Bed & breakfast',
    description: 'Intimate riad in the medina with a tiled courtyard and rooftop breakfasts.',
  },
  {
    id: 'trip-027', destinationId: 'marrakech', hotelName: 'Palmeraie Pool Resort', price: 499, nights: 4, hotelRating: 4.4, beachDistance: null,
    nightlifeScore: 2, familyFriendly: true, coupleFriendly: true, holidayTypes: ['relaxation', 'luxury', 'family'],
    amenities: ['Large pool', 'Kids club', 'Spa', 'Shuttle to medina'], boardBasis: 'Half board',
    description: 'Resort among the palm groves with a huge pool and shuttle into the city.',
  },
  {
    id: 'trip-028', destinationId: 'marrakech', hotelName: 'Atlas Adventure Lodge', price: 449, nights: 4, hotelRating: 4.3, beachDistance: null,
    nightlifeScore: 1, familyFriendly: true, coupleFriendly: true, holidayTypes: ['adventure', 'culture'],
    amenities: ['Guided hikes', 'Mountain views', 'Restaurant'], boardBasis: 'Half board',
    description: 'Mountain lodge with guided treks to Berber villages, plus a night in the medina.',
  },
  // Dubai
  {
    id: 'trip-029', destinationId: 'dubai', hotelName: 'JBR Beachfront Tower', price: 749, nights: 4, hotelRating: 4.5, beachDistance: 100,
    nightlifeScore: 4, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'luxury', 'family'],
    amenities: ['Beach access', 'Infinity pool', 'Kids club', 'Gym'], boardBasis: 'Bed & breakfast',
    description: 'High-rise hotel on Jumeirah Beach Residence with direct access to the sand.',
  },
  {
    id: 'trip-030', destinationId: 'dubai', hotelName: 'Deira Creek Hotel', price: 529, nights: 3, hotelRating: 4.0, beachDistance: 4000,
    nightlifeScore: 2, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'food', 'culture'],
    amenities: ['Pool', 'Breakfast', 'Metro nearby'], boardBasis: 'Bed & breakfast',
    description: 'Good-value base in Old Dubai near the gold and spice souks.',
  },
  {
    id: 'trip-031', destinationId: 'dubai', hotelName: 'Palm Jumeirah Resort', price: 1349, nights: 7, hotelRating: 4.8, beachDistance: 50,
    nightlifeScore: 4, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'luxury', 'relaxation'],
    amenities: ['Private beach', 'Waterpark access', 'Spa', 'Six restaurants'], boardBasis: 'Half board',
    description: 'A week of resort luxury on the Palm with a private beach and waterpark access.',
  },
  // Paris
  {
    id: 'trip-032', destinationId: 'paris', hotelName: 'Le Marais Petit Hôtel', price: 359, nights: 3, hotelRating: 4.3, beachDistance: null,
    nightlifeScore: 4, familyFriendly: false, coupleFriendly: true, holidayTypes: ['city', 'culture', 'food'],
    amenities: ['Breakfast', 'Free Wi-Fi', 'Bar'], boardBasis: 'Bed & breakfast',
    description: 'Charming small hotel in Le Marais, surrounded by galleries, cafés and bakeries.',
  },
  {
    id: 'trip-033', destinationId: 'paris', hotelName: 'Montmartre Studio', price: 249, nights: 2, hotelRating: 3.9, beachDistance: null,
    nightlifeScore: 4, familyFriendly: false, coupleFriendly: true, holidayTypes: ['city', 'nightlife'],
    amenities: ['Kitchenette', 'Free Wi-Fi'], boardBasis: 'Room only',
    description: 'Compact studio below Sacré-Cœur — perfect for a quick weekend.',
  },
  {
    id: 'trip-034', destinationId: 'paris', hotelName: 'Family Suites Val d’Europe', price: 499, nights: 3, hotelRating: 4.2, beachDistance: null,
    nightlifeScore: 1, familyFriendly: true, coupleFriendly: false, holidayTypes: ['family', 'city'],
    amenities: ['Family suites', 'Pool', 'Theme park shuttle'], boardBasis: 'Bed & breakfast',
    description: 'Family suites near the theme parks, with trains into central Paris.',
  },
  // Amsterdam
  {
    id: 'trip-035', destinationId: 'amsterdam', hotelName: 'Canal Ring Boutique', price: 389, nights: 3, hotelRating: 4.4, beachDistance: null,
    nightlifeScore: 4, familyFriendly: true, coupleFriendly: true, holidayTypes: ['city', 'culture'],
    amenities: ['Canal views', 'Breakfast', 'Bike hire'], boardBasis: 'Bed & breakfast',
    description: 'Canal-house hotel on the Herengracht, close to the museums.',
  },
  {
    id: 'trip-036', destinationId: 'amsterdam', hotelName: 'Jordaan Budget Rooms', price: 229, nights: 2, hotelRating: 3.7, beachDistance: null,
    nightlifeScore: 5, familyFriendly: false, coupleFriendly: true, holidayTypes: ['city', 'nightlife'],
    amenities: ['Free Wi-Fi', 'Bar'], boardBasis: 'Room only',
    description: 'No-frills rooms in the Jordaan, surrounded by brown cafés and bars.',
  },
  {
    id: 'trip-037', destinationId: 'amsterdam', hotelName: 'Zandvoort Beach Hotel', price: 379, nights: 4, hotelRating: 4.0, beachDistance: 200,
    nightlifeScore: 2, familyFriendly: true, coupleFriendly: true, holidayTypes: ['beach', 'family', 'relaxation'],
    amenities: ['Sea views', 'Restaurant', 'Bike hire'], boardBasis: 'Half board', availableMonths: SUMMER_SEASON,
    description: 'North Sea beach hotel 30 minutes from Amsterdam by train. Summer season only.',
  },
];

export const TRIPS: TripOption[] = SEEDS.map((seed) => ({
  id: seed.id,
  destinationId: seed.destinationId,
  hotelName: seed.hotelName,
  price: seed.price,
  currency: 'GBP',
  nights: seed.nights,
  duration: seed.nights + 1,
  hotelRating: seed.hotelRating,
  beachDistance: seed.beachDistance,
  nightlifeScore: seed.nightlifeScore,
  familyFriendly: seed.familyFriendly,
  coupleFriendly: seed.coupleFriendly,
  holidayTypes: seed.holidayTypes,
  amenities: seed.amenities,
  boardBasis: seed.boardBasis,
  departureAirport: seed.departureAirport ?? 'London Gatwick',
  availableMonths: seed.availableMonths ?? ALL_YEAR,
  description: seed.description,
  itinerary: buildItinerary(seed.destinationId, seed.nights, seed.hotelName),
}));
