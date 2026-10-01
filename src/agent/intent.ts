import type { HolidayType, Month, PreferenceKey, TravelPreferences } from '../types/travel';
import { MONTHS } from '../types/travel';
import { DESTINATIONS } from '../data/destinations';

/**
 * The structured result of reading one user message.
 *
 * `set` only contains things the user actually said. Nothing is guessed.
 * Relative words ("cheaper", "closer to the beach") are kept separate so the
 * conversation layer can resolve them against the current search.
 */
export interface ParsedIntent {
  set: TravelPreferences;
  remove: PreferenceKey[];
  relative: RelativeChanges;
  mode: 'new' | 'refine' | 'reset';
  focus: 'packages' | 'hotels' | 'flights';
  /** Does the message look like it is about travel at all? */
  travelRelated: boolean;
  /** A question about the current results, e.g. "which is cheapest?" */
  question?: 'cheapest' | 'top_rated' | 'closest_beach';
}

export interface RelativeChanges {
  cheaper?: boolean;
  closerToBeach?: boolean;
  warmer?: boolean;
  longer?: boolean;
  shorter?: boolean;
  quieter?: boolean;
}

/** Something that turns free text into a {@link ParsedIntent}. */
export interface IntentExtractor {
  readonly source: 'rules' | 'llm';
  extract(message: string, current: TravelPreferences): Promise<ParsedIntent>;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14,
};

const MONTH_ALIASES: [RegExp, Month][] = [
  ...MONTHS.map((m): [RegExp, Month] => [new RegExp(`\\b${m.slice(0, 3).toLowerCase()}(${m.slice(3).toLowerCase()})?\\b`), m]),
  [/\bchristmas\b|\bnew year\b/, 'December'],
  [/\beaster\b/, 'April'],
  [/\bhalf[- ]term\b/, 'October'],
];

/** Countries and regions that map to several destinations. */
const PLACE_GROUPS: [RegExp, string[]][] = [
  [/\bcanar(y|ies)\b/, ['tenerife', 'gran-canaria']],
  [/\bspain\b|\bspanish\b/, ['tenerife', 'gran-canaria', 'barcelona']],
  [/\bportugal\b|\bportuguese\b/, ['lisbon', 'madeira']],
  [/\bital(y|ian)\b/, ['rome']],
  [/\bmorocc(o|an)\b/, ['marrakech']],
  [/\bfrance\b|\bfrench\b/, ['paris']],
  [/\bnetherlands\b|\bholland\b|\bdutch\b/, ['amsterdam']],
  [/\buae\b|\bemirates\b/, ['dubai']],
];

const DESTINATION_ALIASES: [RegExp, string][] = [
  ...DESTINATIONS.map((d): [RegExp, string] => [new RegExp(`\\b${d.name.toLowerCase()}\\b`), d.id]),
  [/\bmarrakesh\b/, 'marrakech'],
  [/\bfunchal\b/, 'madeira'],
  [/\bpaphos\b|\blimassol\b|\bayia napa\b/, 'cyprus'],
  [/\bvalletta\b|\bgozo\b/, 'malta'],
];

const TRAVEL_WORDS =
  /\b(trip|holiday|holidays|vacation|travel|getaway|break|go|going|visit|somewhere|destination|place|hotel|flight|fly|stay|escape|resort|sun|beach|city|weekend|abroad|away|tour|package|deal|options?|cheaper|closer|warmer)\b/;

const TYPE_PATTERNS: [RegExp, HolidayType][] = [
  [/\bcity( break)?\b|\burban\b|\bsightseeing\b/, 'city'],
  [/\bcultur(e|al)\b|\bhistor(y|ic|ical)\b|\bmuseums?\b|\bart\b|\bruins\b/, 'culture'],
  [/\bfood(ie)?\b|\brestaurants?\b|\bcuisine\b|\beat(ing)?\b|\btapas\b/, 'food'],
  [/\brelax(ing|ation)?\b|\bchill\b|\bspa\b|\bpeaceful\b|\bunwind\b/, 'relaxation'],
  [/\badventur(e|ous)\b|\bhik(e|ing)\b|\boutdoors?\b|\bwalking\b|\btrek(king)?\b/, 'adventure'],
  [/\bluxury\b|\bluxurious\b|\b5[- ]star\b|\bfive[- ]star\b/, 'luxury'],
];

function parseNumberToken(token: string): number | undefined {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token];
}

function extractBudget(text: string): number | undefined {
  const currency = text.match(/£\s?(\d[\d,]*)(k)?/);
  if (currency?.[1]) return Number(currency[1].replace(/,/g, '')) * (currency[2] ? 1000 : 1);
  const words = text.match(/\b(\d[\d,]*)\s?(pounds|gbp|quid)\b/);
  if (words?.[1]) return Number(words[1].replace(/,/g, ''));
  const under = text.match(/\b(under|below|less than|max(imum)?|up to|budget of)\s+(\d{3,5})\b/);
  if (under?.[3]) return Number(under[3]);
  return undefined;
}

