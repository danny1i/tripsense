import type { TripQuestionResponse } from '../types/agent';
import type { Destination, Month, TravelPreferences, TripOption } from '../types/travel';
import { normalise } from './intent';

interface TripQuestion {
  trip: TripOption;
  destination: Destination;
  question: string;
  preferences: TravelPreferences;
  month: Month;
}

interface Topic {
  id: string;
  pattern: RegExp;
  answer: (q: TripQuestion) => { text: string; basedOn: string[] };
}

const distance = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km` : `${m} m`);

/**
 * Answers questions about one trip using ONLY the demo data we hold.
 * If the data cannot answer the question we say so rather than inventing facts.
 */
const TOPICS: Topic[] = [
  {
    id: 'couple',
    pattern: /\b(couples?|romantic|honeymoon|partner|anniversary|two of us)\b/,
    answer: ({ trip, destination }) => ({
      text: trip.coupleFriendly
        ? `Yes — ${trip.hotelName} is a good fit for a couple. ${trip.nightlifeScore <= 2 ? 'It is on the quieter side, which suits a relaxing break.' : 'There are bars and restaurants nearby for evenings out.'} ${destination.name} is popular with couples for ${destination.activities.slice(0, 2).join(' and ')}.`
        : `It is not our top pick for couples — ${trip.hotelName} is set up mainly for ${trip.familyFriendly ? 'families' : 'groups'}. You might prefer a quieter option in ${destination.name}.`,
      basedOn: ['Couple suitability', 'Nightlife score', 'Activities'],
    }),
  },
  {
    id: 'family',
    pattern: /\b(famil(y|ies)|kids?|children|child|toddlers?|baby)\b/,
    answer: ({ trip }) => ({
      text: trip.familyFriendly
        ? `Yes, it is family-friendly.${trip.amenities.some((a) => /kids|family|pool/i.test(a)) ? ` Useful extras include ${trip.amenities.filter((a) => /kids|family|pool/i.test(a)).join(', ').toLowerCase()}.` : ''}`
        : `It is not marked as family-friendly${trip.nightlifeScore >= 4 ? ' — it is in a lively nightlife area' : ''}, so it is better suited to adults.`,
      basedOn: ['Family-friendly flag', 'Amenities'],
    }),
  },
  {
    id: 'beach',
    pattern: /\b(beach|sea|sand|swim(ming)?|coast)\b/,
    answer: ({ trip, destination }) => ({
      text:
        trip.beachDistance === null
          ? `There is no beach within easy reach of ${trip.hotelName}. ${destination.hasBeach ? `${destination.name} does have beaches elsewhere.` : `${destination.name} is not a beach destination.`}`
          : `The nearest beach is about ${distance(trip.beachDistance)} from the hotel${trip.beachDistance <= 400 ? ' — just a few minutes’ walk' : trip.beachDistance <= 1000 ? ' — an easy walk' : ', so you may want a short taxi or bus'}.`,
      basedOn: ['Beach distance'],
    }),
  },
  {
    id: 'weather',
    pattern: /\b(weather|warm|hot|cold|temperature|sunny|rain|climate)\b/,
    answer: ({ destination, month }) => {
      const temp = destination.temperatureByMonth[month];
      const feel = temp >= 27 ? 'hot' : temp >= 20 ? 'warm' : temp >= 14 ? 'mild' : 'cool';
      return {
        text: `In ${month}, ${destination.name} averages around ${temp}°C during the day — ${feel}. (Demo climate data; check a forecast before you travel.)`,
        basedOn: [`${month} average temperature`],
      };
    },
  },
  {
    id: 'activities',
    pattern: /\b(activit(y|ies)|things to do|do there|nearby|see|excursions?|attractions?|explore)\b/,
    answer: ({ destination }) => ({
      text: `Popular things to do in ${destination.name} include ${destination.activities.slice(0, -1).join(', ')} and ${destination.activities.at(-1)}.`,
      basedOn: ['Destination activities'],
    }),
  },
  {
    id: 'nightlife',
    pattern: /\b(nightlife|bars?|clubs?|party|going out|lively|quiet|noisy)\b/,
    answer: ({ trip }) => ({
      text:
        trip.nightlifeScore >= 4
          ? `Nightlife is lively — this hotel scores ${trip.nightlifeScore}/5 for bars and evenings out nearby.`
          : trip.nightlifeScore === 3
            ? 'There is a moderate choice of bars and restaurants nearby (3/5) — relaxed rather than wild.'
            : `It is a quiet area (nightlife ${trip.nightlifeScore}/5), ideal if you want peaceful evenings.`,
      basedOn: ['Nightlife score'],
    }),
  },
  {
    id: 'price',
    pattern: /\b(price|cost|how much|expensive|cheap|budget|£|pay|value|included|include)\b/,
    answer: ({ trip, preferences }) => ({
      text: `It costs £${trip.price} per person for ${trip.nights} nights, including return flights from ${trip.departureAirport} and ${trip.boardBasis.toLowerCase()} accommodation.${preferences.budgetMax ? (trip.price <= preferences.budgetMax ? ` That is within your £${preferences.budgetMax} budget.` : ` That is above your £${preferences.budgetMax} budget.`) : ''} Prices are illustrative demo data.`,
      basedOn: ['Price', 'Board basis', 'Departure airport'],
    }),
  },
  {
    id: 'flight',
    pattern: /\b(flight|fly|flying|airport|how long.*(get|travel)|travel time)\b/,
    answer: ({ trip, destination }) => ({
      text: `Flights leave from ${trip.departureAirport} and take about ${destination.flightHoursFromLondon} hours.`,
      basedOn: ['Flight time', 'Departure airport'],
    }),
  },
  {
    id: 'hotel',
    pattern: /\b(hotel|room|amenit(y|ies)|pool|spa|wifi|wi-fi|breakfast|food|meals?|board|rating|reviews?)\b/,
    answer: ({ trip }) => ({
      text: `${trip.hotelName} is rated ${trip.hotelRating}/5 and is ${trip.boardBasis.toLowerCase()}. Amenities include ${trip.amenities.join(', ').toLowerCase()}.`,
      basedOn: ['Hotel rating', 'Amenities', 'Board basis'],
    }),
  },
];

export function answerTripQuestion(input: TripQuestion): TripQuestionResponse {
  const text = normalise(input.question);
  const matched = TOPICS.filter((topic) => topic.pattern.test(text)).slice(0, 2);

  if (matched.length === 0) {
    return {
      answer: `I can only answer from the trip information I have. I can tell you about the price, beach distance, weather in ${input.month}, things to do, nightlife, flights, the hotel, and whether it suits couples or families.`,
      basedOn: [],
    };
  }

  const parts = matched.map((topic) => topic.answer(input));
  return {
    answer: parts.map((p) => p.text).join(' '),
    basedOn: [...new Set(parts.flatMap((p) => p.basedOn))],
  };
}