function extractDuration(text: string): number | undefined {
  if (/\blong weekend\b/.test(text)) return 4;
  if (/\bweekend\b/.test(text)) return 3;
  if (/\b(a|one|1)[- ]week\b/.test(text)) return 8;
  const match = text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)[- ]?(day|days|night|nights)\b/);
  if (!match?.[1] || !match[2]) return undefined;
  const value = parseNumberToken(match[1]);
  if (value === undefined || value < 1 || value > 30) return undefined;
  return match[2].startsWith('night') ? value + 1 : value;
}

function extractBeachDistance(text: string): number | undefined {
  const within = text.match(/\bwithin\s+(\d+(?:\.\d+)?)\s?(m|metres|meters|km|kilometres|kilometers)\b/);
  if (within?.[1] && within[2]) {
    const value = Number(within[1]);
    return within[2].startsWith('k') ? value * 1000 : value;
  }
  if (/\b(beachfront|on the beach|beachside)\b/.test(text)) return 200;
  if (/\b(near|close to|next to|walk(ing distance)? (to|from)|steps from|by) the (beach|sea)\b|\bnear (a|the)? ?beach\b/.test(text)) return 1000;
  return undefined;
}

function extractDestinations(text: string): string[] {
  const ids = new Set<string>();
  for (const [pattern, id] of DESTINATION_ALIASES) if (pattern.test(text)) ids.add(id);
  if (ids.size === 0) for (const [pattern, group] of PLACE_GROUPS) if (pattern.test(text)) group.forEach((id) => ids.add(id));
  return [...ids];
}

/** Normalise user text for matching. */
export function normalise(message: string): string {
  return message
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic, rule-based intent extraction used in Demo Mode and as the
 * fallback whenever the optional AI model is unavailable.
 */
export function parseIntent(message: string): ParsedIntent {
  const text = normalise(message);
  const set: TravelPreferences = {};
  const remove = new Set<PreferenceKey>();
  const relative: RelativeChanges = {};

  if (/\b(start over|start again|new search|reset|clear (everything|all|filters))\b/.test(text)) {
    return { set, remove: [], relative, mode: 'reset', focus: 'packages', travelRelated: true };
  }

  // Questions about the current results ("which is the best rated?") are
  // answered from what's on screen, not turned into new filters.
  const asksWhich = /^(which|what)('s| is| one| are)?\b/.test(text);
  let question: ParsedIntent['question'];
  if (asksWhich) {
    if (/\b(cheapest|best value|lowest price)\b/.test(text)) question = 'cheapest';
    else if (/\b(best|highest|top)[- ]rated\b|\bbest hotel\b/.test(text)) question = 'top_rated';
    else if (/\b(closest|nearest) to the beach\b/.test(text)) question = 'closest_beach';
  }
  if (question) return { set, remove: [], relative, mode: 'refine', focus: 'packages', travelRelated: true, question };

  // Destinations ---------------------------------------------------------
  const destinations = extractDestinations(text);
  if (destinations.length > 0) set.destinationIds = destinations;
  if (/\beurop(e|ean)\b/.test(text)) set.europeOnly = true;
  if (/\b(anywhere|any destination|other destinations|somewhere else|elsewhere)\b/.test(text)) {
    remove.add('destinationIds');
  }

  // When -----------------------------------------------------------------
  for (const [pattern, month] of MONTH_ALIASES) {
    if (pattern.test(text)) {
      set.month = month;
      break;
    }
  }
  if (/\b(any month|any time|anytime|flexible dates)\b/.test(text)) remove.add('month');

  const duration = extractDuration(text);
  if (duration !== undefined) set.durationDays = duration;

  // Weather --------------------------------------------------------------
  if (/\b(hot|scorching|heatwave|really warm|very warm)\b/.test(text)) set.temperature = 'hot';
  else if (/\b(warm|sunny|sunshine|winter sun|sun)\b/.test(text)) set.temperature = 'warm';
  else if (/\b(mild|not too hot|cooler)\b/.test(text)) set.temperature = 'mild';
  if (/\b(warmer|hotter)\b/.test(text)) relative.warmer = true;

  // Budget ---------------------------------------------------------------
  const budget = extractBudget(text);
  if (budget !== undefined && budget >= 50) set.budgetMax = budget;
  if (/\b(cheap|budget|affordable|inexpensive|bargain|low[- ]cost|good value)\b/.test(text) && !/\bbudget of\b/.test(text)) {
    set.budgetLevel = 'low';
  }
  if (/\b(luxury|luxurious|5[- ]star|five[- ]star|upscale|splurge|treat ourselves)\b/.test(text)) set.budgetLevel = 'luxury';
  if (/\b(cheaper|less expensive|lower price|more affordable|lower budget|cut the cost)\b/.test(text)) relative.cheaper = true;
  if (/\b(any budget|any price|forget the budget|ignore the budget|no budget|money is no object|don't worry about (the )?(budget|price))\b/.test(text)) {
    remove.add('budgetMax');
    remove.add('budgetLevel');
  }

  // Beach ----------------------------------------------------------------
  if (/\b(beach|seaside|by the sea|coast(al)?)\b/.test(text) && !/\b(no beach|don't need (a )?beach|without (a )?beach)\b/.test(text)) {
    set.beach = true;
  }
  if (/\b(no beach|don't need (a )?beach|without (a )?beach)\b/.test(text)) {
    remove.add('beach');
    remove.add('beachMaxDistance');
  }
  const beachDistance = extractBeachDistance(text);
  if (beachDistance !== undefined) {
    set.beach = true;
    set.beachMaxDistance = beachDistance;
  }
  if (/\b(closer|nearer) to the (beach|sea)\b|\bcloser to (a )?beach\b|\bnearer (the )?(beach|sea)\b/.test(text)) {
    relative.closerToBeach = true;
    delete set.beachMaxDistance;
  }

  // Holiday style ----------------------------------------------------------
  const types = new Set<HolidayType>();
  for (const [pattern, type] of TYPE_PATTERNS) if (pattern.test(text)) types.add(type);
  if (set.beach) types.add('beach');
  if (types.size > 0) set.holidayTypes = [...types];

  if (/\b(nightlife|party|parties|partying|clubs?|clubbing|bars|lively|going out)\b/.test(text)) set.nightlife = 'high';
  if (/\b(quieter|quiet|less busy|calmer|peace and quiet)\b/.test(text)) {
    relative.quieter = true;
    remove.add('nightlife');
  }
  if (/\b(famil(y|ies)|kids?|children|child[- ]friendly|toddlers?)\b/.test(text)) set.familyFriendly = true;
  if (/\b(couples?|romantic|honeymoon|anniversary|my partner|my wife|my husband|my girlfriend|my boyfriend)\b/.test(text)) set.coupleFriendly = true;

  // Quality ----------------------------------------------------------------
  const stars = text.match(/\b([345])[- ]star\b/);
  if (stars?.[1]) set.minRating = Number(stars[1]) === 5 ? 4.5 : Number(stars[1]);
  if (/\b(highly rated|top rated|best rated|well reviewed|great reviews)\b/.test(text)) set.minRating = 4.5;

  // Who ---------------------------------------------------------------------
  const people = text.match(/\b(?:for|party of|group of|family of)\s+(\d{1,2}|two|three|four|five|six)\b(?!\s?(day|night))/);
  if (people?.[1]) set.travellers = parseNumberToken(people[1]);
  else if (/\b(couple|for two|the two of us)\b/.test(text)) set.travellers = 2;

  // Duration changes ---------------------------------------------------------
  if (/\b(longer|more days|extend)\b/.test(text)) relative.longer = true;
  if (/\b(shorter|fewer days)\b/.test(text)) relative.shorter = true;

  // Focus -------------------------------------------------------------------
  const focus: ParsedIntent['focus'] = /\bhotels?\b/.test(text) && !/\b(holiday|package|trip)\b/.test(text)
    ? 'hotels'
    : /\b(flights?|fly|flying)\b/.test(text) && !/\b(holiday|package|trip|hotel)\b/.test(text)
      ? 'flights'
      : 'packages';

  const hasConstraints = Object.keys(set).length > 0;
  const hasRelative = Object.values(relative).some(Boolean);
  const anaphora = /\b(it|that|those|these|them|same|instead|also|too|as well)\b/.test(text);
  const startsAsRefinement = /^(and|also|but|make|what about|how about|only|instead|actually|now|plus|with|without|maybe|ok|okay|can you make|could you make|show me only|i'?d prefer|prefer)\b/.test(text);
  const freshPhrasing = /^(find|show|search|i want|i'?d like|i need|looking for|i'?m looking|get me|plan|suggest|recommend|where can|where should|book)\b/.test(text);

  const mode: ParsedIntent['mode'] =
    freshPhrasing && hasConstraints && !hasRelative && !anaphora && !startsAsRefinement ? 'new' : 'refine';

  return {
    set,
    remove: [...remove],
    relative,
    mode,
    focus,
    travelRelated: hasConstraints || hasRelative || remove.size > 0 || TRAVEL_WORDS.test(text),
  };
}

/** Rule-based extractor — always available, no network, no API key. */
export const ruleBasedExtractor: IntentExtractor = {
  source: 'rules',
  extract: async (message) => parseIntent(message),
};
